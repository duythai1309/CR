# Trợ lý ảo sau khi gỡ nghiệp vụ cũ — và tích hợp vào giai đoạn lập kế hoạch

Nhiệm vụ: cắt trợ lý khỏi luồng hợp tác xã / chợ tín chỉ để mở đường cho đợt xoá lib cũ,
rồi tích hợp SÂU vào phần lập kế hoạch dự án Carbon (`PLAN.md` §3, bảy bước thiết kế).

Đợt này **không xoá** route cũ, `src/lib/mrv/*`, `src/lib/gis`, `src/lib/region.ts` hay
bảng nào — đó là đợt sau. Không chạm Supabase thật, không migration, không `npm install`.

## 1. Bộ công cụ: 12 → 7

Mười công cụ đọc bảng nghiệp vụ cũ đã bị gỡ khỏi `TOOLS`, `HANDLERS` và `FIXTURE_RESULTS`
cùng lúc: `tra_cuu_he_so`, `liet_ke_mua_vu`, `tong_ket_mua_vu`, `thua_thieu_nhat_ky`,
`chi_tiet_thua_vu`, `liet_ke_nong_ho`, `liet_ke_lo_tin_chi`, `chia_doanh_thu`,
`lo_dang_chao_ban`, `don_hang_cua_toi`.

| Công cụ | Trả về | Nguồn sự thật |
|---|---|---|
| `liet_ke_du_an` *(giữ, mở rộng)* | Dự án người hỏi là thành viên: vai trò **của chính họ**, `n/7` bước đã duyệt, Standard + cờ khoá, Methodology + loại hình + cờ mẫu, số thành viên, lần cập nhật gần nhất | `projects`, `project_members`, `project_stages`, `standards`, `methodologies` |
| `tien_do_du_an` *(giữ, mở rộng)* | Bảy bước: đã duyệt chưa, **duyệt lúc nào, ai duyệt**; **bước kế tiếp còn vướng điều kiện gì**; công việc theo trạng thái; kỳ giám sát; báo cáo gần nhất | thêm `project_tasks`, `monitoring_periods`, `mrv_reports`, RPC `project_member_directory` |
| `yeu_cau_cua_buoc` *(mới)* | Một bước cần thoả gì mới duyệt được, đã đạt tới đâu, ai được duyệt | **`approve_project_stage`** (`0013:696-714`) |
| `goi_y_methodology` *(mới)* | Methodology **trong catalog** khớp mô tả, kèm Standard, mã, version, loại hình, cờ mẫu và disclaimer của chính nó | `methodologies`, `standards` |
| `field_giam_sat_cua_methodology` *(mới)* | Field tách theo `scope: baseline` / `scope: observation`, kèm đơn vị, bắt buộc, ràng buộc giá trị, giá trị enum, tên cột CSV; cùng đại lượng tính ra và hệ số cần có | `metric_schema` đọc thẳng từ DB, parse bằng `parseMetricSchema` |
| `kiem_tra_baseline` *(mới)* | Baseline của dự án còn thiếu/sai field nào | `validateValues` trong `src/lib/methodology/schema.ts` |
| `cong_viec_theo_buoc` *(mới)* | Việc gom theo bước: tiêu đề, trạng thái, hạn, **quá hạn**, giao cho ai | `project_tasks`, `project_stages`, RPC danh bạ |

Mọi truy vấn đi qua **phiên của người dùng**, chịu RLS `projects_read`,
`project_tasks_read`, `monitoring_periods_read`… (`0013:887-915`). **Không service role ở
bất kỳ handler nào** — `createServiceClient` chỉ còn xuất hiện trong `settings.ts`, nơi
đọc khoá API của nhà cung cấp, không phải nơi đọc dữ liệu nghiệp vụ.

Tên thành viên lấy qua RPC `project_member_directory` (`0015_project_identity.sql`) chứ
không đọc `profiles`: policy `profiles_select` (`0003_rls.sql:59`) chỉ cho đọc hồ sơ người
cùng hợp tác xã, mà nền tảng dự án cố ý không gắn hợp tác xã.

### Vì sao mọi công cụ mở cho cả bốn `user_role`

`user_role` là trục quyền của module cũ và không có giá trị riêng cho nền tảng dự án
(`docs/design/auth-role-design.md` §1). Quyền thật nằm ở `project_members` + RLS. Lọc thêm
theo vai trò toàn cục ở tầng công cụ chỉ chặn nhầm người dùng hợp lệ chứ không chặn thêm
được gì, nên `toolsForRole` giờ trả cả bảy công cụ cho mọi vai trò. `findTool` vẫn giữ
nguyên chữ ký vì `src/app/api/chat/route.ts` dùng nó làm lớp chặn khi thực thi.

Cờ `needsCooperative` và hàm `toolsForContext` đã bỏ: không còn công cụ nào lọc theo
`app_coop_id()` thì không còn gì để lọc.

## 2. Ranh giới trung thực — phần quan trọng nhất

Người dùng là đơn vị làm hồ sơ tín chỉ thật. Một câu bịa về yêu cầu của Verra hay Gold
Standard có thể đi thẳng vào hồ sơ. Ràng buộc được đặt ở **ba tầng**, cố ý lặp lại:

1. **`knowledge.ts`** — chỉ chép điều mà mã nguồn hoặc migration cưỡng chế. Nêu rõ phạm vi
   dừng trước consultation, validation, đăng ký, VVB verification, standard review,
   issuance. Nêu rõ catalog chỉ có dữ liệu mẫu.
2. **`prompt.ts`** — khối `HONESTY_RULES` cấm mô tả yêu cầu của tổ chức chứng nhận từ trí
   nhớ, cấm thêm điều kiện "theo thông lệ" vào bảy bước, và bắt nói rõ giới hạn dữ liệu
   mẫu mỗi lần nhắc tới methodology.
3. **`ghi_chu` trong từng kết quả công cụ** — cùng cảnh báo đi kèm DỮ LIỆU. Đây là tầng
   còn đứng vững khi model quên phần đầu prompt: hằng số `CANH_BAO_MAU` trong
   `handlers.ts` được ghép vào năm công cụ có nhắc tới methodology, và có test bắt điều đó.

`yeu_cau_cua_buoc` là chỗ dễ bịa nhất nên bị siết riêng: danh sách điều kiện chép đúng
`approve_project_stage`, và `ghi_chu` nói thẳng "ngoài các điều kiện trên hệ thống không
cưỡng chế gì thêm — đừng suy diễn thêm điều kiện nào không có ở đây".

`kiem_tra_baseline` cũng nói rõ nó chỉ là kiểm tra **kỹ thuật** theo `metric_schema`,
không phải đánh giá chuyên môn xem kịch bản cơ sở có hợp lý hay không — việc đó thuộc VVB.

## 3. Nhận biết ngữ cảnh

`PAGE_HINTS` giờ chỉ còn mười mẫu `/du-an/**`; mọi mẫu `/htx`, `/cho`, `/don-hang`,
`/quan-tri`, `/thiet-lap` đã bỏ và có test khoá lại rằng chúng trả `null`.

Hint của `/du-an/[id]/quy-trinh` viết dài hơn các hint khác một cách có chủ ý: nó kể tên
đúng công cụ nên gọi (`yeu_cau_cua_buoc`), vì người đứng ở màn hình bảy bước gần như luôn
hỏi "bước này còn vướng gì" và không có lý do gì để trợ lý hỏi lại họ đang ở dự án nào.

`ChatPanel` bỏ `SUGGESTIONS_BY_ROLE` (bốn bộ theo vai trò) còn một bộ `SUGGESTIONS` duy
nhất về dự án, và `TOOL_LABEL` đổi theo bảy công cụ mới.

## 4. Điều cố ý KHÔNG làm

- **`src/lib/labels.ts` chưa bỏ được export nào.** Brief cho phép bỏ những export không
  còn ai import; grep lại sau khi cắt trợ lý cho thấy **cả 13 hằng số vẫn còn ít nhất một
  nơi import**, và mọi nơi đó là route cũ chưa bị xoá ở đợt này. Bỏ bây giờ là `npm run
  types` đỏ. Thay vào đó tệp mang một khối chú thích phân loại sẵn giữ / xoá cùng `/htx` /
  xoá cùng `/cho`+`/don-hang`, để đợt sau xoá theo danh sách thay vì grep lại từ đầu.
- **Prop `audience` của `ChatPanel`/`ChatWidget` vẫn còn trong kiểu**, dù không còn tác
  dụng: năm điểm gắn của module cũ vẫn truyền vào và chúng không nằm trong phạm vi ghi của
  đợt này — bỏ prop bây giờ là lỗi biên dịch ở đó.
- **`PromptContext.coopName` vẫn còn** vì `api/chat/route.ts` và `api/eval/chat/route.ts`
  vẫn truyền; **`FIXTURE_COOP` vẫn export** vì `api/eval/chat/route.ts:10` vẫn import.
  Cả ba bỏ cùng lúc với đợt gỡ route cũ.
- **Không dựng trang trợ lý toàn màn hình cho `/du-an`.** Trang duy nhất hiện nằm ở
  `/htx/tro-ly`, tức trong module cũ; dựng trang mới nằm ngoài phạm vi ghi của đợt này.

## 5. Kiểm thử — và cái bẫy

`tests/chat.test.ts:283-291` (cũ) chỉ canh `TOOLS` ↔ `FIXTURE_RESULTS`. Nó **không canh
`HANDLERS`**: sửa handler cho hỏng mà giữ nguyên `TOOLS` thì bộ test vẫn xanh. Vì vậy:

- `tests/project-chat-tools.test.ts` gọi **thật cả bảy handler** trên một client giả dựng
  lại chuỗi gọi PostgREST (`select/order/limit/eq/ilike` + `rpc`), với `metric_schema` hợp
  lệ để `parseMetricSchema` và `validateValues` chạy thật chứ không bị giả lập.
- Thêm phép chẵn lẻ mà bộ cũ thiếu: `TOOLS` ↔ `HANDLERS` phải trùng khít.
- Thêm test khoá rằng mười tên công cụ cũ không còn trong `TOOLS` lẫn `HANDLERS`.
- Thêm test cho chính các ràng buộc trung thực: `ghi_chu` phải nhắc `approve_project_stage`,
  phải nhắc "Verra", phải nhắc "đừng suy diễn"; `goi_y_methodology` không khớp gì thì phải
  bảo model nói thẳng là chưa có thay vì moi từ trí nhớ.
- Thêm test bắt fixture khớp với nhau: `buoc_da_duyet` của `liet_ke_du_an` phải bằng số
  bước `da_duyet` của `tien_do_du_an`; số field còn thiếu mà `yeu_cau_cua_buoc` nhắc phải
  bằng số lỗi `kiem_tra_baseline` trả về.

### Kết quả

```
npm run types  → sạch
npm run test   → 288/291 ca xanh (95 ca của hai tệp test chat: 43 + 52)
```

Ba ca đỏ đều nằm ở `tests/auth-role.test.ts` và **không thuộc việc này**: `worker-codex`
đã đổi `homePathFor` trong `src/lib/auth.ts` (vùng cấm của đợt này) để luôn trả `/du-an`,
trong khi test đó vẫn khẳng định ba đích cũ `/htx`, `/thiet-lap`, `/cho`. Tệp test đó cũng
không nằm trong danh sách được ghi ở đây.

Tổng số ca đổi từ 262 lên 291 vì bộ test chat được viết lại: bỏ 4 ca `missingMrvInputs`
(thuộc `src/lib/mrv/collect.ts` — thư viện cũ sắp xoá, và `tests/chat.test.ts` không phải
chỗ của chúng), bỏ các ca canh công cụ HTX, thêm ~40 ca cho bảy handler và cho ranh giới
trung thực. **Lưu ý cho đợt sau:** sau khi bỏ 4 ca đó, `missingMrvInputs` không còn test
nào phủ; nếu `src/lib/mrv/collect.ts` vì lý do nào đó được giữ lại thì phải viết lại test
cho nó trong `tests/mrv.test.ts`.

## 6. Điều còn chưa chắc

1. **Bảy handler chưa chạy trên cơ sở dữ liệu thật.** Client giả dựng lại chuỗi gọi
   PostgREST nên bắt được lỗi logic, nhưng **không** bắt được sai tên cột hay sai hình
   dạng trả về. `src/types/database.ts` chưa sinh lại được (mục C9) nên trình biên dịch
   cũng không bắt hộ.
2. **`validateValues` (TS) nghiêm hơn `project_validate_values` (SQL) ở một điểm**: bản TS
   xét `required_if`, bản SQL thì không. Với bốn methodology mẫu hiện tại không field nào
   dùng `required_if` nên hai bên trùng khớp; nhưng một methodology tương lai có
   `required_if` sẽ khiến `kiem_tra_baseline` báo thiếu trong khi DB vẫn cho duyệt. Bản TS
   cũng trả TẤT CẢ lỗi còn SQL dừng ở lỗi đầu tiên — khác biệt này có lợi, không gây sai.
3. **Trợ lý chưa được đánh giá lại bằng eval.** Bộ ca eval hiện có viết cho sản phẩm cũ;
   thay toàn bộ công cụ và viết lại `knowledge.ts` là đủ để đổi hành vi model. Nên chạy
   `/api/eval/chat` với bộ ca mới về bảy bước trước khi coi phần này là xong.
4. **Không có lớp chặn cứng cho ranh giới trung thực.** Prompt và `ghi_chu` là ràng buộc
   mềm; nếu model vẫn bịa yêu cầu của Verra thì không có gì trong mã chặn lại. Muốn chắc
   thì phải chấm bằng eval, hoặc thêm bộ lọc hậu kiểm ở `run.ts` — cả hai đều ngoài phạm
   vi đợt này.
