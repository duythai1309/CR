-- Danh tính thành viên dự án — lấp mục C5 (P1) trong docs/design/schema-review-findings.md.
--
-- Vấn đề: policy `profiles_select` (0003_rls.sql:59-60) chỉ cho đọc hồ sơ của chính mình,
-- của quản trị nền tảng, hoặc của người CÙNG `cooperative_id`. Nền tảng dự án cố ý không
-- gắn hợp tác xã (0013_project_platform.sql:669-671 cho mọi tài khoản có profile tạo dự
-- án), nên hai thành viên cùng một dự án thường không đọc được tên nhau. Hệ quả: danh
-- sách thành viên và assignee hiện UUID trống tên, và chủ dự án không mời được ai vì phải
-- biết trước UUID.
--
-- Cách chữa: KHÔNG nới `profiles_select` toàn cục — đó là đường rò danh bạ cả nền tảng
-- (bảng profiles có cả `phone`). Thay vào đó mở đúng hai cửa hẹp bằng SECURITY DEFINER,
-- mỗi cửa tự kiểm tư cách thành viên trước khi trả dữ liệu.
--
-- Theo khuôn 0013: set search_path = public, revoke từ public/anon, grant cho
-- authenticated. Không BEGIN/COMMIT — runner sở hữu transaction (chốt ở mục C8).

-- ---------------------------------------------------------------- danh bạ trong dự án
-- Trả thành viên của MỘT dự án cho người gọi CŨNG là thành viên dự án đó.
--
-- `email` chỉ trả cho owner. Thành viên thường thấy tên để hiển thị assignee và tác giả
-- bình luận; địa chỉ liên hệ là dữ liệu định danh, chỉ người quản lý thành viên mới cần.
-- Cột `phone` không bao giờ được trả ra ở đây.
create function public.project_member_directory(p_project_id uuid)
returns table (user_id uuid, full_name text, role text, email text)
language sql stable security definer set search_path = public as $$
  select m.user_id,
         p.full_name,
         m.role,
         case when public.app_project_role(p_project_id) = 'owner' then u.email end
  from public.project_members m
  join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.project_id = p_project_id
    and public.app_project_role(p_project_id) is not null
  order by case m.role when 'owner' then 0 when 'developer' then 1 else 2 end, p.full_name
$$;

-- ---------------------------------------------------------------- tra người để mời
-- Đối chiếu email CHÍNH XÁC (không LIKE, không tiền tố) để trả về tối đa một dòng.
--
-- Hàm này là một oracle liệt kê người dùng, nên bị siết ba tầng:
--   1. Chỉ owner của ĐÚNG dự án truyền vào mới gọi được — không có "tra người chung".
--   2. So khớp bằng lower(email) tuyệt đối; không có ký tự đại diện nào đi qua được.
--   3. Chỉ trả `user_id`, `full_name` và `already_member`. Không trả `phone`,
--      `cooperative_id`, `role` toàn cục hay bất cứ thứ gì khác.
-- Không tìm thấy thì trả 0 dòng — người gọi không phân biệt được "không có tài khoản"
-- với "có nhưng bị lọc", vì cả hai đều là tập rỗng.
create function public.project_lookup_invitee(p_project_id uuid, p_email text)
returns table (user_id uuid, full_name text, already_member boolean)
language plpgsql stable security definer set search_path = public as $$
declare normalized text := lower(trim(coalesce(p_email, '')));
begin
  if public.app_project_role(p_project_id) is distinct from 'owner' then
    raise exception 'Chỉ owner của dự án được tra cứu người để mời';
  end if;
  if normalized = '' or length(normalized) > 320 then
    raise exception 'Email không hợp lệ';
  end if;

  return query
    select p.id,
           p.full_name,
           exists (select 1 from public.project_members m
                   where m.project_id = p_project_id and m.user_id = p.id)
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = normalized;
end;
$$;

-- ---------------------------------------------------------------- quyền
-- Khuôn 0007_harden.sql:63-78 và 0013_project_platform.sql:977-995: thu khỏi PUBLIC
-- (mặc định PostgreSQL cấp EXECUTE cho PUBLIC, chỉ thu từ anon là chưa đủ), rồi cấp lại
-- đúng vai trò cần dùng. Không cấp cho service_role: đây là đường của người dùng thật.
revoke all on function public.project_member_directory(uuid),
  public.project_lookup_invitee(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.project_member_directory(uuid),
  public.project_lookup_invitee(uuid, text)
  to authenticated;
