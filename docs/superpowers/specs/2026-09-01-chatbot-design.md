# Trợ lý ảo — thiết kế

Ngày 01/9/2026. Nhánh `feat/chatbot`.

## Mục tiêu

Một trợ lý tiếng Việt trong nền tảng, làm được hai việc:

1. Giải thích cách dùng hệ thống và phương pháp luận MRV.
2. Tra cứu số liệu thật của chính người đang hỏi — mùa vụ, thửa ruộng, lô tín chỉ,
   đơn hàng, chia doanh thu.

## Quyết định thiết kế

**Bộ công cụ cố định, chỉ đọc — không sinh SQL.** Model chỉ gọi được mười hàm có kiểu
rõ ràng, mỗi hàm là một truy vấn Supabase viết sẵn chạy bằng phiên đăng nhập của chính
người dùng. Hai lý do bỏ hướng text-to-SQL: dữ liệu trong hệ thống (tên nông hộ, ghi chú
nhật ký) là đầu vào người dùng nhập nên có thể chứa câu lệnh chèn vào để lái model; và
RLS chặn được rò rỉ dữ liệu nhưng không chặn được một truy vấn nặng làm nghẽn cơ sở dữ
liệu. Bề mặt đóng đổi lại mất tính linh hoạt, chấp nhận được với một hệ thống mà con số
đi vào hồ sơ kiểm định.

**Phân quyền vẫn nằm ở RLS, không ở chatbot.** Handler nhận client tạo từ cookie phiên,
không bao giờ nhận service key. Việc cắt công cụ theo vai trò là lớp phòng thủ thứ hai
và là cách giảm token, không phải cơ chế bảo mật.

**Không RAG.** Toàn bộ tri thức về sản phẩm và phương pháp luận chỉ vài nghìn token, nạp
thẳng vào system prompt. Vector database ở quy mô này chỉ thêm một chỗ để dữ liệu lệch
với thực tế. Ngược lại, mọi con số cụ thể — kể cả hệ số phát thải — đều phải gọi công cụ,
để tài liệu không bao giờ mâu thuẫn với cơ sở dữ liệu.

**Trợ lý không tự tính MRV.** Công thức IPCC có trong prompt để giải thích, không phải để
model tính hộ. Thửa chưa có bản tính thì trả lời là chưa tính. Đây là quy tắc quan trọng
nhất trong prompt: một con số bịa ra ở đây có thể đi vào hồ sơ phát hành tín chỉ.

**Hội thoại riêng tư hơn mọi dữ liệu khác.** Khác với dữ liệu nghiệp vụ dùng chung trong
hợp tác xã, chỉ đúng chủ hội thoại đọc được — đồng nghiệp cùng HTX và cả quản trị nền
tảng đều không. Câu hỏi người ta gõ cho trợ lý thường là đang dò xem mình làm sai chỗ nào.

**Thiếu khoá API thì trợ lý tự tắt.** Không ném lỗi, không làm sập trang. Phần còn lại
của nền tảng không phụ thuộc vào chatbot, nên một biến môi trường quên đặt không được
phép kéo theo màn hình trắng ở chỗ khác — cùng nguyên tắc đã dùng cho cấu hình Supabase.

## Kiến trúc

```
src/lib/chat/
  config.ts     đọc GEMINI_API_KEY và GEMINI_MODEL
  provider.ts   tệp DUY NHẤT biết đến Gemini; đổi nhà cung cấp chỉ sửa ở đây
  tools.ts      lược đồ mười công cụ (JSON Schema thuần) + phân phối theo vai trò
  handlers.ts   cài đặt từng công cụ bằng Supabase client của phiên người dùng
  knowledge.ts  tri thức tĩnh về sản phẩm và phương pháp luận
  prompt.ts     ghép system prompt từ persona + quy tắc + ngữ cảnh người dùng
  guards.ts     trần độ dài câu hỏi, số lượt lịch sử, số vòng gọi công cụ
  run.ts        vòng lặp một lượt hỏi; nhận provider qua tham số nên test được
src/app/api/chat/route.ts     xác thực, lưu hội thoại, trả SSE
src/components/chat/          ChatPanel dùng chung + ChatWidget nổi
src/app/htx/tro-ly/page.tsx   trang riêng, nạp lại hội thoại gần nhất
supabase/migrations/0010_chat.sql
```

## Giới hạn đã đặt

| Giới hạn | Giá trị | Vì sao |
|---|---|---|
| Độ dài câu hỏi | 2000 ký tự | Dài hơn gần như chắc chắn là dán nhầm cả trang |
| Lượt lịch sử nạp lại | 20 | Đủ ngữ cảnh mà không phình chi phí mỗi lượt |
| Vòng gọi công cụ | 5 | Model có thể mắc kẹt gọi lặp; mỗi vòng là một lần tính tiền |
| Bản ghi mỗi công cụ | 100 | HTX lớn không làm vỡ cửa sổ ngữ cảnh |

Hết vòng thì trợ lý dừng và nói thật là câu hỏi cần tách nhỏ, chứ không im lặng trả lời bừa.

## Việc chưa làm

- Chưa có hạn mức số lượt mỗi người mỗi ngày; hiện chỉ chặn theo độ dài và số vòng.
- Trợ lý chưa ghi dữ liệu. Hướng nhập liệu bằng hội thoại cần thêm bước xác nhận
  trước khi lưu, để riêng cho lần sau.
- Chưa có màn hình xem lại các hội thoại cũ; trang trợ lý chỉ mở lại cái gần nhất.
