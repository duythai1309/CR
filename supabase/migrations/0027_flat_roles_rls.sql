-- 0027 — Hai policy RLS cuối còn so vai trò.
--
-- Quét `pg_policies` sau 0026 còn đúng hai chỗ:
--
--   projects_update       USING/WITH CHECK app_project_role(id) = 'owner'
--   task_comments_delete  USING ... OR app_project_role(project_id) = 'owner'
--
-- `projects_update` là cái nặng: mọi đường lưu dữ liệu dự án đều là UPDATE trên
-- `projects` — ý tưởng, mô tả, đánh giá khả thi, baseline, chọn và khoá
-- Standard/Methodology, xoá mềm. Thành viên không phải owner không lưu được gì cả, và
-- lỗi trả về là "permission denied" nên trông như lỗi cấu hình chứ không như phân quyền.
--
-- Thay bằng `app_project_can_write(id)` — là thành viên VÀ dự án chưa xoá mềm. So với
-- policy cũ, nó mở cho mọi thành viên nhưng SIẾT thêm một điều đúng: dự án đã xoá mềm
-- thì không UPDATE được nữa. Giao diện vốn đã giả định như vậy (`abilitiesFor`), và
-- không có màn nào khôi phục dự án đã xoá, nên không đường nào bị mất.
--
-- Cột được phép UPDATE vẫn do GRANT theo cột quyết định (`0013:918-925`): chỉ
-- name, description, setup, baseline, standard_id, methodology_id, hai cột *_locked_at
-- và deleted_at. 0027 không nới cột nào.
--
-- `task_comments_delete` trước cho tác giả hoặc owner xoá. Nay là tác giả hoặc bất kỳ
-- thành viên nào ghi được — cùng một mức với sửa công việc.

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.app_project_can_write(id))
  with check (public.app_project_can_write(id));

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete to authenticated
  using (public.app_project_can_write(project_id));
