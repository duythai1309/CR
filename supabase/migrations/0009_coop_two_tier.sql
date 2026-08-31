-- Tạo hợp tác xã theo cơ cấu hành chính hai cấp (tỉnh/thành phố → xã/phường)
-- và ghi nhận vùng miền để chọn đúng hệ số phát thải nền.
drop function if exists create_cooperative_and_join(text, text, text, text, text, text, text);

create function create_cooperative_and_join(
  p_name text, p_code text, p_province text, p_region vn_region,
  p_commune text default null,
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
  if p_region is null then raise exception 'Chưa chọn vùng miền'; end if;

  insert into cooperatives (name, code, province, commune, region, contact_name, contact_phone)
  values (p_name, upper(trim(p_code)), p_province, nullif(p_commune, ''), p_region,
          nullif(p_contact_name, ''), nullif(p_contact_phone, ''))
  returning id into new_id;

  perform set_config('app.bypass_profile_guard', 'on', true);
  update profiles set cooperative_id = new_id, role = 'coop_manager' where id = me;
  return new_id;
end;
$$;

revoke all on function create_cooperative_and_join(text, text, text, vn_region, text, text, text) from public;
grant execute on function create_cooperative_and_join(text, text, text, vn_region, text, text, text) to authenticated;
