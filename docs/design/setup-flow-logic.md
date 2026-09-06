# Logic cho luồng khởi tạo dự án

Luồng khởi tạo lưu dần vào `projects.setup`: ý tưởng, mô tả, đánh giá khả thi có AI hỗ
trợ và gợi ý Standard/Methodology. Nó dẫn dắt bốn bước đầu của workflow hiện hữu, không
thêm stage và không thay đổi `approve_project_stage`.

## Hợp đồng tầng ứng dụng

- `getProjectSetup(projectId)` đọc setup bằng phiên người dùng sau khi kiểm membership.
- `saveIdea(projectId, idea)` và `saveDescription(projectId, text)` lưu đầu vào của người.
- `saveFeasibilityNotes(projectId, notes)` chỉ lưu nhận định do chuyên gia tự viết.
- `runFeasibilityAssist(projectId)` cấu trúc `known` và `gaps` từ setup cùng catalog.
- `runSelectionAdvice(projectId)` dùng chính handler `goi_y_methodology`, sau đó nhờ model
  giải thích độ khớp trên tập ứng viên đã được DB trả về.

Mọi thao tác dự án dùng user-scoped Supabase client và chịu RLS. Bản ghi được merge với
setup mới nhất thay vì ghi đè các bước khác, rồi revalidate các trang dự án liên quan.

## Ranh giới đánh giá khả thi

AI chỉ được cấu trúc điều đã biết, điều còn thiếu và bằng chứng cần thu thập. System prompt
cấm phán quyết khả thi, chấm điểm hoặc suy diễn yêu cầu Standard từ trí nhớ. Sau model còn
có hai cổng kiểm tra: quét đệ quy các forbidden key từ `FORBIDDEN_FEASIBILITY_KEYS`, và
từ chối câu mang nghĩa phán quyết như “dự án khả thi/không khả thi” hay “đủ điều kiện”.
Kết luận duy nhất được phép nằm trong `notes`, do người dùng tự viết.
`known[]` được server dựng canonical từ chính các field người dùng đã lưu; fact tự do do
model thêm vào không được ghi xuống hồ sơ.

## Grounding lựa chọn Methodology

Handler hiện hữu trả identity, `project_type`, tên và tóm tắt field từ `metric_schema`.
Model chỉ chọn `methodology_id` trong allowlist đó và viết `why`; server hydrate lại code,
version, Standard và cờ sample từ kết quả DB, không tin identity do model tạo. Khi có bất
kỳ ứng viên sample nào, disclaimer bắt buộc phải có và không được rỗng.
`why` cũng bị từ chối nếu không viện dẫn project type, code/name hoặc field trong catalog.

## Trạng thái migration

Mã giả định migration `0017_project_setup.sql` đã tồn tại nhưng không tự áp nó. Trước khi
0017 được duyệt và áp, thao tác đọc/ghi `projects.setup` trên môi trường thật sẽ chưa hoạt
động; lỗi này phải được trả về giao diện bằng thông báo rõ ràng.
