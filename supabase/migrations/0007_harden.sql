-- Siết quyền theo kết quả rà soát bảo mật của Supabase.

-- 1. Cố định search_path cho hai hàm trigger còn thiếu, tránh bị chiếm quyền
--    thông qua schema do người gọi tự đặt.
create or replace function sync_field_area() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.geom is not null then
    new.area_ha := round((st_area(new.geom::geography) / 10000)::numeric, 4);
  end if;
  return new;
end;
$$;

create or replace function guard_locked_field_season() returns trigger
language plpgsql set search_path = public as $$
declare
  target uuid;
  locked boolean;
begin
  target := coalesce(new.field_season_id, old.field_season_id);
  select is_locked into locked from field_seasons where id = target;
  if coalesce(locked, false) then
    raise exception 'Thửa-vụ đã khoá vì đã gộp vào lô tín chỉ. Mở khoá trước khi sửa nhật ký.';
  end if;
  return coalesce(new, old);
end;
$$;

-- 3. Hàm trigger không phải là API, không ai gọi trực tiếp được.
--    (Quyền EXECUTE của trigger được kiểm tra lúc tạo trigger, không phải lúc chạy.)
revoke all on function public.handle_new_user() from anon, authenticated;
revoke all on function public.guard_profile_escalation() from anon, authenticated;
revoke all on function public.sync_field_area() from anon, authenticated;
revoke all on function public.guard_locked_field_season() from anon, authenticated;

-- 4. Hàm trợ giúp cho RLS: vai trò authenticated phải giữ EXECUTE vì policy chạy
--    dưới danh nghĩa người truy vấn, nhưng anon thì không cần.
revoke all on function public.app_coop_id() from anon;
revoke all on function public.app_user_role() from anon;
revoke all on function public.app_is_admin() from anon;

-- 5. Các hàm nghiệp vụ đều tự kiểm tra auth.uid(), nhưng chặn sẵn ở lớp quyền
--    thì khách chưa đăng nhập không chạm tới được.
revoke all on function public.create_cooperative_and_join(text, text, text, text, text, text, text) from anon;
revoke all on function public.join_cooperative_by_code(text) from anon;
revoke all on function public.build_credit_batch(uuid) from anon;
revoke all on function public.unlock_field_season(uuid) from anon;
revoke all on function public.place_order(uuid, numeric, text) from anon;
revoke all on function public.settle_sandbox_payment(uuid, boolean) from anon;
revoke all on function public.save_field(uuid, text, jsonb, numeric, text, uuid) from anon;
revoke all on function public.check_field_overlap(geometry, uuid) from anon;

-- Bổ sung: PostgreSQL mặc định cấp EXECUTE cho PUBLIC, nên chỉ thu hồi từ anon là
-- chưa đủ — anon vẫn gọi được qua quyền của PUBLIC. Thu hồi từ PUBLIC rồi cấp lại
-- đúng vai trò cần dùng.
revoke all on function public.handle_new_user() from public;
revoke all on function public.guard_profile_escalation() from public;
revoke all on function public.sync_field_area() from public;
revoke all on function public.guard_locked_field_season() from public;
revoke all on function public.check_field_overlap(geometry, uuid) from public;

revoke all on function public.app_coop_id() from public;
revoke all on function public.app_user_role() from public;
revoke all on function public.app_is_admin() from public;
revoke all on function public.create_cooperative_and_join(text, text, text, text, text, text, text) from public;
revoke all on function public.join_cooperative_by_code(text) from public;
revoke all on function public.build_credit_batch(uuid) from public;
revoke all on function public.unlock_field_season(uuid) from public;
revoke all on function public.place_order(uuid, numeric, text) from public;
revoke all on function public.settle_sandbox_payment(uuid, boolean) from public;
revoke all on function public.save_field(uuid, text, jsonb, numeric, text, uuid) from public;

-- Policy RLS chạy dưới danh nghĩa người truy vấn nên vai trò authenticated bắt buộc
-- phải gọi được ba hàm trợ giúp này.
grant execute on function public.app_coop_id() to authenticated;
grant execute on function public.app_user_role() to authenticated;
grant execute on function public.app_is_admin() to authenticated;

grant execute on function public.create_cooperative_and_join(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.join_cooperative_by_code(text) to authenticated;
grant execute on function public.build_credit_batch(uuid) to authenticated;
grant execute on function public.unlock_field_season(uuid) to authenticated;
grant execute on function public.place_order(uuid, numeric, text) to authenticated;
grant execute on function public.settle_sandbox_payment(uuid, boolean) to authenticated;
grant execute on function public.save_field(uuid, text, jsonb, numeric, text, uuid) to authenticated;

-- Hai mục còn lại trong báo cáo rà soát là của chính extension PostGIS, không sửa được
-- từ migration vì Supabase tự cấp lại quyền cho chúng:
--
--   * `public.spatial_ref_sys` — bảng tra cứu hệ toạ độ EPSG, dữ liệu tham chiếu công
--     khai, không chứa thông tin người dùng.
--   * `public.st_estimatedextent(...)` — hàm ước lượng phạm vi không gian của một bảng.
--
-- Cách xử lý triệt để là cài PostGIS vào schema riêng thay vì `public`; việc đó phải làm
-- từ đầu vì mọi cột `geometry` đang tham chiếu kiểu dữ liệu trong `public`.
