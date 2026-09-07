# Tổng quan MVP C-route

## 1. C-route là gì?

C-route là nền tảng quản lý vòng đời dự án Carbon dành cho các đơn vị phát triển dự án
chuyên nghiệp. Sản phẩm giúp tập trung tiến độ, công việc, tài liệu, dữ liệu giám sát và
báo cáo vào cùng một hệ thống, thay vì quản lý rời rạc bằng bảng tính, email và nhiều thư
mục khác nhau.

Có thể hình dung C-route là sự kết hợp giữa:

- một bảng quản lý công việc kiểu Trello/Jira;
- một kho hồ sơ dùng chung cho từng dự án;
- một hệ thống nhập và kiểm tra dữ liệu giám sát;
- một công cụ tạo ước tính MRV có thể truy ngược nguồn số liệu;
- một trợ lý AI hỗ trợ tra cứu dữ liệu và hướng dẫn sử dụng.

Đây là MVP đơn giản do một người xây dựng và vận hành. Sản phẩm không phải chợ tín chỉ,
không thực hiện mua bán tín chỉ và không quản lý hợp tác xã.

## 2. Đối tượng sử dụng

Đối tượng chính là các đội tư vấn và đơn vị phát triển dự án Carbon. Trong mỗi dự án có
ba vai trò:

| Vai trò | Trách nhiệm chính |
|---|---|
| Chủ dự án | Quản lý dự án và thành viên, khóa lựa chọn, duyệt bước, tạo và khóa kỳ giám sát |
| Đơn vị phát triển | Thực hiện công việc, nhập dữ liệu và chuẩn bị báo cáo |
| Người xem | Theo dõi dự án nhưng không thay đổi dữ liệu |

Quyền được xác định riêng theo từng dự án. Một người có thể là chủ dự án A nhưng chỉ là
người phát triển ở dự án B.

## 3. Quy trình sử dụng

Một dự án đi qua hành trình chính sau:

1. Tạo ý tưởng và mô tả dự án.
2. Dùng AI để hệ thống hóa thông tin đã biết, khoảng trống và bằng chứng cần thu thập.
3. Chọn Standard và Methodology.
4. Hoàn thành bảy bước thiết kế nội bộ, từ Project concept đến PDD.
5. Phân công và theo dõi công việc trên bảng kanban.
6. Quản lý thành viên, thời hạn, bình luận và tài liệu.
7. Tạo monitoring period.
8. Nhập dữ liệu quan sát bằng biểu mẫu hoặc CSV.
9. Khóa kỳ để đóng băng dữ liệu.
10. Sinh báo cáo MRV dạng ước tính.
11. Xem calculation trace để biết con số được tạo từ dữ liệu, hệ số và phép tính nào.

Trợ lý AI không được quyết định dự án khả thi hay không. Nó chỉ hỗ trợ sắp xếp và tra cứu
thông tin; kết luận chuyên môn vẫn thuộc về chuyên gia.

## 4. Những điểm mạnh hiện tại

- Một nguồn dữ liệu chung cho tiến độ, công việc, tài liệu và báo cáo.
- Có lịch sử phiên bản và snapshot, nên báo cáo cũ không tự thay đổi khi dữ liệu mới được
  cập nhật.
- Calculation trace giúp truy ngược nguồn của MRV estimate.
- Phân quyền được bảo vệ tại database, không chỉ bằng việc ẩn nút trên giao diện.
- Biểu mẫu dữ liệu được sinh từ metric schema, giúp mở rộng sang nhiều loại dự án.
- Trợ lý có 14 công cụ chỉ đọc và chịu cùng giới hạn truy cập với người dùng.
- Bộ kiểm thử tự động hiện có 336 test đang đạt.

## 5. Phạm vi hiện tại

MVP bao gồm:

- quản lý danh mục dự án;
- bảy bước thiết kế từ Project concept đến PDD;
- bảng kanban, công việc, người phụ trách, thời hạn và bình luận;
- quản lý thành viên và quyền theo dự án;
- tài liệu và tệp đính kèm;
- monitoring period và dữ liệu quan sát;
- nhập dữ liệu thủ công hoặc bằng CSV;
- MRV estimate và calculation trace;
- trợ lý AI tra cứu dữ liệu dự án và hướng dẫn thao tác.

## 6. Những giới hạn cần nói rõ

C-route hiện là MVP để thử nghiệm và quản lý nội bộ, chưa phải hệ thống sẵn sàng dùng để
nộp hồ sơ tín chỉ thật.

- Bốn Methodology hiện tại là dữ liệu mẫu tự soạn, chưa được thẩm định chuyên môn và
  không phải Methodology được Verra hoặc Gold Standard công nhận.
- Báo cáo là MRV estimate, không phải tín chỉ đã được verification hoặc issuance.
- Chưa có template PDF hoặc DOCX chính thức của từng Standard; hiện có bản in HTML và CSV.
- Phạm vi chưa bao gồm stakeholder consultation, validation, registration, VVB
  verification, Standard review và issuance.
- Chưa hỗ trợ nhập tệp XLSX; người dùng cần chuyển sang CSV.
- Chưa có quy tắc đầy đủ để chọn kỳ hiệu lực khi nhiều phiên bản monitoring period chồng
  thời gian.
- Chưa có luồng gửi thư mời người chưa đăng ký.
- Tệp lớn và resumable upload chưa được kiểm chứng đầy đủ.
- Chưa hoàn thành kiểm thử đầu-cuối với một nhóm người dùng thật.
- Cần xác nhận riêng việc áp đầy đủ migration lên môi trường production trước khi mở dùng.

## 7. Hạ tầng vận hành

MVP chỉ cần một cấu hình tương đối gọn:

- Vercel để chạy website Next.js;
- Supabase cho tài khoản, database, phân quyền, file và backup;
- Gemini 2.5 Flash cho trợ lý AI;
- một tên miền riêng;
- email hệ thống và một công cụ theo dõi lỗi ở mức cơ bản.

Không cần Supabase Team, Vercel Enterprise, Point-in-Time Recovery hoặc hệ thống
observability trả phí trong giai đoạn MVP.

## 8. Dự trù kinh phí vận hành

Dự toán dưới đây không bao gồm lương, công phát triển hoặc chi phí nhân sự. Tỷ giá dùng để
lập kế hoạch là 1 USD bằng 26.000 VND; chi phí thực tế có thể thay đổi theo tỷ giá, thuế
và lưu lượng sử dụng.

| Khoản | Dự toán mỗi tháng | Ghi chú |
|---|---:|---|
| Vercel Pro | khoảng 520.000đ | Gói cơ bản 20 USD/tháng |
| Supabase Pro | khoảng 650.000đ | Gói 25 USD/tháng, phù hợp một production MVP |
| Gemini 2.5 Flash | 100.000–800.000đ | Tăng theo số lượt hỏi và số vòng gọi công cụ |
| Tên miền | bình quân 30.000–70.000đ | Thường thanh toán theo năm |
| Email và theo dõi lỗi | 0–300.000đ | Có thể bắt đầu bằng gói miễn phí |
| Dự phòng vượt hạn mức | 200.000–500.000đ | Dùng cho lưu lượng, file hoặc AI tăng đột biến |
| **Tổng dự kiến** | **1,5–2,8 triệu đồng/tháng** | Không gồm nhân sự và VAT |

Chi phí tương ứng khoảng 18–34 triệu đồng mỗi năm. Để có biên an toàn, ngân sách vận hành
năm đầu nên đặt ở mức 30–35 triệu đồng.

### Ba mức vận hành tham khảo

| Mức | Chi phí mỗi tháng | Khi nào phù hợp |
|---|---:|---|
| Demo tiết kiệm | 0–300.000đ | Chỉ trình diễn, rất ít người dùng, chấp nhận giới hạn gói miễn phí |
| MVP khuyến nghị | **1,5–2,8 triệu đồng** | Có người dùng thật, cần database ổn định và backup cơ bản |
| Pilot hoạt động nhiều | 3–6 triệu đồng | Nhiều file, nhiều lượt AI hoặc lưu lượng tăng |

Gói miễn phí phù hợp để trình diễn nhưng không nên là phương án production lâu dài:
Supabase Free có thể tạm dừng project khi không hoạt động và không có automatic backup.

## 9. Những khoản chưa tính trong ngân sách trên

- công phát triển và bảo trì của người làm sản phẩm;
- thuê chuyên gia Carbon;
- mua hoặc xin quyền sử dụng Methodology chính thức;
- thẩm định metric schema, hệ số và công thức tính;
- thiết kế template báo cáo chính thức;
- kiểm thử bảo mật độc lập;
- tư vấn pháp lý, compliance hoặc chứng nhận doanh nghiệp;
- hỗ trợ người dùng chuyên trách.

Những khoản này chỉ nên phát sinh khi chuyển từ MVP sang sản phẩm dùng cho hồ sơ Carbon
thật và cần được lập ngân sách riêng.

## 10. Khuyến nghị

Trong giai đoạn hiện tại, nên vận hành C-route như một MVP có kiểm soát với một nhóm nhỏ
người dùng. Mức ngân sách hợp lý là khoảng 2 triệu đồng mỗi tháng, cộng quỹ dự phòng
5–10 triệu đồng cho cả năm.

Tổng ngân sách vận hành an toàn cho năm đầu là khoảng **30–35 triệu đồng**, không tính
nhân sự. Chỉ nên chuyển sang sử dụng cho hồ sơ thật sau khi Methodology, template báo cáo,
môi trường production và quy trình chịu trách nhiệm chuyên môn đã được kiểm chứng.

## 11. Nguồn tham khảo chi phí

- Vercel Pricing: https://vercel.com/pricing
- Supabase Pricing: https://supabase.com/pricing
- Gemini API Pricing: https://ai.google.dev/gemini-api/docs/pricing
