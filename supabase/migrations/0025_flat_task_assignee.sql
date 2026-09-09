-- 0025 — Giao việc được cho MỌI thành viên dự án.
--
-- 0022 đã gỡ phân biệt vai trò khỏi các hàm `security definer`. Nhưng một ràng buộc
-- vẫn sống ở tầng bảng và không hàm nào bỏ qua được:
--
--   assignee_role text not null default 'developer' check (assignee_role = 'developer')
--   foreign key (project_id, assignee_id, assignee_role)
--     references project_members(project_id, user_id, role)
--
-- Cột hằng cộng khoá ngoại ba cột nghĩa là: chỉ hàng `project_members` có role đúng
-- bằng 'developer' mới nhận được việc. Chủ dự án tự lập dự án cũng không tự giao việc
-- cho mình được, và đổi role của một người đang giữ việc thì Postgres trả 23503.
--
-- Thay bằng khoá ngoại HAI cột tới khoá chính `project_members(project_id, user_id)`.
-- Điều được giữ lại đúng là điều cần giữ: người nhận việc phải là thành viên CỦA CHÍNH
-- dự án đó. Điều được gỡ là phân biệt giữa các vai trò.
--
-- Cột `assignee_role` giữ nguyên (not null default 'developer') thay vì xoá: không chỗ
-- nào trong ứng dụng ghi nó, `src/types/database.ts` được sinh từ DB nên xoá cột sẽ kéo
-- theo một lượt sinh lại kiểu không liên quan tới thay đổi này. Sau migration này nó là
-- cột chết, không còn quyết định gì.

alter table public.project_tasks
  drop constraint project_tasks_project_id_assignee_id_assignee_role_fkey;

alter table public.project_tasks
  drop constraint project_tasks_assignee_role_check;

alter table public.project_tasks
  add constraint project_tasks_assignee_member_fkey
  foreign key (project_id, assignee_id)
  references public.project_members(project_id, user_id)
  on delete restrict;

comment on column public.project_tasks.assignee_role is
  'Cột chết từ 0025. Việc giao được cho mọi thành viên; ràng buộc thật là project_tasks_assignee_member_fkey.';
