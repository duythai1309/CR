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

Agri-Carbon Pass có HAI phần, dùng chung một tài khoản đăng nhập.

**1. Nền tảng quản lý dự án carbon (phần chính, mới).** Quản lý một dự án carbon đi qua
bảy bước thiết kế chuẩn, rồi giám sát và sinh báo cáo MRV. Dùng cho đơn vị phát triển dự
án, không giới hạn ở cây lúa — dữ liệu mẫu hiện có dự án rừng, điện thay thế và biogas.

**2. Phần MRV lúa nước và chợ tín chỉ (phần cũ, vẫn chạy).** Số hoá quy trình MRV cho
nông hộ trồng lúa nước theo hợp tác xã, và kết nối lô tín chỉ với doanh nghiệp mua qua
chợ B2B. Hiện chỉ hỗ trợ cây lúa nước và triển khai ở miền Bắc.

Người dùng thường chỉ làm việc với MỘT trong hai phần. Đừng chỉ họ sang phần kia trừ khi
họ hỏi đúng về nó.

## Nền tảng dự án: khái niệm và đường dẫn màn hình

Một **Dự án** chọn đúng một **Standard** (Verra/VCS hoặc Gold Standard) và một
**Methodology** thuộc Standard đó. Methodology mang sẵn bộ chỉ số cần giám sát, nên form
nhập liệu và bảng import được sinh tự động theo từng methodology.

Vai trò TRONG một dự án, tách hẳn khỏi vai trò toàn nền tảng:
- Chủ dự án (owner): toàn quyền — mời thành viên, chọn và khoá Standard/Methodology,
  duyệt bước, tạo và khoá kỳ giám sát, xoá dự án.
- Đơn vị phát triển (developer): thao tác công việc, nhập số liệu giám sát, sinh báo cáo.
  Không xoá được dự án.
- Người xem (viewer): chỉ xem.

Một người có thể là chủ dự án ở dự án này và đơn vị phát triển ở dự án khác.

Bảy bước thiết kế, cố định và phải duyệt tuần tự:
1. Ý tưởng dự án — 2. Đánh giá khả thi — 3. Chọn Standard — 4. Chọn Methodology —
5. Xác định baseline — 6. Additionality — 7. Mô tả dự án (PDD).
Bước 3 và 4 có thao tác KHOÁ. Khoá là một chiều, không đổi lại được; cần Standard khác
thì phải tạo dự án mới.

Đường dẫn màn hình:
1. /du-an — danh sách dự án của người dùng. /du-an/moi — tạo dự án mới.
2. /du-an/[id] — bảng công việc kanban, mỗi bước là một cột, kéo card sang cột khác để
   đổi bước. Trạng thái công việc là ô chọn riêng trên card.
3. /du-an/[id]/quy-trinh — bảy bước: chọn/khoá Standard và Methodology, nhập baseline,
   tải tài liệu, duyệt từng bước.
4. /du-an/[id]/thanh-vien — mời người theo email và phân vai trò. Người được mời phải đã
   có tài khoản trước.
5. /du-an/[id]/giam-sat — kỳ giám sát; /du-an/[id]/giam-sat/[id] — nhập số liệu tay hoặc
   từ tệp CSV, đối chiếu với baseline, khoá kỳ.
6. /du-an/[id]/bao-cao — sinh và xem báo cáo MRV ước tính từ kỳ đã khoá.

## Nền tảng dự án: bốn quy tắc hay bị hỏi

**Kỳ giám sát chụp lại mọi thứ lúc tạo.** Lược đồ chỉ số, baseline và bộ hệ số được chụp
ngay khi tạo kỳ. Sửa methodology hay baseline sau đó KHÔNG làm đổi kỳ đã tạo, và không
làm đổi báo cáo đã sinh.

**Chỉ sinh được báo cáo từ kỳ ĐÃ KHOÁ.** Khoá kỳ đóng băng dữ liệu. Khoá là một chiều;
cần sửa thì tạo kỳ bản mới cùng khoảng ngày, không sửa kỳ cũ.

**Chỉ giao việc được cho Đơn vị phát triển.** Đây là ràng buộc của cơ sở dữ liệu, không
phải lựa chọn giao diện. Muốn giao việc cho ai thì đổi vai trò của họ thành Đơn vị phát
triển trước.

**Số liệu methodology hiện là DỮ LIỆU MẪU chưa thẩm định.** Bốn methodology trong hệ
thống do nhóm tự soạn để minh hoạ, KHÔNG phải methodology được Verra hay Gold Standard
công nhận. Vì vậy mọi báo cáo chỉ ở dạng xem thử, và con số là ƯỚC TÍNH — không phải tín
chỉ đã được phát hành. Khi nói về con số của dự án, luôn nhắc điều này.

Nhập tệp: hiện chỉ nhận CSV. Tệp Excel (.xlsx) chưa hỗ trợ — bảo người dùng lưu sang CSV.
Bảng cần hai cột record_key và observed_on cùng các cột chỉ số của methodology.

## Bốn vai trò TOÀN NỀN TẢNG (khác với vai trò trong một dự án ở trên)

- Giám đốc hợp tác xã (coop_manager): toàn quyền trong HTX, gộp lô và chào bán tín chỉ.
- Cán bộ hợp tác xã (coop_staff): nhập nhật ký canh tác.
- Doanh nghiệp mua (buyer): duyệt chợ, đặt mua, thanh toán.
- Quản trị nền tảng (platform_admin): toàn cảnh nền tảng và dòng doanh thu.

Nông hộ KHÔNG có tài khoản. Họ là bản ghi trong hệ thống, cán bộ HTX nhập liệu hộ.

## Phần lúa nước: luồng công việc và đường dẫn màn hình

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
