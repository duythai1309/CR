-- Tài khoản cho bộ e2e của nền tảng dự án (`tests/e2e/project-platform.test.ts`).
-- Cùng khuôn với `supabase/seed-test-users.sql`: tạo thẳng ở đây với trạng thái đã xác
-- nhận email, vì đăng ký qua API sẽ gửi thư xác nhận và bị giới hạn tần suất.
--
-- CHỈ chạy trên project phát triển. UUID cố định để chạy lại nhiều lần không sinh thêm
-- tài khoản rác.
--
-- Bốn tài khoản nghiệp vụ mang vai trò toàn cục `coop_staff` và KHÔNG thuộc hợp tác xã
-- nào — đúng hình dạng của tài khoản nền tảng dự án theo
-- `docs/design/auth-role-design.md` §1. Tài khoản thứ năm là quản trị nền tảng dùng để
-- kiểm thử phiên hỗ trợ và không được thêm vào project_members.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone_change, phone_change_token,
  reauthentication_token, is_sso_user, is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000000', 'e2e00000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'duan-owner@test.local',
   crypt('MatKhau12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"E2E Chủ dự án","role":"coop_staff"}'::jsonb,
   now(), now(), '', '', '', '', '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'e2e00000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'duan-dev@test.local',
   crypt('MatKhau12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"E2E Đơn vị phát triển","role":"coop_staff"}'::jsonb,
   now(), now(), '', '', '', '', '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'e2e00000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'duan-viewer@test.local',
   crypt('MatKhau12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"E2E Người xem","role":"coop_staff"}'::jsonb,
   now(), now(), '', '', '', '', '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'e2e00000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'duan-outsider@test.local',
   crypt('MatKhau12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"E2E Người ngoài","role":"coop_staff"}'::jsonb,
   now(), now(), '', '', '', '', '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000', 'e2e00000-0000-4000-8000-000000000005',
   'authenticated', 'authenticated', 'duan-admin@test.local',
   crypt('MatKhau12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"E2E Quản trị nền tảng","role":"coop_staff"}'::jsonb,
   now(), now(), '', '', '', '', '', '', '', '', false, false)
on conflict (id) do nothing;

-- Trigger on_auth_user_created tự tạo hồ sơ tương ứng trong public.profiles.

-- Không đặt platform_admin trong metadata: handle_new_user của 0012 chỉ tin whitelist,
-- còn 0018 bỏ hẳn role từ metadata. Đặc quyền chỉ được cấp qua đường DB tin cậy này.
update public.profiles
set role = 'platform_admin'
where id = 'e2e00000-0000-4000-8000-000000000005';
