-- Thu hồi EXECUTE, đưa về đúng trạng thái trước 0023.
--
-- CẢNH BÁO: chạy file này sẽ làm mọi lượt ghi `projects.setup` hỏng trở lại với thông báo
-- `permission denied for function project_validate_setup`. Đó là trạng thái lỗi mà 0023
-- sửa, không phải một cấu hình an toàn hơn.

revoke execute on function public.project_validate_setup(jsonb) from authenticated;
