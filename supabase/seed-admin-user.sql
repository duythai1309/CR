-- Tạo tài khoản quản trị nền tảng ĐẦU TIÊN.
--
-- Vì sao phải làm bằng tay: `0012_signup_role_guard` chặn việc nhận vai trò từ
-- metadata lúc đăng ký, nên `platform_admin` không cấp được qua API công khai nữa.
-- Đó là chủ ý — nếu cấp được qua API thì bất kỳ ai cũng tự phong quản trị. Cái giá
-- là tài khoản quản trị đầu tiên phải tạo từ phía máy chủ, và đây là tệp làm việc đó.
--
-- Chạy một lần trên bảng điều khiển Supabase (SQL Editor) hoặc bằng psql.
--
-- ĐỔI EMAIL VÀ MẬT KHẨU BÊN DƯỚI TRƯỚC KHI CHẠY. Mật khẩu trong tệp này nằm trong
-- kho mã, nên ai đọc được repo cũng biết — chỉ dùng để đăng nhập lần đầu rồi đổi
-- ngay trong phần hồ sơ.

-- ---------------------------------------------------------------- 1. Tài khoản
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- GoTrue đọc các cột này dạng chuỗi; để NULL sẽ làm hỏng mọi lượt đăng nhập.
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token, is_sso_user, is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'admin@test.local', crypt('DoiMatKhauNgay2026', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Quản trị nền tảng"}'::jsonb,
  now(), now(), '', '', '', '', '', '', '', '', false, false
)
on conflict (email) do nothing;

-- ---------------------------------------------------------------- 2. Nâng quyền
-- Trigger `on_auth_user_created` vừa tạo hồ sơ với vai trò thấp nhất (`coop_staff`),
-- đúng như bản vá quy định. Nâng lên `platform_admin` phải vượt qua
-- `guard_profile_escalation`, mà hàm đó chỉ cho qua khi người thực hiện đã là quản
-- trị — lúc này chưa có ai. Nên tắt trigger đúng trong khoảng thời gian này.
--
-- Chạy cả khối trong MỘT lần thực thi để trigger không bị bỏ tắt giữa chừng nếu có
-- lỗi ở câu giữa.
alter table profiles disable trigger profiles_guard_escalation;

update profiles
   set role = 'platform_admin'
 where id = (select id from auth.users where email = 'admin@test.local');

alter table profiles enable trigger profiles_guard_escalation;

-- ---------------------------------------------------------------- 3. Kiểm lại
-- Phải trả về đúng một dòng 'platform_admin'.
select u.email, p.role
  from profiles p join auth.users u on u.id = p.id
 where p.role = 'platform_admin';
