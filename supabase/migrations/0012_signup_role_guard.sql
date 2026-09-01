-- Chặn tự nâng quyền ngay ở đường đăng ký.
--
-- Trước bản vá này, `handle_new_user` lấy vai trò thẳng từ `raw_user_meta_data`:
--
--     coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'coop_staff')
--
-- Server action `signUp` có kiểm tra chỉ cho chọn `coop_manager` hoặc `buyer`,
-- nhưng kiểm tra đó nằm ở tầng Next.js. `supabase.auth.signUp()` là API công khai,
-- gọi được bằng chính anon key có sẵn trong bundle trình duyệt, nên bỏ qua tầng đó
-- dễ dàng:
--
--     supabase.auth.signUp({ email, password,
--       options: { data: { role: 'platform_admin' } } })
--
-- Kết quả là một tài khoản `platform_admin`, và `app_is_admin()` mở toàn bộ RLS:
-- mọi hợp tác xã, mọi nông hộ, mọi bảng chia doanh thu. `guard_profile_escalation`
-- không bắt được vì nó chỉ canh UPDATE, còn đây là INSERT lúc tạo hồ sơ.
--
-- Bản vá đặt danh sách vai trò tự đăng ký được vào ngay trong trigger. Vai trò
-- ngoài danh sách không bị báo lỗi mà bị hạ về mức thấp nhất — người đăng ký thật
-- thà không nên thấy thông báo lạ, còn người dò tìm thì không nhận được tín hiệu
-- nào cho biết mình đã chạm đúng chỗ.
--
-- `platform_admin` từ nay chỉ cấp được từ phía máy chủ, bằng truy cập cơ sở dữ liệu
-- trực tiếp.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  assigned user_role;
begin
  assigned := case requested
    when 'coop_manager' then 'coop_manager'::user_role
    when 'coop_staff' then 'coop_staff'::user_role
    when 'buyer' then 'buyer'::user_role
    else 'coop_staff'::user_role
  end;

  insert into public.profiles (id, full_name, phone, role, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    assigned,
    new.raw_user_meta_data ->> 'company_name'
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
