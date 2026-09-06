# Module B, trợ lý và xác thực

Tài liệu này ghi lại thiết kế giao diện dành cho đơn vị phát triển dự án carbon chuyên
nghiệp. Phạm vi sản phẩm kết thúc ở quản lý thiết kế dự án, monitoring và báo cáo ước tính
MRV; không bao gồm consultation, validation, VVB verification hoặc issuance.

## Giám sát

- Danh sách kỳ cho biết trạng thái mở/khoá, `data_revision` và số quan sát. Kỳ chỉ được tạo
  sau khi Methodology đã khoá.
- Chi tiết kỳ luôn hiện định danh Standard/Methodology/version/`schema_hash`, snapshot
  baseline và hệ số, khoảng ngày, số bản ghi và các blocker trước khi khoá.
- Form quan sát được sinh hoàn toàn từ `metric_schema`: field nhóm theo `ui.group`, giữ thứ
  tự `ui.order`, và hiện đơn vị, bounds, scale, điều kiện bắt buộc cùng mã field.
- Import chỉ nhận CSV. Luồng gồm đọc/map cột tự động theo mã hoặc alias, preview mapping và
  dữ liệu, báo lỗi theo dòng/cột, rồi ghi nguyên tử. Không quảng bá hỗ trợ XLSX.
- Kỳ khoá là snapshot bất biến. Mọi hiệu chỉnh sau đó phải đi qua một phiên bản kỳ mới.

## Báo cáo MRV

- Báo cáo luôn ghi rõ đây là ước tính MRV, không phải tín chỉ đã phát hành.
- Audit header gồm Standard, Methodology code/version, `schema_hash`, `data_revision`,
  baseline revision, engine version và thời điểm sinh.
- Calculation trace được trình bày theo lập luận: thứ tự tính, hệ số và nguồn, từng bước cho
  từng quan sát, rồi phép aggregation toàn kỳ. Bản in A4 chứa cùng vết này, không dùng JSON.
- `report_templates` hiện chỉ là placeholder; bản in/PDF và CSV là artifact rà soát nội bộ,
  không giả dạng mẫu chính thức của Verra hoặc Gold Standard.
- Bốn Methodology trong catalog là dữ liệu SAMPLE tự soạn và chưa được thẩm định. Báo cáo
  `final` từ dữ liệu mẫu bị engine/RPC từ chối và giao diện không đưa ra lời hứa ngược lại.

## Trợ lý

Trang trợ lý chỉ mô tả đúng bảy công cụ hiện có: hai công cụ tra danh sách/tiến độ dự án và
năm công cụ lập kế hoạch `yeu_cau_cua_buoc`, `goi_y_methodology`,
`field_giam_sat_cua_methodology`, `kiem_tra_baseline`, `cong_viec_theo_buoc`. Ví dụ câu hỏi
không vượt quá dữ liệu người dùng có quyền xem và không đưa ra kết luận validation/VVB.

Trang quản trị cho biết nguồn thực tế của provider/model/API key, thứ tự ưu tiên cấu hình và
việc API key đã lưu không thể đọc lại. Kiểm tra kết nối là thao tác chủ động riêng.

## Đăng nhập và đăng ký

Thông điệp hướng tới tổ chức phát triển dự án carbon. Đăng ký chỉ còn một loại tài khoản
`du_an`; vai trò chi tiết được quản lý theo từng dự án sau khi vào nền tảng. Khung ảnh nền
hiện hữu được giữ lại nhưng nội dung nhấn mạnh workflow bảy bước, versioned evidence và MRV
traceability.

## Giới hạn tầng dữ liệu

Không thay đổi schema, policy hoặc RPC trong đợt giao diện này. Audit surface dùng các trường
đã có: `entered_by`, `imported_by`, `requested_by`, revision và timestamp. Tên actor được
resolve qua RPC hẹp `project_member_directory` của migration 0015; UUID bất biến vẫn được
in kèm để việc đổi tên profile không làm mất khả năng đối chiếu.
