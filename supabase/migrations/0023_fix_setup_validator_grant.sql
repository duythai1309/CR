-- Sửa lỗi: lưu dữ liệu khởi tạo dự án chưa bao giờ chạy được trên production.
--
-- Chuỗi lỗi:
--   trigger projects_guard_setup  →  project_guard_setup()      không SECURITY DEFINER
--                                     └─ gọi project_validate_setup()
--
-- Hàm trigger chạy dưới quyền người gọi. `authenticated` không có EXECUTE trên
-- `project_validate_setup`, nên Postgres trả `permission denied for function` cho MỌI
-- lượt ghi `projects.setup`, bất kể vai trò dự án. Đây không phải vấn đề phân quyền —
-- owner cũng hỏng y hệt viewer.
--
-- 0017 tạo hàm kiểm tra nhưng quên cấp EXECUTE. Đã quét toàn bộ trigger trong schema
-- public: đây là chỗ DUY NHẤT dính lỗi này.
--
-- Vì sao cấp EXECUTE thay vì đổi guard thành SECURITY DEFINER: hàm này `immutable`, nhận
-- một jsonb, không đọc bảng nào, không trả dữ liệu, chỉ `raise exception`. Cấp EXECUTE
-- không mở thêm cửa nào. Còn SECURITY DEFINER sẽ nâng quyền một hàm mà ta không cần nâng.

grant execute on function public.project_validate_setup(jsonb) to authenticated;
