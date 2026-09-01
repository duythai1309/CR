/**
 * Tri thức tĩnh về nền tảng và phương pháp luận, nhét thẳng vào system prompt.
 *
 * Cố tình không dùng RAG hay vector database: toàn bộ phần này chỉ vài nghìn token,
 * nạp hết vào prompt vừa rẻ vừa chính xác hơn việc tìm kiếm rồi ghép mảnh. Ngược
 * lại, mọi con số cụ thể (hệ số, sản lượng, doanh thu) đều KHÔNG viết ở đây mà phải
 * gọi công cụ, để tài liệu không bao giờ lệch với cơ sở dữ liệu.
 */

export const PRODUCT_KNOWLEDGE = `
## Nền tảng này là gì

Agri-Carbon Pass số hoá quy trình MRV (Đo lường – Báo cáo – Xác minh) tín chỉ carbon
cho nông hộ trồng lúa nước, và kết nối lô tín chỉ với doanh nghiệp mua qua chợ B2B.
Toàn bộ giao diện tiếng Việt. Hiện chỉ hỗ trợ cây lúa nước và triển khai ở miền Bắc.

## Bốn vai trò

- Giám đốc hợp tác xã (coop_manager): toàn quyền trong HTX, gộp lô và chào bán tín chỉ.
- Cán bộ hợp tác xã (coop_staff): nhập nhật ký canh tác.
- Doanh nghiệp mua (buyer): duyệt chợ, đặt mua, thanh toán.
- Quản trị nền tảng (platform_admin): toàn cảnh nền tảng và dòng doanh thu.

Nông hộ KHÔNG có tài khoản. Họ là bản ghi trong hệ thống, cán bộ HTX nhập liệu hộ.

## Luồng công việc và đường dẫn màn hình

1. /thiet-lap — tạo HTX mới hoặc gia nhập bằng mã. Người tạo thành giám đốc HTX.
2. /htx/nong-ho — thêm hồ sơ nông hộ (họ tên, thôn xóm, mã xã viên).
3. /htx/thua-ruong — vẽ ranh thửa trên ảnh vệ tinh. Diện tích do hệ thống đo từ ranh vẽ.
4. /htx/mua-vu — tạo mùa vụ, chọn loại vụ, rồi đăng ký các thửa vào vụ.
5. /htx/thua-vu/[id] — ghi nhật ký cho một thửa trong một vụ: ngày cấy, ngày thu hoạch,
   sự kiện tháo nước và cho nước vào lại, các lần bón phân, cách xử lý rơm rạ, ảnh bằng
   chứng. Xong thì bấm tính MRV ngay tại màn hình này.
6. /htx/lo-tin-chi — gộp các thửa-vụ đã tính thành một lô, trừ đệm rủi ro, rồi chào bán.
7. /htx/he-so — tra cứu toàn bộ hệ số phát thải kèm nguồn trích dẫn.
8. /cho và /cho/[id] — chợ tín chỉ cho doanh nghiệp; /don-hang — đơn hàng đã đặt.
9. /quan-tri — toàn cảnh nền tảng, chỉ quản trị viên vào được.

## Phương pháp luận MRV

Theo IPCC 2019 Refinement, Vol.4 Ch.5.5 — nền tảng mà methodology của Verra và
Gold Standard dựa vào.

    CH4 = EFc × SFw × SFp × SFo × t × A
    SFo = (1 + tổng(ROAi × CFOAi))^0.59
    N2O = N × EF1 × 44/28

Trong đó EFc là hệ số phát thải nền (kg CH4/ha/ngày), SFw hệ số chế độ nước, SFp hệ số
điều kiện nước trước vụ, SFo hệ số chất hữu cơ bón vào, t số ngày canh tác, A diện tích.
Cộng thêm phần phát thải tránh được do ngừng đốt rơm rạ. Giảm phát thải = kịch bản nền
trừ kịch bản dự án, quy về CO2e theo GWP.

Hệ số phát thải nền lấy theo vùng miền của HTX và loại vụ, đo tại Việt Nam (Vo et al.
2020, Climate 8(6):74) thay vì dùng mặc định toàn cầu. Riêng miền Bắc, vụ Mùa phát thải
nền gần gấp đôi vụ Xuân.

## Ba quy tắc nghiệp vụ hay bị hỏi

**Chế độ nước không do người dùng khai.** Hệ số SFw suy ra từ số lần tháo nước đã ghi
trong nhật ký: không tháo lần nào là ngập liên tục (SFw 1,0), tháo một lần là 0,71, từ
hai lần trở lên mới đạt AWD (0,55). Muốn được hệ số tốt hơn thì phải ghi đủ sự kiện tháo
nước, chứ không có ô nào để chọn thẳng chế độ nước.

**Diện tích tính từ hình học.** Thửa lưu dưới dạng polygon; diện tích do hệ thống tính
từ ranh vẽ. Số hộ khai chỉ để đối chiếu, lệch quá 15% thì bảng tô màu cảnh báo. Ranh nhỏ
hơn 100 m2 bị từ chối. Ranh chồng lên thửa đã có sẽ bị cảnh báo — kể cả thửa của HTX
khác — nhưng không chặn cứng vì vẽ tay có sai số.

**Số đã phát hành thì khoá lại.** Gộp lô sẽ khoá các thửa-vụ trong lô, chặn mọi sửa đổi
nhật ký ở tầng cơ sở dữ liệu. Muốn sửa phải mở khoá, và khi mở khoá thì kết quả tính cũ
bị đánh dấu hết hiệu lực, buộc tính lại. Lô đã xác minh hoặc đã chào bán thì không mở
khoá được nữa.

## Chợ tín chỉ và chia doanh thu

Lô đi qua các trạng thái: nháp → đã nộp hồ sơ → đã xác minh → đang chào bán → đã bán hết
→ đã thu hồi. Chỉ lô đang chào bán và có giá mới hiện trên chợ. Đệm rủi ro mặc định 15%
theo thông lệ Verra, giữ lại không bán.

Mỗi đơn thanh toán xong được tách tự động: phí nền tảng mặc định 12%, phí quản lý HTX 8%,
còn lại 80% về nông hộ, chia theo tỷ trọng giảm phát thải của từng hộ trong lô. Tỷ lệ này
đặt riêng cho từng lô nên phải tra bằng công cụ, không nói theo con số mặc định.

Đặt mua giữ chỗ ngay: đơn đang chờ thanh toán vẫn chiếm lượng, nên không bán trùng.
Thanh toán hiện chạy ở chế độ thử, không phát sinh giao dịch tiền thật.

## Giới hạn hiện tại của hệ thống

- Chỉ có cây lúa nước.
- Giao diện chỉ triển khai miền Bắc (hai vụ: vụ Xuân và vụ Mùa).
- Thanh toán là chế độ thử, chưa cắm cổng thật.
- Kiểm định vẫn là bước ngoài hệ thống: trạng thái "đã xác minh" do quản trị viên đặt.
`.trim();
