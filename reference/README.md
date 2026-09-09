# Tài liệu gốc của tổ chức chứng nhận

`reference/methodologies/` chứa methodology và template tải từ trang chính thức của Verra,
Gold Standard và CDM. **Thư mục đó bị `.gitignore` chặn** vì hai lý do: 41 MB làm phình
repo, và đây là tài liệu có bản quyền của bên thứ ba trong khi repo này công khai.

Ai cần thì tải lại từ nguồn — tất cả đều miễn phí, không cần đăng ký.

## Verra (VCS)

| Cần gì | Lấy ở đâu |
|---|---|
| Danh mục methodology đã duyệt (VM####, VMR####) | <https://verra.org> → Verified Carbon Standard → Methodologies |
| Template PDD và Monitoring Report | <https://verra.org/programs/verified-carbon-standard/project-description-and-monitoring-report/> |
| Template để **viết** methodology mới | `VCS-Methodology-Template-v3.3` trên cùng trang |
| Hồ sơ dự án thật đã đăng ký | <https://registry.verra.org> |

Bộ hiện có trong máy: khoảng 40 methodology từ VM0001 tới VM0053, các bản VMR revision của
methodology CDM, và bộ template VCS v5.0 bản A/B (PDD, Monitoring Report, Validation,
Verification).

## Gold Standard

| Cần gì | Lấy ở đâu |
|---|---|
| Toàn bộ template | <https://globalgoals.goldstandard.org/templates/> |
| PDD và hướng dẫn điền | <https://globalgoals.goldstandard.org/t-prereview-design-document/> |
| Hồ sơ dự án thật | <https://registry.goldstandard.org> |

Bộ hiện có: `T-PAA_PreReview_V2.0_Project-Design-Document.docx`.

## CDM (UNFCCC)

Nhiều dự án Verra và Gold Standard dùng lại methodology của CDM, và công thức của CDM viết
tường minh hơn nên dễ chuyển thành `metric_schema` hơn.

- Tổng quan: <https://cdm.unfccc.int/methodologies/documentation/meth_booklet.pdf>
- Tra từng methodology: <https://cdm.unfccc.int/methodologies>

## Vì sao hồ sơ thật đáng giá hơn template rỗng

Template cho bạn *cấu trúc*. Hồ sơ dự án thật trên registry cho bạn biết người ta **điền gì
vào mỗi mục và chi tiết tới đâu** — thứ quyết định `metric_schema` thiết kế đúng hay không.
Nên khi bóc tách một methodology, tải kèm 2–3 monitoring report của dự án đang dùng chính
methodology đó.

## Ranh giới khi đưa vào hệ thống

Bóc tách từ tài liệu gốc là **transcription**, và transcription vẫn sai được. Vì vậy:

- `is_sample = false` nghĩa là "methodology này có thật", không phải "đã kiểm chứng".
- `professionally_validated = true` chỉ được bật khi **có người có chuyên môn đối chiếu**
  `metric_schema` với tài liệu gốc và chịu trách nhiệm cho việc đối chiếu đó.
- Chừng nào cờ thứ hai còn `false`, `create_mrv_report` từ chối xuất bản `final`. Đó là
  thiết kế, không phải lỗi.

Mỗi lần bóc tách nên kèm một tài liệu trong `docs/design/` ghi rõ **phần nào chưa bóc tách
được và vì sao** — phần đó quan trọng ngang phần đã làm.
