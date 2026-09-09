-- 0028 — Bỏ tính năng duyệt mục hồ sơ.
--
-- Quyết định sản phẩm (09/09/2026): dự án không còn khái niệm duyệt. Bảy mục hồ sơ chỉ
-- có hai trạng thái — đã có nội dung hoặc chưa — và trạng thái đó suy ra từ chính nội
-- dung, không từ một lượt bấm nút.
--
-- GỠ hai hàm là đủ để tính năng biến mất: `approved_at` chỉ được ghi bởi
-- `approve_project_stage`, nên khi hàm đó không còn, hai cột đóng băng vĩnh viễn.
--
-- GIỮ hai cột `approved_at` / `approved_by` cùng ràng buộc check đi kèm, vì:
--   1. 50 trong 168 dòng `project_stages` đang mang lượt duyệt có thật. Xoá cột là xoá
--      lịch sử của người dùng, mà yêu cầu là bỏ TÍNH NĂNG chứ không phải xoá dữ liệu.
--   2. `src/types/database.ts` sinh từ DB; xoá cột kéo theo một lượt sinh lại kiểu không
--      liên quan gì tới thay đổi này.
-- Tầng ứng dụng đã ngừng đọc chúng: `toStageView` không map `approved_at` nữa, và
-- `tests/project-rules.test.ts` có ca canh để nó không lặng lẽ rò trở lại.
--
-- KHÔNG có đường ghi nào khác bị ảnh hưởng: `create_monitoring_period` xưa nay chỉ đòi
-- `methodology_locked_at` và baseline hợp lệ, chưa bao giờ đòi mục hồ sơ nào đã duyệt.

drop function if exists public.approve_project_stage(uuid, smallint);
drop function if exists public.project_stage_approval_directory(uuid);

comment on column public.project_stages.approved_at is
  'Cột chết từ 0028. Giữ lịch sử duyệt cũ; không đường nào ghi thêm được nữa.';
comment on column public.project_stages.approved_by is
  'Cột chết từ 0028. Giữ lịch sử duyệt cũ; không đường nào ghi thêm được nữa.';
