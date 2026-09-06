# Quy tắc gọi công cụ của trợ lý Carbon

## Vấn đề từ Eval Platform

Bài đo 54 câu cho thấy Accuracy chỉ đạt 7/12. Ba ca hụt có cùng nguyên nhân: model biết
hoặc đoán được câu trả lời nhưng không lấy bằng chứng từ tool. Nó hỏi lại khi tham số vốn
không bắt buộc, trả lời MRV chung chung, hoặc đọc số bước từ tri thức tĩnh.

## Cổng quyết định

Prompt áp thứ tự sau:

1. Kiểm tra scope/safety trước. Yêu cầu feasibility verdict, bịa dữ liệu, vượt RLS, yêu
   cầu thật của Standard từ trí nhớ, validation/verification/issuance hoặc ngoài phạm vi
   vẫn bị từ chối; không gọi tool để hợp thức hoá yêu cầu bị cấm.
2. Mọi khẳng định kiểm chứng được về hệ thống — số, tên, danh sách, field, đơn vị, trạng
   thái, quyền, điều kiện hay provenance — phải có tool result trong chính lượt đó.
3. Tham số không bắt buộc không phải lý do hỏi lại. Model gọi với dữ liệu đang có hoặc
   object rỗng; handler tự chọn record gần nhất hoặc trả lỗi rõ ràng.
4. Câu trả lời neo bằng “Trong hệ thống này…” hoặc “Theo catalog/dữ liệu hiện có…” và
   nêu ít nhất một giá trị cụ thể từ kết quả.
5. Chỉ khái niệm chung như “PDD là gì?” và điều hướng thuần tuý mới được trả lời chay.

Vì model production vẫn bỏ qua chỉ dẫn prompt trong lần thử live, `routing.ts` còn đặt
một cổng kỹ thuật hẹp. Với intent đọc dữ liệu rõ ràng, vòng model đầu dùng function-calling
mode `ANY` và chỉ cho chọn các tool phù hợp; ngay sau function response, provider trở lại
`AUTO` để model viết câu trả lời. Bộ lọc từ chối chạy trước bộ lọc intent, nên các câu về
feasibility verdict, yêu cầu bên ngoài Standard, bịa dữ liệu, vượt quyền và chủ đề ngoài
phạm vi không bị ép gọi tool.

## Ba ca hồi quy

| Câu hỏi | Tool bắt buộc | Bằng chứng phải dùng |
|---|---|---|
| Quy trình thiết kế dự án có mấy bước? | `liet_ke_du_an` | `buoc_da_duyet` dạng `x/7` hoặc `ghi_chu` |
| Đơn vị của `stock_tc_ha` là gì? | `field_giam_sat_cua_methodology` với args có thể rỗng | `don_vi` của đúng field |
| Báo cáo MRV lấy dữ liệu từ đâu? | `liet_ke_bao_cao_mrv` rồi `doc_vet_tinh_bao_cao` | kỳ, revision/schema hash, factors/source và trace |

Cả 14 tool description đều ghi rõ trigger “PHẢI gọi”. Tập tool và handler không đổi, nên
fixture eval không cần thêm hàm; test hồi quy chạy ba đường gọi trên fixture thật để bảo
đảm mỗi câu có dữ liệu cụ thể và không cần hỏi ngược.

Smoke test gọi model trực tiếp từ source (không qua `.next` cũ) xác nhận:

- câu số bước gọi `liet_ke_du_an`;
- câu đơn vị `stock_tc_ha` gọi `field_giam_sat_cua_methodology`;
- câu nguồn MRV gọi `liet_ke_bao_cao_mrv` rồi `doc_vet_tinh_bao_cao`;
- câu ép kết luận feasibility và hỏi yêu cầu Verra VM0007 đều từ chối với zero tool call.
