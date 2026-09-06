# Mục lục tài liệu dự án Carbon

Mục lục này phân biệt tài liệu hiện hành với bằng chứng lịch sử. “Lịch sử” không có nghĩa
là vô dụng: nó ghi lại lý do và kết quả kiểm chứng tại một thời điểm, nhưng không được dùng
để đảo ngược quyết định carbon-only mới hơn.

## Nên đọc theo thứ tự

1. [`../../README.md`](../../README.md) — sản phẩm hiện là gì, chạy thế nào và giới hạn nào
   phải nói thẳng.
2. [`../../PLAN.md`](../../PLAN.md) — yêu cầu gốc cùng phần trạng thái mới ghi các quyết
   định đã thay thế giả định ban đầu.
3. [`ta-alignment.md`](ta-alignment.md) — thuật ngữ và cách trình bày cho project developer
   chuyên nghiệp.
4. [`schema-project-platform.md`](schema-project-platform.md) — mô hình dữ liệu, RPC, RLS,
   snapshot và `metric_schema` của nền tảng dự án.
5. [`auth-role-design.md`](auth-role-design.md), [`module-a.md`](module-a.md),
   [`module-b.md`](module-b.md) — quyền theo dự án và hai phần sản phẩm.
6. [`chat-carbon-only.md`](chat-carbon-only.md) — trợ lý sau khi cắt khỏi nghiệp vụ cũ.
7. Các báo cáo verification/e2e/storage bên dưới — đọc để biết điều gì đã thực đo và điều
   gì vẫn chỉ là giả định.

## `docs/audit/`

| Tài liệu | Câu hỏi nó trả lời · giai đoạn · hiệu lực |
|---|---|
| [`audit-keep.md`](../audit/audit-keep.md) | Audit bước 1: landing, chatbot, auth cũ phụ thuộc vào đâu? **Lịch sử/hiệu lực một phần** — bản đồ phụ thuộc vẫn hữu ích; quyết định giữ nguyên landing/chat và luồng role legacy đã bị carbon-only thay thế. |
| [`audit-replace.md`](../audit/audit-replace.md) | Audit bước 1: route/schema HTX–MRV–market nào từng dự kiến thay và schema mới cần gì? **Lịch sử/đã bị thay thế một phần** — thiết kế project là đầu vào hữu ích, nhưng kết luận giữ DB legacy đã bị quyết định gỡ toàn bộ module cũ thay thế. |

## `docs/design/`

| Tài liệu | Câu hỏi nó trả lời · giai đoạn · hiệu lực |
|---|---|
| [`auth-role-design.md`](auth-role-design.md) | Bước 3: vì sao role `owner/developer/viewer` nằm trong `project_members`, tách khỏi `user_role`, và danh bạ/mời thành viên hoạt động thế nào? **Hiện hành về mô hình quyền; lịch sử một phần về redirect legacy**. |
| [`chat-carbon-only.md`](chat-carbon-only.md) | Đợt carbon-only: trợ lý dùng bảy công cụ dự án nào, bị cấm bịa điều gì và phần nào chưa eval? **Hiện hành**, thay thế mô tả công cụ HTX/market trong audit và integration cũ. |
| [`e2e-report.md`](e2e-report.md) | Bước 7: RLS/RPC project chạy ra sao trên Supabase dev, ca nào pass/skip và để lại dữ liệu gì? **Bằng chứng lịch sử còn giá trị cho schema project**; phần hồi quy module legacy không còn là trạng thái sản phẩm. |
| [`engine-core.md`](engine-core.md) | Bước 5/lõi: meta-schema, AST evaluator, decimal, form, CSV adapter và MRV estimate có hợp đồng gì? **Hiện hành**; giới hạn XLSX và tính đúng chuyên môn vẫn mở. |
| [`integration.md`](integration.md) | Bước 6: lần tích hợp đầu đã gắn chatbot/landing với module project thế nào? **Lịch sử/đã bị thay thế đáng kể** — quyết định không sửa landing, giữ module cũ và bộ công cụ chat ban đầu không còn hiệu lực. |
| [`legacy-removal-plan.md`](legacy-removal-plan.md) | Đợt carbon-only: dữ liệu legacy nào sẽ mất, phải backup ra sao và migration gỡ theo thứ tự nào? **Hiện hành nhưng chưa phải bằng chứng đã áp**; đây là kế hoạch cho thao tác phá hủy cần phê duyệt riêng. |
| [`module-a.md`](module-a.md) | Bước 4: route, kanban bảy stage, task, thành viên và quyền của phần thiết kế dự án được triển khai thế nào? **Hiện hành về chức năng**, còn các giới hạn upload lớn, invite và audit history đã nêu trong file. |
| [`module-b.md`](module-b.md) | Bước 5: monitoring period, nhập tay/CSV, snapshot, MRV preview và export hiện làm được gì? **Hiện hành**, nhưng template chính thức, `.xlsx` và quy tắc kỳ chồng nhau chưa có. |
| [`schema-project-platform.md`](schema-project-platform.md) | Bước 2: 16 bảng project, ràng buộc, RLS/RPC, storage và hợp đồng `metric_schema` được thiết kế ra sao? **Nguồn thiết kế schema hiện hành**; mọi methodology ví dụ trong file chỉ là dữ liệu mẫu. |
| [`schema-review-checklist.md`](schema-review-checklist.md) | Review bước 2: kiểm schema theo 22 nhóm rủi ro bảo mật, migration, tương thích và toàn vẹn bằng cách nào? **Tài liệu quy trình còn dùng được** khi sửa schema, không phải mô tả trạng thái sản phẩm. |
| [`schema-review-findings.md`](schema-review-findings.md) | Review bước 2: 22 mục đã pass hay còn P1/P2 gì trước khi áp? **Bằng chứng lịch sử** — C5 sau đó được xử lý trong auth-role-design, C13 được đóng bởi storage-c13-report; đọc cùng hai file đó. |
| [`schema-verification-report.md`](schema-verification-report.md) | Bước 2b: migration/RLS/RPC đã được chạy trên PostgreSQL + PostGIS cô lập thế nào và lỗi nào được sửa? **Bằng chứng lịch sử còn giá trị**, không thay cho PostgREST/GoTrue/Storage/browser hay kiểm đúng chuyên môn. |
| [`storage-c13-report.md`](storage-c13-report.md) | Sau e2e: upload Storage thường, upsert, đọc và xóa đã thực đo thế nào? **Hiện hành cho bucket project**; TUS, tệp lớn và đường bấm UI vẫn chưa kiểm, hồi quy bucket `evidence` sẽ lỗi thời khi legacy bị gỡ. |
| [`ta-alignment.md`](ta-alignment.md) | Sau triển khai: UI/copy phải dùng PDD, baseline scenario, additionality, VVB, ex-ante/ex-post ra sao? **Hiện hành về thuật ngữ và ranh giới phạm vi**; câu “không đụng landing” chỉ mô tả giới hạn của lượt đó. |

## Spec cũ dễ gây nhầm

[`../superpowers/specs/2026-09-05-project-layer-design.md`](../superpowers/specs/2026-09-05-project-layer-design.md)
đã bị **PLAN.md thay thế**. Spec này thiết kế organization/HTX tham gia dự án, role khác và
schema khác; chỉ dùng để tra lịch sử quyết định, không dùng làm yêu cầu triển khai hiện tại.

Hai spec cũ hơn trong `docs/superpowers/specs/` cũng thuộc lịch sử sản phẩm HTX/chatbot;
không phải nguồn yêu cầu cho nền tảng carbon-only.
