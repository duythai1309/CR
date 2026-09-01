-- Cấu hình trợ lý: chọn nhà cung cấp, model và khoá API ngay trên giao diện quản
-- trị, thay vì phải sửa biến môi trường rồi deploy lại.
--
-- Một dòng duy nhất cho cả nền tảng. Chi phí gọi model do nền tảng chịu (đã tính
-- trong phí 12%), nên không có lý do để mỗi hợp tác xã cấu hình riêng.

create table chat_settings (
  id boolean primary key default true,
  provider text not null default 'gemini',
  model text,
  api_key text,
  -- Bốn ký tự cuối để giao diện hiện "•••• abcd" — đủ để người quản trị nhận ra
  -- mình đã dán khoá nào, mà không phải mở khoá đầy đủ ra.
  api_key_last4 text generated always as (right(api_key, 4)) stored,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id) on delete set null,
  constraint chat_settings_singleton check (id)
);

-- Dòng duy nhất tạo sẵn ngay từ đây, nên ứng dụng chỉ cần quyền update, không cần
-- quyền insert — bề mặt ghi hẹp hơn đúng một bậc.
insert into chat_settings (id) values (true);

create function touch_chat_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger chat_settings_touch
  before update on chat_settings
  for each row execute function touch_chat_settings();

alter table chat_settings enable row level security;

-- RLS quyết định AI được ghi. Đọc thì mở cho mọi tài khoản đã đăng nhập, vì
-- provider và model không phải bí mật — còn khoá API được chặn ở tầng khác, ngay
-- bên dưới.
create policy chat_settings_select on chat_settings for select to authenticated
  using (true);

create policy chat_settings_update on chat_settings for update to authenticated
  using (app_is_admin())
  with check (app_is_admin());

-- Quyền CỘT — đây mới là chỗ giữ khoá API.
--
-- Route trợ lý chạy bằng phiên đăng nhập của người dùng, nên nếu khoá nằm trong một
-- bảng chỉ quản trị viên đọc được thì đúng những người cần dùng trợ lý lại không đọc
-- được khoá; mà mở cho mọi người đọc thì ai cũng lấy được khoá bằng anon key từ
-- trình duyệt. Lối ra là tách theo cột chứ không theo dòng:
--
--   * `api_key` KHÔNG cấp quyền đọc cho bất kỳ vai trò ứng dụng nào — kể cả quản trị
--     nền tảng. Ghi được, không đọc lại được, đúng cách một secret nên hành xử.
--   * Chỉ `service_role` (bỏ qua RLS, dùng ở đúng một hàm phía máy chủ) đọc được.
--
-- Hệ quả cố ý: `select *` trên bảng này sẽ báo lỗi quyền thay vì lặng lẽ trả khoá.
revoke all on table chat_settings from anon, authenticated;

grant select (id, provider, model, api_key_last4, updated_at, updated_by)
  on table chat_settings to authenticated;

grant update (provider, model, api_key, updated_by)
  on table chat_settings to authenticated;

revoke all on function touch_chat_settings() from public;
