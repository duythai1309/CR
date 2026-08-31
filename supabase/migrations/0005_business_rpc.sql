-- Các thao tác phải chạy nguyên tử hoặc cần vượt quyền có kiểm soát.

alter table credit_batches
  add column coop_admin_fee_pct numeric(5, 2) not null default 8
    check (coop_admin_fee_pct between 0 and 100);

-- Trigger chống tự nâng quyền phải nhường đường cho các hàm onboarding bên dưới.
create or replace function guard_profile_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if app_is_admin() or coalesce(current_setting('app.bypass_profile_guard', true), '') = 'on' then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.cooperative_id is distinct from old.cooperative_id then
    raise exception 'Không thể tự thay đổi vai trò hoặc hợp tác xã';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- onboarding
create function create_cooperative_and_join(
  p_name text, p_code text, p_province text,
  p_district text default null, p_commune text default null,
  p_contact_name text default null, p_contact_phone text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'Chưa đăng nhập'; end if;
  if (select cooperative_id from profiles where id = me) is not null then
    raise exception 'Tài khoản này đã thuộc một hợp tác xã';
  end if;
  if (select role from profiles where id = me) not in ('coop_manager', 'coop_staff') then
    raise exception 'Chỉ tài khoản hợp tác xã mới tạo được đơn vị';
  end if;

  insert into cooperatives (name, code, province, district, commune, contact_name, contact_phone)
  values (p_name, upper(trim(p_code)), p_province,
          nullif(p_district, ''), nullif(p_commune, ''),
          nullif(p_contact_name, ''), nullif(p_contact_phone, ''))
  returning id into new_id;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set cooperative_id = new_id, role = 'coop_manager' where id = me;
  return new_id;
end;
$$;

-- Cán bộ khác gia nhập bằng mã hợp tác xã, vào với quyền nhập liệu chứ không phải quản lý.
create function join_cooperative_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then raise exception 'Chưa đăng nhập'; end if;
  if (select cooperative_id from profiles where id = me) is not null then
    raise exception 'Tài khoản này đã thuộc một hợp tác xã';
  end if;

  select id into target from cooperatives where code = upper(trim(p_code));
  if target is null then raise exception 'Không tìm thấy hợp tác xã có mã %', upper(trim(p_code)); end if;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set cooperative_id = target, role = 'coop_staff' where id = me;
  return target;
end;
$$;

-- ---------------------------------------------------------------- gộp lô tín chỉ
-- Gom kết quả MRV đang hiệu lực của cả vụ vào lô, rồi khoá các thửa-vụ đã gộp lại
-- để nhật ký không đổi sau lưng con số đã phát hành.
create function build_credit_batch(p_batch_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b credit_batches%rowtype;
  gross numeric := 0;
  item_count integer := 0;
begin
  select * into b from credit_batches where id = p_batch_id;
  if b.id is null then raise exception 'Không tìm thấy lô tín chỉ'; end if;
  if not (app_is_admin() or (b.cooperative_id = app_coop_id() and app_user_role() = 'coop_manager')) then
    raise exception 'Không có quyền thao tác trên lô này';
  end if;
  if b.status <> 'draft' then raise exception 'Chỉ gộp được lô đang ở trạng thái nháp'; end if;
  if b.season_id is null then raise exception 'Lô chưa gắn với mùa vụ nào'; end if;

  delete from batch_items where batch_id = p_batch_id;

  insert into batch_items (batch_id, emission_calculation_id, field_season_id, co2e_t)
  select p_batch_id, ec.id, ec.field_season_id, ec.reduction_co2e_t
  from emission_calculations ec
  join field_seasons fs on fs.id = ec.field_season_id
  where ec.is_current
    and ec.cooperative_id = b.cooperative_id
    and fs.season_id = b.season_id
    and ec.reduction_co2e_t > 0;

  select coalesce(sum(co2e_t), 0), count(*) into gross, item_count
  from batch_items where batch_id = p_batch_id;

  if item_count = 0 then
    raise exception 'Chưa có thửa nào trong vụ này có kết quả tính giảm phát thải dương';
  end if;

  update credit_batches
  set gross_co2e_t = gross,
      issuable_co2e_t = round(gross * (1 - buffer_pct / 100), 4)
  where id = p_batch_id;

  update field_seasons set is_locked = true
  where id in (select field_season_id from batch_items where batch_id = p_batch_id);

  return jsonb_build_object('items', item_count, 'gross_co2e_t', gross);
end;
$$;

-- Mở khoá để sửa nhật ký; kết quả tính cũ mất hiệu lực nên buộc phải tính lại.
create function unlock_field_season(p_field_season_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare coop uuid;
begin
  select cooperative_id into coop from field_seasons where id = p_field_season_id;
  if coop is null then raise exception 'Không tìm thấy thửa-vụ'; end if;
  if not (app_is_admin() or coop = app_coop_id()) then
    raise exception 'Không có quyền thao tác trên thửa-vụ này';
  end if;
  if exists (
    select 1 from batch_items bi
    join credit_batches b on b.id = bi.batch_id
    where bi.field_season_id = p_field_season_id and b.status in ('listed', 'sold', 'verified')
  ) then
    raise exception 'Thửa-vụ này nằm trong lô đã xác minh hoặc đã chào bán, không mở khoá được';
  end if;

  update field_seasons set is_locked = false where id = p_field_season_id;
  update emission_calculations set is_current = false
  where field_season_id = p_field_season_id and is_current;
end;
$$;

-- ---------------------------------------------------------------- đơn hàng
create function place_order(
  p_batch_id uuid, p_quantity numeric, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b credit_batches%rowtype;
  me uuid := auth.uid();
  available numeric;
  new_id uuid;
begin
  if me is null then raise exception 'Chưa đăng nhập'; end if;
  if (select role from profiles where id = me) <> 'buyer' then
    raise exception 'Chỉ tài khoản doanh nghiệp mới đặt mua được';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Khối lượng phải lớn hơn 0'; end if;

  -- Khoá dòng lô để hai đơn đặt cùng lúc không cùng bán một lượng tín chỉ.
  select * into b from credit_batches where id = p_batch_id for update;
  if b.id is null then raise exception 'Không tìm thấy lô tín chỉ'; end if;
  if b.status <> 'listed' then raise exception 'Lô này hiện không chào bán'; end if;
  if b.price_per_t_vnd is null then raise exception 'Lô chưa có giá bán'; end if;

  available := b.issuable_co2e_t - b.sold_co2e_t
    - coalesce((select sum(quantity_co2e_t) from orders
                where batch_id = b.id and status in ('pending', 'awaiting_payment')), 0);

  if p_quantity > available then
    raise exception 'Lô chỉ còn % tCO2e khả dụng', round(available, 4);
  end if;

  insert into orders (code, batch_id, buyer_id, quantity_co2e_t, unit_price_vnd, total_vnd, status, buyer_note)
  values ('DH-' || to_char(now(), 'YYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
          p_batch_id, me, p_quantity, b.price_per_t_vnd,
          round(p_quantity * b.price_per_t_vnd, 2), 'awaiting_payment', nullif(p_note, ''))
  returning id into new_id;

  insert into payments (order_id, provider, amount_vnd, status)
  values (new_id, 'sandbox', round(p_quantity * b.price_per_t_vnd, 2), 'pending');

  return new_id;
end;
$$;

-- Thanh toán thử. Chỉ cập nhật trạng thái và ghi bảng chia doanh thu; khi cắm cổng
-- thanh toán thật, chỗ gọi hàm này được thay bằng webhook của nhà cung cấp.
create function settle_sandbox_payment(p_order_id uuid, p_succeed boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders%rowtype;
  b credit_batches%rowtype;
  platform numeric; coop_amount numeric; farmer_amount numeric;
  alloc jsonb;
begin
  select * into o from orders where id = p_order_id for update;
  if o.id is null then raise exception 'Không tìm thấy đơn hàng'; end if;
  if not (o.buyer_id = auth.uid() or app_is_admin()) then
    raise exception 'Không có quyền thanh toán đơn này';
  end if;
  if o.status <> 'awaiting_payment' then raise exception 'Đơn hàng không ở trạng thái chờ thanh toán'; end if;

  if not p_succeed then
    update payments set status = 'failed', failure_reason = 'Giả lập thanh toán thất bại'
    where order_id = o.id and status = 'pending';
    return jsonb_build_object('status', 'failed');
  end if;

  select * into b from credit_batches where id = o.batch_id for update;

  platform := round(o.total_vnd * b.platform_fee_pct / 100, 2);
  coop_amount := round(o.total_vnd * b.coop_admin_fee_pct / 100, 2);
  farmer_amount := o.total_vnd - platform - coop_amount;

  -- Chia phần nông dân theo đúng tỷ lệ đóng góp giảm phát thải của từng hộ trong lô.
  select coalesce(jsonb_agg(jsonb_build_object(
           'farmer_id', t.farmer_id, 'farmer_name', t.full_name,
           'co2e_t', t.co2e_t, 'amount_vnd', round(farmer_amount * t.co2e_t / nullif(t.total, 0), 2))), '[]'::jsonb)
  into alloc
  from (
    select fa.id as farmer_id, fa.full_name, sum(bi.co2e_t) as co2e_t,
           sum(sum(bi.co2e_t)) over () as total
    from batch_items bi
    join field_seasons fs on fs.id = bi.field_season_id
    join fields f on f.id = fs.field_id
    join farmers fa on fa.id = f.farmer_id
    where bi.batch_id = b.id
    group by fa.id, fa.full_name
  ) t;

  update payments set status = 'succeeded', paid_at = now(),
         provider_ref = 'SANDBOX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  where order_id = o.id and status = 'pending';

  update orders set status = 'paid' where id = o.id;
  update credit_batches set sold_co2e_t = sold_co2e_t + o.quantity_co2e_t where id = b.id;
  update credit_batches set status = 'sold'
  where id = b.id and sold_co2e_t >= issuable_co2e_t;

  insert into revenue_shares (order_id, platform_amount_vnd, cooperative_amount_vnd, farmer_amount_vnd, breakdown)
  values (o.id, platform, coop_amount, farmer_amount,
          jsonb_build_object('platform_fee_pct', b.platform_fee_pct,
                             'coop_admin_fee_pct', b.coop_admin_fee_pct,
                             'farmers', alloc))
  on conflict (order_id) do nothing;

  return jsonb_build_object('status', 'succeeded', 'platform', platform,
                            'cooperative', coop_amount, 'farmer', farmer_amount);
end;
$$;
