# PLAN.md — Chuyển đổi CR sang nền tảng quản lý dự án Carbon Credit

## Trạng thái hiện tại — 06/09/2026

Bảy bước thực hiện ở §6 đã hoàn thành ở mức triển khai và kiểm chứng được ghi lại trong
`docs/design/`: audit; schema; auth/role; Module A; Module B; tích hợp; và e2e. Đây không
phải tuyên bố production-ready: giao diện chưa được người dùng thật chạy thử đầu-cuối,
đường sinh MRV report từng bị skip khi thiếu service role key, export theo template chính
thức và import `.xlsx` chưa có, TUS/resumable upload chưa được kiểm.

Sau khi PLAN này được viết, phạm vi sản phẩm đã đổi dứt điểm thành **chỉ nền tảng quản lý
dự án Carbon cho đơn vị phát triển dự án chuyên nghiệp**. Module HTX, MRV lúa nước và mua
bán tín chỉ được đưa vào kế hoạch gỡ; `profiles`/auth và nền tảng dự án phải được giữ.

Hai giả định ban đầu dưới đây đã bị thay thế:

- §0/§1 định giữ chatbot nguyên trạng. Thực tế chatbot phụ thuộc sâu vào dữ liệu HTX và
  marketplace, nên đã phải gỡ toàn bộ công cụ nghiệp vụ cũ và tái công cụ hóa thành trợ lý
  cho bảy bước lập kế hoạch dự án Carbon. Xem `docs/design/chat-carbon-only.md`.
- §1 định giữ landing page nguyên trạng. Concept art, carousel, ảnh/video, hiệu ứng, bảng
  màu và nhịp thị giác được giữ, nhưng toàn bộ nội dung chữ và CTA phải viết lại cho đúng
  project developer; các lối vào legacy đã bị bỏ.

Các mục §0–§7 bên dưới được giữ nguyên như **tài liệu quyết định ban đầu**. Khi có mâu
thuẫn, phần trạng thái này và quyết định carbon-only mới hơn là nguồn hiện hành.

## 0. Bối cảnh

CR hiện là một web app (React/Next/Vue). Yêu cầu: **giữ nguyên** chatbot và landing page hiện có,
**thay thế toàn bộ** các chức năng còn lại bằng một nền tảng quản lý dự án kiểu Jira, dành riêng
cho quy trình tạo Carbon Credit, phục vụ hai nhóm người dùng: **Project Owner** và **Project Developer**.

Phạm vi ban đầu: xây **cả hai module cùng lúc**:
- Module A — Quản lý thiết kế dự án (bước 1 → 7 trong quy trình chuẩn)
- Module B — Giám sát & Báo cáo MRV (bước 12 → 14)

Bước 8–11 và 15–17 (stakeholder consultation, validation, registration, verification bởi VVB,
standard review, issuance) **không nằm trong phạm vi phiên bản đầu tiên** — có thể để placeholder
hoặc lược bỏ, bổ sung sau.

---

## 1. Việc giữ lại từ CR hiện tại

- [ ] Landing page — giữ nguyên, không sửa
- [ ] Chatbot — giữ nguyên chức năng, có thể mở rộng sau này để trợ giúp user điền chỉ số
      methodology hoặc trả lời câu hỏi về quy trình (không bắt buộc ở bản đầu)
- [ ] Auth/user system hiện có — audit xem có tái sử dụng được không, hay cần viết lại để hỗ trợ
      role Project Owner / Project Developer

## 2. Entity Model (đề xuất)

```
Standard                         // Verra, Gold Standard, Puro.earth, ...
  └─ Methodology                 // thuộc 1 Standard, VD VM0007, AMS-III.D
       ├─ metric_schema[]        // định nghĩa field giám sát: tên, đơn vị, công thức
       └─ Project                // 1 project chọn đúng 1 Standard + 1 Methodology
            ├─ Stage (1..7)      // cố định theo quy trình, có thứ tự
            │    └─ Task
            │         ├─ status: todo | in_progress | done | blocked
            │         ├─ assignee (Project Developer)
            │         ├─ attachments[]
            │         └─ comments[]
            ├─ Member[]          // role: owner | developer | viewer
            ├─ MonitoringPeriod (nhiều kỳ theo thời gian)
            │    └─ MonitoringData
            │         ├─ nhập tay theo metric_schema của Methodology
            │         ├─ hoặc import Excel/CSV → parse & map cột → field
            │         └─ validate: đơn vị, khoảng giá trị hợp lệ
            └─ MRVReport
                 ├─ sinh từ MonitoringData của 1 MonitoringPeriod
                 ├─ áp công thức tính credit theo Methodology
                 └─ export PDF/Word theo template của Standard tương ứng
```

**Điểm mấu chốt kỹ thuật:** `Methodology.metric_schema` phải đủ linh hoạt để Module B tự sinh
form nhập liệu và bảng import mà không cần hard-code riêng cho từng loại dự án (rừng, biogas,
năng lượng tái tạo...).

## 3. Module A — Quản lý dự án (bước 1 → 7)

| # | Bước | Tính năng |
|---|------|-----------|
| 1 | Project Idea | Tạo project, mô tả sơ bộ |
| 2 | Feasibility Assessment | Task checklist, upload báo cáo khả thi |
| 3 | Chọn Standard | Dropdown chọn Standard, khoá sau khi xác nhận |
| 4 | Chọn Methodology | Dropdown Methodology thuộc Standard đã chọn |
| 5 | Xác định Baseline | Task + form nhập baseline, upload tài liệu tính toán |
| 6 | Additionality | Checklist đánh giá theo tool của Standard |
| 7 | Project Design/Description | Document builder hoặc upload PDD, có versioning |

Giao diện: kanban board — mỗi Stage là 1 cột, Task là card, kéo-thả đổi status
(giống Jira/Trello). Mỗi Task có assignee, deadline, comment, file đính kèm.

## 4. Module B — Monitoring & MRV (bước 12 → 14)

- **Monitoring dashboard**: theo từng MonitoringPeriod, so sánh chỉ số đã nhập với baseline
- **Nhập liệu thủ công**: form sinh động theo `metric_schema` của Methodology
- **Import Excel/CSV**: parser map cột file vào đúng field, validate trước khi lưu
- **Tính toán tự động**: áp công thức Methodology lên dữ liệu thô → ước tính credit
- **Sinh Monitoring Report**: export theo template chuẩn của Standard, kéo dữ liệu tự động

## 5. Vai trò & quyền

| Role | Quyền |
|------|-------|
| Project Owner | Toàn quyền trên project của mình: mời thành viên, duyệt chuyển stage, xoá project |
| Project Developer | Thao tác task, nhập monitoring data, không xoá được project |
| Viewer *(tuỳ chọn, mở rộng sau)* | Chỉ xem, dùng cho Verifier/VVB ở bước 15 |

## 6. Kế hoạch thực hiện (đề xuất thứ tự cho Claude Code / sub-agent)

1. **Audit** codebase CR hiện tại — xác định chính xác file/route thuộc chatbot, landing page,
   và mọi thứ còn lại (không sửa gì ở bước này)
2. **Thiết kế database schema** theo entity model ở mục 2 (migration mới, không đụng bảng của
   chatbot/landing page nếu có chung DB)
3. **Dựng khung Auth + Role** (Project Owner / Project Developer), tái sử dụng auth cũ nếu audit
   cho thấy phù hợp
4. **Xây Module A** (kanban 7 stage) — có thể giao 1 sub-agent phụ trách riêng
5. **Xây Module B** (monitoring + import + tính toán + report) — có thể giao 1 sub-agent khác
   phụ trách riêng, song song với Module A vì hai module ít phụ thuộc lẫn nhau ngoài chung
   Project entity
6. **Tích hợp** hai module vào cùng 1 project, nối lại với chatbot/landing page hiện có
7. **Test end-to-end**: tạo 1 project mẫu, đi hết luồng 1→7, tạo 1 monitoring period mẫu,
   xuất thử 1 report

> Ghi chú: chỉ nên chạy song song bước 4 và 5 bằng đa-agent (herdr + Codex) sau khi bước 1–3
> đã hoàn tất và được xác nhận — vì cả hai module đều phụ thuộc vào schema chung ở bước 2.

## 7. Câu hỏi còn mở (cần làm rõ trước khi code)

- [ ] Danh sách Standard/Methodology cụ thể cần hỗ trợ ngay từ đầu là gì? (VD chỉ Verra VM0007,
      hay cần thêm Gold Standard?)
- [ ] Field/chỉ số giám sát cụ thể của 1–2 methodology mẫu, để làm chuẩn thiết kế `metric_schema`
- [ ] Database hiện tại của CR dùng gì (Postgres, MongoDB...)? Có cần giữ tương thích không?
- [ ] Có cần multi-tenancy (nhiều tổ chức, mỗi tổ chức nhiều project) hay chỉ 1 tổ chức dùng?
- [ ] Format export MRV report cụ thể — theo template PDF sẵn có của standard nào, hay tự thiết kế?
