# Kế hoạch gỡ module HTX và mua bán tín chỉ

Ngày soạn: 06/09/2026. Tài liệu này đi kèm
`supabase/migrations/0016_drop_legacy.sql`. Migration mới chỉ là đề xuất trong repo;
chưa được và không được áp lên Supabase cho tới khi người dùng duyệt mất dữ liệu và
xác nhận bản sao lưu có thể khôi phục.

## Giá phải trả

Áp `0016` sẽ xoá vĩnh viễn toàn bộ dữ liệu nghiệp vụ cũ. Trên database dev hiện tại,
phạm vi đã biết gồm 1 hợp tác xã, khoảng 21 nông hộ, 27 thửa ruộng, 10 mùa vụ, các
thửa-vụ và nhật ký nước/phân/rơm, ảnh bằng chứng, các bản tính MRV cùng bộ hệ số,
lô tín chỉ và chi tiết lô, đơn hàng, thanh toán, dữ liệu chia doanh thu. Mọi file trong
bucket Storage `evidence` cũng bị xoá.

Đây là thao tác không hoàn tác được bằng migration down. Git chỉ khôi phục được câu
lệnh và mã nguồn, không khôi phục được hàng dữ liệu hoặc object Storage đã mất.

Các dữ liệu được giữ gồm `auth.users`, `profiles` và danh tính người dùng, lịch sử/cấu
hình chat, cùng toàn bộ Standard, methodology, dự án, thành viên, task, tài liệu,
Monitoring và MRV report của nền tảng mới. `profiles.cooperative_id` và
`chat_conversations.cooperative_id` sẽ bị bỏ; hội thoại vẫn còn nhưng không còn snapshot
HTX cũ. Enum `user_role` tạm thời được giữ vì `profiles.role`, auth và quyền admin vẫn
đang phụ thuộc nó.

## Sao lưu bắt buộc trước khi áp

1. Đóng băng ghi lên module legacy trong thời gian sao lưu để database dump và Storage
   không lệch thời điểm.
2. Tạo database backup đầy đủ bằng cơ chế backup/PITR của Supabase, đồng thời xuất một
   logical dump gồm schema và data. Có thể dùng `pg_dump --format=custom` với connection
   string lấy trực tiếp từ project; hoặc chạy hai bản Supabase CLI riêng: một
   `supabase db dump --linked` cho schema và một lệnh có thêm hai cờ `--data-only` và
   `--use-copy` cho data. Ghi output ra thư mục backup ngoài repo và không ghi connection
   string vào repo.
3. Xuất riêng các bảng legacy nêu ở trên dưới dạng CSV hoặc custom-format dump để còn
   khả năng đối chiếu nghiệp vụ sau này. Xuất cả `profiles.id` và `cooperative_id` trước
   khi cột liên kết bị bỏ.
4. Tải toàn bộ bucket `evidence`, giữ nguyên object path và metadata. Database dump chỉ
   chứa metadata trong schema `storage`; nó không chứa binary của file trong bucket.
5. Lưu checksum, thời điểm snapshot, project ref và phiên bản migration cùng bản backup
   trong kho mã hoá, tách khỏi Supabase project đang thao tác.
6. Khôi phục thử database dump vào một project/local Postgres tách biệt và kiểm đếm ít
   nhất các bảng `cooperatives`, `farmers`, `fields`, `seasons`,
   `emission_calculations`, `credit_batches`, `orders`; tải thử một object `evidence`.
   Chỉ xin duyệt áp migration sau khi phép khôi phục thử thành công.

Không chạy `supabase db push`, `supabase migration up`, `apply_migration` hay dán SQL
vào Dashboard trong bước soạn thảo này.

## Thứ tự an toàn trong `0016`

Migration tháo policy của bucket `evidence`, xoá object rồi mới xoá bucket. Tiếp theo nó
thay `profiles_select`, bỏ `chat_conversations.cooperative_id`, sửa trigger bảo vệ
profile và bỏ `profiles.cooperative_id`. Việc này cắt hai FK cần giữ trước khi xóa
`cooperatives`; riêng policy `cooperatives_select` được bỏ sớm vì tham chiếu
`credit_batches`.

Sau đó migration bỏ view, RPC và helper gắn với HTX/market; tháo trigger nhật ký; drop
bảng theo thứ tự từ bảng lá (`revenue_shares`, `payments`, `orders`, `batch_items`) về
bảng cha (`credit_batches`, nhật ký, thửa-vụ, mùa vụ, thửa, nông hộ, `cooperatives`);
cuối cùng mới drop các enum không còn được dùng. Mọi `DROP` đều dùng `RESTRICT`, không
dùng `CASCADE`: nếu audit bỏ sót một phụ thuộc, migration phải dừng và rollback thay vì
âm thầm xoá thêm đối tượng ngoài phạm vi.

`profiles`, `user_role`, `handle_new_user`, `profiles_guard_escalation`, `app_is_admin`,
toàn bộ bảng/hàm chat và schema dự án 0013–0015 được giữ. PostGIS cũng được giữ như hạ
tầng dùng chung tiềm năng cho ranh giới dự án carbon, không bị coi là dữ liệu HTX.
