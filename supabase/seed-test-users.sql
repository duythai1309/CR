-- Tài khoản dùng cho bộ kiểm thử tích hợp (`npm run test:e2e`).
-- Chạy một lần trên project phát triển. KHÔNG chạy trên môi trường thật.
--
-- Đăng ký qua API sẽ gửi thư xác nhận và bị giới hạn tần suất, nên tài khoản thử
-- được tạo thẳng ở đây với trạng thái đã xác nhận email.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- GoTrue đọc các cột này dạng chuỗi; để NULL sẽ làm hỏng mọi lượt đăng nhập.
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token, is_sso_user, is_anonymous
)
values
(
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'htx@test.local', crypt('MatKhau12345', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Trần Văn Bảy","phone":"0901234567","role":"coop_manager"}'::jsonb,
  now(), now(), '', '', '', '', '', '', '', '', false, false
),
(
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'dn@test.local', crypt('MatKhau12345', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Lê Thị Hoa","company_name":"Công ty Xuất khẩu Xanh","role":"buyer"}'::jsonb,
  now(), now(), '', '', '', '', '', '', '', '', false, false
)
on conflict do nothing;

-- Trigger on_auth_user_created tự tạo hồ sơ tương ứng trong public.profiles.
