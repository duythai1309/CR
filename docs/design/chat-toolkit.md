# Bộ công cụ và playbook trợ lý Carbon

Trợ lý có 14 công cụ chỉ đọc, phủ từ portfolio và bảy bước thiết kế tới monitoring và báo
cáo MRV. Mọi handler production dùng Supabase client của phiên người dùng và chịu RLS;
không handler nào tạo service client hoặc đọc thẳng `profiles`.

## Công cụ bổ sung

| Công cụ | Nguồn sự thật | Mục đích |
|---|---|---|
| `liet_ke_ky_giam_sat` | `monitoring_periods`, exact count từ `monitoring_data` | Trạng thái, khoảng ngày, version, `data_revision`, số bản ghi |
| `tom_tat_du_lieu_giam_sat` | period `schema_snapshot`, `monitoring_data`, validator dùng chung | Field thiếu/sai và blocker theo đúng giới hạn DB |
| `liet_ke_bao_cao_mrv` | `mrv_reports`, period, Methodology/Standard | Version, preview/final, MRV estimate và provenance |
| `doc_vet_tinh_bao_cao` | `calculation_trace` snapshot trong report | Diễn giải order, factors, phép tính từng record và aggregation |
| `thanh_vien_va_phan_cong` | RPC `project_member_directory`, `project_tasks` | Vai trò thành viên và việc đang giao |
| `tai_lieu_theo_buoc` | `project_stages`, `project_documents`, `project_files` | Tài liệu đã nộp theo bước; chỉ nói loại thiếu khi DB có rule |
| `liet_ke_standard` | `standards`, `methodologies` | Catalog Standard hiện có và số Methodology nhìn thấy được |

Không thêm công cụ consultation, validation, VVB verification, standard review hoặc
issuance vì schema không lưu các trạng thái đó. Không thêm công cụ phán quyết feasibility.

## Ranh giới trung thực

- Con số MRV luôn mang nhãn ước tính, không phải tín chỉ đã phát hành.
- Trace được trả nguyên giá trị chuỗi từ snapshot; handler không tự tính hoặc làm tròn.
- Readiness của kỳ phân biệt “blocker mà DB thực sự cưỡng chế” với cảnh báo chất lượng dữ
  liệu. RPC hiện chỉ bắt kỳ mở, đúng revision, owner và có ít nhất một record; field thiếu
  hoặc sai được báo là cảnh báo trước khi khoá, không bịa thành luật DB.
- Catalog Methodology luôn kèm cờ SAMPLE và disclaimer. Standard catalog chỉ mô tả record
  trong DB, không suy diễn yêu cầu của Verra/Gold Standard.
- Tài liệu “còn thiếu” chỉ được kết luận khi rule của hệ thống quy định; nếu không, công cụ
  nói rõ DB chưa có checklist bắt buộc.

## Playbook

Prompt hướng dẫn model ghép công cụ theo tình huống: kẹt stage; chọn Methodology; không
khoá được monitoring period; truy nguồn con số report; xử lý lỗi CSV; và điều hướng route
`/du-an/**`. Fixture eval dùng cùng tên trường, trạng thái, warning và số liệu như handler
production để trajectory được chấm trên hành vi thật thay vì dữ liệu được tô đẹp.
