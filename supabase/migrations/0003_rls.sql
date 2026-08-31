-- Row Level Security. Bảo mật đặt ở tầng cơ sở dữ liệu chứ không ở tầng ứng dụng:
-- kể cả khi mã Next.js có lỗi, Postgres vẫn từ chối dữ liệu ngoài phạm vi.

-- Hàm trợ giúp chạy security definer để tránh đệ quy khi policy của bảng profiles
-- lại phải đọc chính bảng profiles.
create function app_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function app_coop_id() returns uuid
language sql stable security definer set search_path = public as $$
  select cooperative_id from public.profiles where id = auth.uid()
$$;

create function app_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'platform_admin', false)
$$;

-- Người dùng tự sửa hồ sơ được, nhưng không tự nâng quyền hay tự chuyển HTX.
create function guard_profile_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if app_is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.cooperative_id is distinct from old.cooperative_id then
    raise exception 'Không thể tự thay đổi vai trò hoặc hợp tác xã';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_escalation
  before update on profiles
  for each row execute function guard_profile_escalation();

alter table cooperatives enable row level security;
alter table profiles enable row level security;
alter table farmers enable row level security;
alter table fields enable row level security;
alter table seasons enable row level security;
alter table field_seasons enable row level security;
alter table water_events enable row level security;
alter table fertilizer_applications enable row level security;
alter table straw_management enable row level security;
alter table evidence_photos enable row level security;
alter table emission_factors enable row level security;
alter table emission_calculations enable row level security;
alter table credit_batches enable row level security;
alter table batch_items enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table revenue_shares enable row level security;

-- ---------------------------------------------------------------- profiles
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or app_is_admin() or (cooperative_id is not null and cooperative_id = app_coop_id()));

create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or app_is_admin())
  with check (id = auth.uid() or app_is_admin());

-- ---------------------------------------------------------------- cooperatives
-- HTX thấy chính mình; doanh nghiệp thấy HTX nào đang chào bán tín chỉ,
-- vì họ cần biết nguồn gốc lô hàng.
create policy cooperatives_select on cooperatives for select to authenticated
  using (
    id = app_coop_id()
    or app_is_admin()
    or exists (
      select 1 from credit_batches b
      where b.cooperative_id = cooperatives.id and b.status in ('listed', 'sold')
    )
  );

create policy cooperatives_insert on cooperatives for insert to authenticated
  with check (app_is_admin() or app_user_role() = 'coop_manager');

create policy cooperatives_update on cooperatives for update to authenticated
  using (app_is_admin() or (id = app_coop_id() and app_user_role() = 'coop_manager'))
  with check (app_is_admin() or (id = app_coop_id() and app_user_role() = 'coop_manager'));

-- ---------------------------------------------------------------- dữ liệu thuộc HTX
-- Cùng một khuôn: chỉ đọc/ghi trong phạm vi HTX của mình.
do $$
declare t text;
begin
  foreach t in array array[
    'farmers', 'fields', 'seasons', 'field_seasons',
    'water_events', 'fertilizer_applications', 'straw_management',
    'evidence_photos', 'emission_calculations'
  ] loop
    execute format($f$
      create policy %1$s_coop_select on %1$s for select to authenticated
        using (cooperative_id = app_coop_id() or app_is_admin());
      create policy %1$s_coop_insert on %1$s for insert to authenticated
        with check (cooperative_id = app_coop_id() or app_is_admin());
      create policy %1$s_coop_update on %1$s for update to authenticated
        using (cooperative_id = app_coop_id() or app_is_admin())
        with check (cooperative_id = app_coop_id() or app_is_admin());
      create policy %1$s_coop_delete on %1$s for delete to authenticated
        using (cooperative_id = app_coop_id() or app_is_admin());
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- hệ số phát thải
-- Ai đăng nhập cũng tra được hệ số — minh bạch phương pháp luận là điểm bán hàng.
create policy emission_factors_select on emission_factors for select to authenticated using (true);
create policy emission_factors_write on emission_factors for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

-- ---------------------------------------------------------------- lô tín chỉ
create policy credit_batches_select on credit_batches for select to authenticated
  using (
    cooperative_id = app_coop_id()
    or app_is_admin()
    or (status in ('listed', 'sold') and app_user_role() = 'buyer')
  );

create policy credit_batches_write on credit_batches for all to authenticated
  using (app_is_admin() or (cooperative_id = app_coop_id() and app_user_role() = 'coop_manager'))
  with check (app_is_admin() or (cooperative_id = app_coop_id() and app_user_role() = 'coop_manager'));

-- Chi tiết từng thửa trong lô là dữ liệu nông hộ, chỉ HTX sở hữu và admin xem được.
create policy batch_items_all on batch_items for all to authenticated
  using (exists (
    select 1 from credit_batches b
    where b.id = batch_items.batch_id and (b.cooperative_id = app_coop_id() or app_is_admin())
  ))
  with check (exists (
    select 1 from credit_batches b
    where b.id = batch_items.batch_id and (b.cooperative_id = app_coop_id() or app_is_admin())
  ));

-- ---------------------------------------------------------------- đơn hàng
create policy orders_select on orders for select to authenticated
  using (
    buyer_id = auth.uid()
    or app_is_admin()
    or exists (select 1 from credit_batches b where b.id = orders.batch_id and b.cooperative_id = app_coop_id())
  );

-- Doanh nghiệp chỉ đặt được cho chính mình, và chỉ trên lô đang chào bán.
create policy orders_insert on orders for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and app_user_role() = 'buyer'
    and exists (select 1 from credit_batches b where b.id = orders.batch_id and b.status = 'listed')
  );

create policy orders_update on orders for update to authenticated
  using (buyer_id = auth.uid() or app_is_admin())
  with check (buyer_id = auth.uid() or app_is_admin());

create policy payments_select on payments for select to authenticated
  using (exists (
    select 1 from orders o where o.id = payments.order_id
      and (o.buyer_id = auth.uid() or app_is_admin())
  ));

create policy payments_write on payments for all to authenticated
  using (exists (select 1 from orders o where o.id = payments.order_id and (o.buyer_id = auth.uid() or app_is_admin())))
  with check (exists (select 1 from orders o where o.id = payments.order_id and (o.buyer_id = auth.uid() or app_is_admin())));

-- Bảng chia doanh thu là chuyện giữa HTX và nền tảng, bên mua không cần thấy.
create policy revenue_shares_select on revenue_shares for select to authenticated
  using (exists (
    select 1 from orders o join credit_batches b on b.id = o.batch_id
    where o.id = revenue_shares.order_id and (b.cooperative_id = app_coop_id() or app_is_admin())
  ));
