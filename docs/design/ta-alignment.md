# TA alignment — đơn vị phát triển dự án carbon chuyên nghiệp

Phạm vi của lần này chỉ là giao diện và ngôn từ. Schema, RPC, policy và dữ liệu DB giữ nguyên; không tạo migration. Giao diện vẫn ưu tiên tiếng Việt, giữ nguyên thuật ngữ mà người làm hồ sơ Verra/Gold Standard dùng khi đọc tài liệu tiếng Anh.

| Khu vực | Lệch trước đây | Đã chỉnh | Lý do |
| --- | --- | --- | --- |
| Khung mọi route `/du-an/[id]` | Standard/Methodology bị ẩn trong workflow | Thêm `MethodologyIdentity`: Standard, mã Methodology, version, `schema_hash` ở mọi màn hình dự án | Đây là định danh cần trích dẫn trong PDD, monitoring plan và trao đổi với VVB |
| Bảy bước | Tên thuần Việt, khẩu ngữ | `Project concept`, `Feasibility assessment`, `Standard selection`, `Methodology selection`, `Baseline scenario`, `Additionality`, `PDD — Project Design Document` | Giữ đúng tên stage trong hồ sơ và checklist chuyên nghiệp |
| Hints/tài liệu | “Tài liệu baseline”, “Báo cáo khả thi” | `Baseline scenario`, `Feasibility assessment`, `Additionality`, `PDD` kèm diễn giải Việt | Không bắt người dùng dịch ngược thuật ngữ chuẩn |
| Methodology mẫu | Disclaimer seed rất dài chiếm màn hình | Dải cảnh báo “Methodology MẪU — chưa thẩm định”, giữ disclaimer đầy đủ qua tooltip | Cảnh báo vẫn bắt buộc nhưng không lấn át thao tác |
| Kanban | Chỉ có board và thao tác kéo thả | Giữ Kanban; thêm lọc `assignee`, `status`, hướng dẫn Tab/Enter | TA quen Jira cần lọc nhanh theo người và trạng thái; bàn phím vẫn dùng được |
| Trace báo cáo | Chỉ hiện vài observation | Trang report detail hiện toàn bộ `calculation_trace`, với aggregation, revision và định danh | Có thể đối chiếu số liệu với VVB và in ra |
| Audit stage | Chỉ có badge “Đã duyệt” | Hiện thời điểm duyệt trong mỗi stage | Làm rõ audit trail đã có trong DB |
| Phạm vi sản phẩm | Dễ hiểu là hồ sơ đã sẵn sàng nộp | Ghi rõ luồng dừng trước consultation, validation/registration, VVB verification, standard review và issuance | Không tạo kỳ vọng sai về trạng thái chứng nhận |

## Thuật ngữ đã chốt

| Tiếng Việt trên UI | Thuật ngữ chuẩn giữ nguyên |
| --- | --- |
| Tài liệu thiết kế dự án | PDD — Project Design Document |
| Kịch bản cơ sở | baseline scenario |
| Tính bổ sung | additionality |
| Kế hoạch giám sát | monitoring plan |
| Trước/sau dự án | ex-ante / ex-post |
| Đơn vị thẩm tra/xác minh | VVB |
| Niên vụ tín chỉ | vintage |
| Bể dự phòng | buffer pool |
| Rò rỉ | leakage |
| Tính lâu dài | permanence |
| Kỳ giám sát | monitoring period |
| Dữ liệu quan sát | observation data |
| Vết tính | calculation trace |
| Bản sửa dữ liệu | data revision |

## Kiểm chứng

`npm run types -- --incremental false`: đạt. `npm run test`: **262/262**, 12 file pass. Không sửa test; thay đổi copy không làm test hiện có phụ thuộc nhãn bị đỏ. `npm run build` được chạy sau khi hoàn tất chỉnh UI.

## Giới hạn do ràng buộc không đổi DB

Không thể hiển thị người duyệt stage, actor đầy đủ hoặc lịch sử thay đổi field trong audit log nếu RPC/query hiện tại không trả các cột đó; lần này chỉ hiển thị `approved_at` đã có. Không thể chọn “effective period” khi nhiều version chồng nhau vì schema không có `supersedes`/quy tắc hiệu lực. Không thể làm export theo template chính thức khi `report_templates` vẫn là placeholder. Không thể tự hiển thị VVB/issuance status vì ngoài phạm vi và chưa có dữ liệu tương ứng. Đây là các mục cần thay đổi schema/RPC hoặc dữ liệu nghiệp vụ sau khi được duyệt, không tự sửa trong lần này.

Không đụng landing page, module `/htx`, `/cho`, `/don-hang`, `/quan-tri`, chat, test e2e hoặc migration `0016_*` của worker-claude.
