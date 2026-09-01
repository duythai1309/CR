# Agri-Carbon Pass

Nền tảng số hoá **MRV (Đo lường – Báo cáo – Xác minh)** và kết nối tín chỉ carbon cho
nông hộ nhỏ. Hợp tác xã ghi nhật ký canh tác lúa trên web, hệ thống tự tính lượng khí
nhà kính cắt giảm theo phương pháp luận IPCC với hệ số đo tại Việt Nam, gộp thành lô
tín chỉ tập thể và chào bán cho doanh nghiệp trên chợ B2B tích hợp sẵn.

Chạy trên Next.js 15 + Supabase (Postgres · PostGIS · Auth · Storage · RLS).
Toàn bộ giao diện và dữ liệu bằng tiếng Việt.

---

## 1. Bài toán

**Chi phí MRV lớn hơn giá trị tín chỉ.** Thuê đơn vị tư vấn quốc tế đo lường và kiểm
định cho một mảnh ruộng nhỏ tốn hàng chục ngàn đô la. Nông hộ nhỏ không bao giờ tự làm
được, nên phần lớn diện tích lúa Việt Nam đứng ngoài thị trường carbon.

**Không có dữ liệu đầu vào.** Nông dân canh tác theo kinh nghiệm, không ghi lại ngày
tháo nước, lượng phân bón hay cách xử lý rơm rạ. Không có nhật ký thì không có cơ sở
để cấp chứng chỉ.

**Doanh nghiệp thiếu nguồn tín chỉ minh bạch.** Các đơn vị chịu áp lực Net Zero và báo
cáo ESG không biết mua tín chỉ nội địa truy xuất được nguồn gốc ở đâu.

## 2. Cách nền tảng giải quyết

**Bước 1 — Số hoá nhật ký canh tác.** Cán bộ hợp tác xã nhập dữ liệu mùa vụ trên giao
diện web: ngày cấy, lịch tháo nước, lượng phân bón, cách xử lý rơm rạ, kèm ảnh bằng
chứng. Nông hộ **không cần tài khoản** — họ là bản ghi trong hệ thống, hợp tác xã nhập
liệu hộ. Ranh thửa vẽ trực tiếp trên ảnh vệ tinh.

**Bước 2 — Tự động hoá tính toán.** Engine MRV tính lượng CH₄ và N₂O cắt giảm theo
IPCC 2019 Refinement — nền tảng mà các methodology của Verra và Gold Standard dựa vào —
với bộ hệ số phát thải nền đo tại Việt Nam. Hình học thửa ruộng lưu bằng PostGIS, diện
tích tính từ ranh vẽ chứ không lấy số hộ khai.

**Bước 3 — Gộp lô tín chỉ tập thể.** Hàng trăm thửa trong một vụ gộp thành một lô có
mã, trừ đệm rủi ro 15% theo thông lệ Verra, và khoá toàn bộ số liệu đã dùng để phát
hành. Mỗi bản tính lưu lại phiên bản phương pháp luận, tham số đầu vào và bộ hệ số, nên
kiểm định viên tái lập được con số sau nhiều năm.

**Bước 4 — Chợ B2B.** Doanh nghiệp duyệt lô đang chào bán, đặt mua, thanh toán; hệ
thống chia doanh thu tự động về hợp tác xã và từng nông hộ theo đúng tỷ trọng đóng góp.

## 3. Mô hình kinh doanh

Mỗi đơn thanh toán xong được tách tự động ngay trong cơ sở dữ liệu:

| Phần | Mặc định | Ghi chú |
|---|---|---|
| Phí nền tảng | 12% | `credit_batches.platform_fee_pct`, đặt riêng cho từng lô |
| Phí quản lý hợp tác xã | 8% | `credit_batches.coop_admin_fee_pct` |
| **Nông hộ** | **80%** | Chia theo tỷ trọng giảm phát thải của từng hộ trong lô |

Bảng chia chi tiết đến từng nông hộ ghi vào `revenue_shares.breakdown`, hợp tác xã xem
được, doanh nghiệp mua thì không.

---

# Phần kỹ thuật

## Công nghệ

| Lớp | Dùng gì |
|---|---|
| Giao diện | Next.js 15 (App Router, Server Actions), React 19, Tailwind CSS v4 |
| Bản đồ | Leaflet, nền ảnh vệ tinh, vẽ và sửa polygon thửa ruộng |
| Dữ liệu | Supabase — Postgres + PostGIS, Auth, Storage, RLS |
| Trợ lý ảo | Google Gemini qua `@google/genai`, gọi công cụ, trả lời theo dòng |
| Kiểm tra đầu vào | Zod, TypeScript `strict` |
| Kiểm thử | Vitest (đơn vị + tích hợp trên cơ sở dữ liệu thật) |

## Chạy dự án

```bash
npm install
cp .env.example .env.local   # điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY
                             # thêm GEMINI_API_KEY nếu muốn bật trợ lý ảo
npm run dev                  # http://localhost:3000
```

Trước đó cần áp dụng lần lượt các tệp trong [supabase/migrations/](supabase/migrations/)
lên project Supabase, theo đúng thứ tự đánh số.

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy máy chủ phát triển |
| `npm run build` | Dựng bản phát hành |
| `npm start` | Chạy bản đã dựng |
| `npm test` | Kiểm thử engine MRV, hàm hình học và trợ lý (72 ca, không cần mạng) |
| `npm run test:e2e` | Kiểm thử tích hợp trên cơ sở dữ liệu thật, qua đúng RLS (40 ca) |
| `npm run types` | Kiểm tra kiểu TypeScript |

Bộ kiểm thử tích hợp cần hai tài khoản thử — tạo bằng
[supabase/seed-test-users.sql](supabase/seed-test-users.sql), chạy một lần trên project
phát triển.

## Bốn vai trò

| Vai trò | Vào đâu | Làm được gì |
|---|---|---|
| `coop_manager` | `/htx` | Toàn quyền trong hợp tác xã, gộp lô và chào bán tín chỉ |
| `coop_staff` | `/htx` | Nhập nhật ký canh tác |
| `buyer` | `/cho` | Duyệt lô đang chào bán, đặt mua, thanh toán thử |
| `platform_admin` | `/quan-tri` | Toàn cảnh nền tảng và dòng doanh thu |

Tài khoản hợp tác xã đăng ký xong sẽ vào `/thiet-lap` để **tạo đơn vị mới** hoặc **gia
nhập đơn vị đã có bằng mã** — người tạo trở thành `coop_manager`, người gia nhập sau là
`coop_staff`. Vai trò lưu trong `profiles` và không tự nâng lên được: trigger
`guard_profile_escalation` chặn ở tầng cơ sở dữ liệu.

## Luồng sử dụng

```
Thiết lập HTX → Thêm nông hộ → Vẽ ranh thửa → Tạo mùa vụ → Đăng ký thửa vào vụ
   → Ghi nhật ký (nước · phân bón · rơm rạ · ảnh) → Tính MRV
   → Gộp lô tín chỉ (trừ đệm 15%, khoá số liệu) → Chào bán
   → Doanh nghiệp đặt mua → Thanh toán → Chia doanh thu
```

## Bản đồ mã nguồn

```
src/
  app/
    dang-ky · dang-nhap · thiet-lap    đăng ký, đăng nhập, tạo/gia nhập hợp tác xã
    htx/                               không gian làm việc của hợp tác xã
      nong-ho · thua-ruong             hồ sơ nông hộ, vẽ ranh thửa
      mua-vu · thua-vu/[id]            mùa vụ, nhật ký canh tác và tính MRV
      lo-tin-chi · he-so               gộp lô, chào bán; tra cứu hệ số kèm nguồn
      tro-ly                           trò chuyện với trợ lý ảo
    cho · cho/[id] · don-hang          chợ tín chỉ, đặt mua, thanh toán
    quan-tri · quan-tri/tro-ly         toàn cảnh nền tảng; chọn model và khoá API
    api/chat                           một lượt hỏi–đáp của trợ lý, trả về theo dòng
    api/eval/chat                      điểm nối cho eval platform, chạy dữ liệu mẫu
  lib/
    mrv/engine.ts                      công thức IPCC, hàm thuần
    mrv/factors.ts                     nạp hệ số theo vùng và vụ từ cơ sở dữ liệu
    mrv/collect.ts                     gom nhật ký thành đầu vào cho engine
    gis/area.ts · region.ts            diện tích polygon, vùng đang triển khai
    chat/tools.ts · handlers.ts        công cụ trợ lý được gọi và cài đặt truy vấn
    chat/prompt.ts · knowledge.ts      system prompt và tri thức tĩnh về nền tảng
    chat/provider.ts · run.ts          hợp đồng nhà cung cấp và vòng lặp gọi công cụ
    chat/providers/                    danh mục nhà cung cấp; cài đặt Gemini
    chat/settings.ts                   ghép cấu hình: hệ thống → môi trường → mặc định
    chat/eval/                         dữ liệu mẫu và vết thực thi cho eval
    supabase/ · auth.ts                phiên đăng nhập phía máy chủ và trình duyệt
  middleware.ts                        chặn đường dẫn cần đăng nhập
supabase/migrations/                   lược đồ, RLS, RPC nghiệp vụ
tests/                                 mrv · gis · chat (đơn vị) · e2e/flow (tích hợp)
```

## Cơ sở dữ liệu

Mười hai migration, áp dụng theo thứ tự:

| Tệp | Nội dung |
|---|---|
| `0001_core_schema` | Hợp tác xã, tài khoản, nông hộ, thửa ruộng (PostGIS), mùa vụ, nhật ký |
| `0002_mrv_and_market` | Bảng hệ số, bản tính phát thải, lô tín chỉ, đơn hàng, thanh toán, chia doanh thu |
| `0003_rls` | Bật RLS toàn bộ và các hàm ngữ cảnh `app_user_role` / `app_coop_id` / `app_is_admin` |
| `0004_functions_storage_factors` | Kiểm tra chồng lấn ranh thửa, kho ảnh bằng chứng, nạp bộ hệ số IPCC |
| `0005_business_rpc` | `create_cooperative_and_join`, `join_cooperative_by_code`, `build_credit_batch`, `unlock_field_season`, `place_order`, `settle_sandbox_payment` |
| `0006_fields_api` | `save_field` và view GeoJSON cho bản đồ |
| `0007_harden` | Siết `search_path` và quyền của các trigger |
| `0008_vietnam_regional_factors` | Vùng miền, loại vụ, bộ hệ số Tier 2 đo tại Việt Nam |
| `0009_coop_two_tier` | Cơ cấu hành chính hai cấp tỉnh/xã |
| `0010_chat` | Hội thoại với trợ lý ảo, riêng tư theo từng người dùng |
| `0011_chat_settings` | Chọn nhà cung cấp, model và khoá API của trợ lý trên giao diện |
| `0012_signup_role_guard` | Chặn tự nâng quyền qua metadata lúc đăng ký |

## Ba quyết định thiết kế đáng chú ý

**Chế độ nước không do người dùng khai.** Hệ số SFw quyết định phần lớn lượng tín chỉ,
nên đây là chỗ dễ khai khống nhất. Hệ thống suy ra nó từ số lần tháo nước đã ghi trong
`water_events`: không tháo lần nào là ngập liên tục (1,0), một lần là 0,71, từ hai lần
trở lên mới đạt AWD (0,55).

**Diện tích tính từ hình học, không lấy số khai.** Thửa ruộng lưu dưới dạng polygon
PostGIS; `area_ha` do trigger tính từ `ST_Area`. Diện tích hộ khai chỉ để đối chiếu, và
bảng thửa ruộng tô màu cảnh báo khi lệch quá 15%. Ranh nhỏ hơn 100 m² bị từ chối vì gần như chắc
chắn vẽ nhầm. Khi lưu thửa, `check_field_overlap` báo ngay nếu ranh chồng lên thửa đã
có — kể cả thửa của **hợp tác xã khác**, vì khai trùng giữa hai đơn vị mới là gian lận
đáng lo. Chồng lấn là cảnh báo kèm tên hộ chứ không chặn cứng, do ranh vẽ tay có sai số.

**Con số đã phát hành thì khoá lại.** Gộp lô sẽ khoá các thửa-vụ trong lô, chặn mọi sửa
đổi nhật ký ở tầng trigger. Muốn sửa phải mở khoá bằng `unlock_field_season`, và khi mở
khoá thì kết quả tính cũ bị đánh dấu hết hiệu lực, buộc tính lại; lô đã xác minh hoặc
đã chào bán thì không mở được nữa. Mỗi bản tính lưu `methodology_version`, toàn bộ tham
số đầu vào và bộ hệ số đã dùng, nên con số tính hôm nay vẫn tái lập được sau nhiều năm.

## Phương pháp luận MRV

Theo IPCC 2019 Refinement, Vol.4 Ch.5.5 — nền tảng mà các methodology của Verra dựa vào:

```
CH₄ = EFc × SFw × SFp × SFo × t × A
SFo = (1 + Σ ROAᵢ × CFOAᵢ)^0.59
N₂O = N × EF1 × 44/28
```

Cộng thêm phần phát thải tránh được do ngừng đốt rơm rạ. Giảm phát thải = kịch bản nền
trừ kịch bản dự án, quy đổi về CO₂e theo GWP.

Engine ([src/lib/mrv/engine.ts](src/lib/mrv/engine.ts)) là hàm thuần, không đọc cơ sở dữ
liệu, và **không có hệ số mặc định** — bộ hệ số phải truyền từ ngoài vào, nạp từ bảng
`emission_factors` có đánh phiên bản (hiện tại `IPCC2019-VN-TIER2-1.0`). Thiếu một hệ số
là engine dừng chứ không tính bằng giá trị đoán. Mỗi bản tính lưu lại `ef_c_source_key`
để người kiểm định biết con số đến từ vùng và vụ nào. Tra cứu toàn bộ hệ số kèm nguồn
trích tại `/htx/he-so`.

Dữ liệu nhật ký thiếu thì engine cũng từ chối tính và nêu đích danh trường còn thiếu
(`MrvInputError`); màn hình nhập liệu hiện danh sách đó thành checklist.

## Hiệu chỉnh cho Việt Nam

**Hệ số phát thải nền theo vùng và mùa vụ.** Mặc định toàn cầu của IPCC là
1,19 kg CH₄/ha/ngày. Số đo tại 36 điểm trên cả nước cho thấy thực tế cao hơn nhiều và
chênh nhau rõ rệt giữa các vụ:

| Vùng | Vụ đầu năm | Vụ giữa năm | Vụ cuối năm |
|---|---|---|---|
| **Miền Bắc** | **2,21** | — | **3,89** |
| Miền Trung | 2,84 | 3,13 | 3,13 |
| Miền Nam | 1,72 | 2,80 | 3,58 |

*Đơn vị kg CH₄/ha/ngày. Nguồn: Vo et al. 2020, Climate 8(6):74 — đo theo đúng điều kiện
nền của IPCC (ngập liên tục, không bón chất hữu cơ) nên cắm thẳng vào công thức được.*

Riêng miền Bắc, Vụ Mùa phát thải nền gần gấp đôi Vụ Xuân. Dùng một con số chung sẽ tính
thiếu lượng giảm phát thải mà nông dân đáng được ghi nhận. Hệ thống chọn hệ số theo vùng
của hợp tác xã và loại vụ đã khai; miền Bắc chỉ có hai vụ nên giao diện không cho chọn vụ
giữa năm, và nếu dữ liệu cũ rơi vào tổ hợp không có hệ số thì engine báo lỗi chứ không lấy đại.

Các hệ số điều chỉnh (SFw, SFp, SFo), GWP và hệ số đốt rơm vẫn dùng giá trị toàn cầu của
IPCC vì chúng không phụ thuộc vùng miền.

**Phạm vi triển khai hiện tại chỉ có miền Bắc.** Giao diện chỉ trình bày hệ số và loại vụ
của vùng này; cơ sở dữ liệu vẫn giữ đủ hệ số của cả ba miền. Mở rộng sang vùng khác chỉ cần
sửa `ACTIVE_REGION` trong [src/lib/region.ts](src/lib/region.ts) và cho người dùng chọn lại
vùng khi tạo hợp tác xã.

**Cơ cấu hành chính hai cấp.** Từ 01/7/2025 Việt Nam bỏ cấp huyện; địa chỉ hợp tác xã chỉ
còn tỉnh/thành phố và xã/phường. Cột `district` giữ lại cho bản ghi cũ nhưng không nhập mới.

**Bản đồ nền là ảnh vệ tinh.** Bờ ruộng nhìn rõ trên ảnh chụp, còn bản đồ đường phố gần như
trống trơn ở vùng canh tác nên không vẽ ranh theo được. Vẫn chuyển sang bản đồ đường được
bằng nút ở góc trên bên phải.

## Chợ tín chỉ và thanh toán

Lô tín chỉ đi qua các trạng thái `draft → submitted → verified → listed → sold → retired`.
Chỉ lô đã `listed` kèm giá mới hiện trên `/cho`.

Đặt mua kiểm tra lượng còn khả dụng ngay trong `place_order`: **đơn đang chờ thanh toán
vẫn giữ chỗ**, nên không bán trùng cùng một lượng cho hai người mua.

Thanh toán đang chạy ở **chế độ thử**: `settle_sandbox_payment` chỉ cập nhật trạng thái
và ghi bảng chia doanh thu, không phát sinh giao dịch tiền thật; giả lập thất bại thì đơn
giữ nguyên trạng thái chờ. Khi cắm cổng thanh toán thật, webhook của nhà cung cấp gọi vào
chính hàm này — phần còn lại của hệ thống không đổi.

## Trợ lý ảo

Nút **Hỏi trợ lý** ở góc phải mọi màn hình sau đăng nhập, và trang riêng
[`/htx/tro-ly`](src/app/htx/tro-ly/page.tsx) cho hội thoại dài. Trợ lý trả lời tiếng Việt
hai nhóm câu hỏi: cách dùng hệ thống cùng phương pháp luận MRV, và số liệu thật của chính
người đang hỏi.

**Trợ lý không sinh câu lệnh SQL.** Model chỉ gọi được mười công cụ có kiểu rõ ràng —
tra hệ số, tổng kết mùa vụ, rà thửa còn thiếu nhật ký, xem chi tiết thửa-vụ, danh sách
nông hộ, lô tín chỉ, bảng chia doanh thu, chợ, đơn hàng. Mỗi công cụ là một truy vấn viết
sẵn chạy bằng **phiên đăng nhập của chính người dùng**, nên RLS chặn y như khi họ bấm trên
giao diện; không có công cụ nào ghi dữ liệu. Bỏ hướng để model tự sinh SQL vì tên nông hộ
và ghi chú nhật ký là chữ người dùng nhập, hoàn toàn có thể chứa câu lệnh cài vào để lái
model, và vì RLS chặn được rò rỉ dữ liệu nhưng không chặn được truy vấn nặng làm nghẽn cơ
sở dữ liệu.

**Trợ lý không tự tính MRV.** Công thức IPCC nằm trong prompt để giải thích cách hệ thống
tính, không phải để model tính hộ. Mọi con số phải đến từ công cụ gọi trong chính lượt đó;
thửa chưa có bản tính thì trả lời là chưa tính và chỉ chỗ bấm tính, chứ không ước lượng.
Trong một hệ thống mà con số đi vào hồ sơ phát hành tín chỉ, đây là quy tắc quan trọng hơn
cả sự trôi chảy của câu trả lời.

**Hội thoại riêng tư hơn mọi dữ liệu khác trong hệ thống.** Chỉ đúng chủ hội thoại đọc
được — đồng nghiệp cùng hợp tác xã và cả quản trị nền tảng đều không, vì câu hỏi người ta
gõ cho trợ lý thường là đang dò xem mình làm sai chỗ nào. Mỗi câu trả lời lưu kèm tên các
công cụ đã gọi, đủ để sau này truy được vì sao trợ lý nói ra một con số.

**Chọn model và khoá API trên giao diện.** Quản trị nền tảng vào `/quan-tri/tro-ly` để
đổi nhà cung cấp, đổi model và dán khoá API, có nút gọi thử một lượt thật để biết ngay
khoá dùng được hay không. Thứ tự ưu tiên là **cấu hình lưu trong hệ thống → biến môi
trường → mặc định**, xét riêng từng giá trị, và màn hình nói rõ mỗi giá trị đang đến từ
đâu để không ai phải đoán vì sao sửa biến môi trường mà không thấy tác dụng.

Khoá API được giữ bằng **quyền cột của Postgres**, không phải bằng mã ứng dụng: cột
`chat_settings.api_key` không cấp quyền đọc cho bất kỳ vai trò ứng dụng nào — kể cả quản
trị nền tảng. Ghi được, không đọc lại được, đúng cách một secret nên hành xử; giao diện
chỉ hiện bốn ký tự cuối qua một cột sinh sẵn. Máy chủ đọc khoá thật bằng service role,
gói trong đúng một hàm ([src/lib/supabase/admin.ts](src/lib/supabase/admin.ts)) và không
dùng ở bất kỳ chỗ nào khác. Chưa đặt `SUPABASE_SERVICE_ROLE_KEY` thì hệ thống vẫn chạy,
chỉ là khoá lấy từ biến môi trường.

Danh mục nhà cung cấp nằm ở [src/lib/chat/providers/registry.ts](src/lib/chat/providers/registry.ts);
thêm một nhà cung cấp là thêm một tệp và một dòng, giao diện tự có mục mới. Không có khoá
ở đâu cả thì trợ lý tự tắt kèm lời nhắc, phần còn lại của nền tảng chạy bình thường.

## Bảo mật

Toàn bộ phân quyền đặt ở tầng cơ sở dữ liệu bằng RLS, không ở tầng ứng dụng: kể cả khi mã
Next.js có lỗi, Postgres vẫn từ chối dữ liệu ngoài phạm vi. Mọi RPC nghiệp vụ là
`security definer` với `search_path` cố định, và view bản đồ dùng `security_invoker` nên
kế thừa đúng RLS của bảng gốc. Ảnh bằng chứng nằm trong bucket riêng, phân quyền theo thư
mục mang mã hợp tác xã.

Bộ kiểm thử tích hợp có các ca kiểm chứng điều này — doanh nghiệp không đọc được danh sách
nông hộ, không đọc được nhật ký canh tác, không xem được chi tiết từng thửa trong lô, hợp
tác xã không đặt mua tín chỉ được, không chèn được nông hộ vào hợp tác xã khác, và không
ai tự nâng quyền lên quản trị nền tảng được.

### Vai trò không tự nâng được, kể cả ở đường đăng ký

`handle_new_user` trước đây lấy vai trò thẳng từ `raw_user_meta_data`. Server action
`signUp` có chặn chỉ cho chọn `coop_manager` hoặc `buyer`, nhưng chặn đó nằm ở tầng
Next.js, trong khi `supabase.auth.signUp()` là API công khai gọi được bằng chính anon key
có sẵn trong bundle trình duyệt — bỏ qua tầng đó là tạo được tài khoản `platform_admin`,
và `app_is_admin()` mở toàn bộ RLS. `guard_profile_escalation` không bắt được vì nó chỉ
canh UPDATE, còn đây là INSERT lúc tạo hồ sơ.

`0012_signup_role_guard` đưa danh sách vai trò tự đăng ký được vào trong chính trigger.
Vai trò ngoài danh sách bị hạ về `coop_staff` chứ không báo lỗi, để người dò tìm không
nhận được tín hiệu nào. `platform_admin` từ nay chỉ cấp được bằng truy cập cơ sở dữ liệu
trực tiếp — nghĩa là tài khoản quản trị đầu tiên phải tạo từ phía máy chủ.

### Việc cần làm thủ công trên bảng điều khiển Supabase

- Bật **Leaked Password Protection** (Auth → Policies) để chặn mật khẩu đã lộ.

### Hai cảnh báo đã cân nhắc và chấp nhận

`public.spatial_ref_sys` và `public.st_estimatedextent(...)` thuộc chính extension PostGIS
nên Supabase tự cấp lại quyền, migration không siết được. Cả hai đều là dữ liệu tham chiếu
EPSG công khai, không chứa thông tin người dùng. Xử lý triệt để cần cài PostGIS vào schema
riêng thay vì `public`, và việc đó phải làm từ đầu vì mọi cột `geometry` đang tham chiếu
kiểu dữ liệu trong `public`.

## Kiểm thử

`tests/mrv.test.ts` và `tests/gis.test.ts` chạy không cần mạng: đối chiếu engine với phép
tính tay theo công thức IPCC, kiểm tra suy luận chế độ nước, xử lý hệ số thiếu, và diện
tích polygon.

`tests/e2e/flow.test.ts` chạy trên project Supabase thật bằng tài khoản thường (không phải
service key), đi hết luồng từ thiết lập hợp tác xã đến chia doanh thu, và kiểm chứng ranh
giới dữ liệu giữa các vai trò.

## Giới hạn hiện tại

- Chỉ có cây trồng lúa nước; enum `crop_type` mới có `'rice'`.
- Chỉ triển khai miền Bắc trên giao diện (xem `ACTIVE_REGION`).
- Thanh toán là chế độ thử, chưa cắm cổng thật.
- Kiểm định vẫn là bước ngoài hệ thống: trạng thái `verified` do quản trị viên đặt, nền
  tảng chỉ đóng gói hồ sơ để đơn vị kiểm định làm việc.
- Trợ lý chỉ đọc dữ liệu, chưa nhập liệu hộ; chưa có hạn mức số lượt hỏi mỗi ngày.
