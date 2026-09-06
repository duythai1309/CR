# Bước 7 — kiểm thử end-to-end trên cơ sở dữ liệu thật

`PLAN.md` §6 bước 7. Chạy trên project Supabase phát triển `agri-carbon-pass`
(ref `uyzswphovqzmautoipfz`), sau khi người điều phối đã áp `0013`, `0015`, `0014`.

**Khác mọi bước trước:** bước này được phép đọc/ghi cơ sở dữ liệu thật.
Vẫn cấm `DROP`/`ALTER`, cấm sửa migration đã áp, cấm đụng dữ liệu HTX/chatbot/auth có sẵn.

## Hiện trạng cơ sở dữ liệu trước khi chạy

| Mục | Giá trị |
|---|---|
| Migration đã áp | 17 bản; ba bản mới là `project_platform`, `project_identity`, `project_platform_samples` |
| Thứ tự áp thực tế | `0013` → **`0015`** → `0014` (khác thứ tự số hiệu, xem phần Phát hiện) |
| Seed catalog | 2 Standard, 4 methodology MẪU đã published, 5 hệ số, 8 template placeholder |
| Dữ liệu cũ (không đụng) | 1 hợp tác xã, 21 nông hộ, 3 hội thoại chatbot, 2 tài khoản |
| Dự án trước khi chạy | 0 |

*(Các phần bên dưới được bổ sung dần trong lúc chạy.)*

---

## Cách chạy

```sh
# Một lần: tạo bốn tài khoản test của nền tảng dự án
#   psql/SQL editor  →  tests/e2e/seed-project-users.sql
npx vitest run --config vitest.e2e.config.ts tests/e2e/project-platform.test.ts
npx vitest run --config vitest.e2e.config.ts tests/e2e/flow.test.ts
```

Bộ test chạy bằng **khoá công khai và phiên đăng nhập thường**, nên mọi truy vấn chịu đúng
RLS như từ trình duyệt. Không dùng service role ở bất kỳ đâu ngoài hai ca báo cáo MRV.

Bốn tài khoản (`tests/e2e/seed-project-users.sql`): `duan-owner@`, `duan-dev@`,
`duan-viewer@`, `duan-outsider@` — tất cả `@test.local`, vai trò toàn cục `coop_staff`,
**không thuộc hợp tác xã nào**, đúng hình dạng tài khoản nền tảng dự án. Trigger
`on_auth_user_created` gán đúng `coop_staff` cho cả bốn — xác nhận danh sách trắng
`0012_signup_role_guard.sql:33-38` hoạt động trên DB thật.

## Kết quả tổng hợp

| Bộ | Đạt | Skip | Hỏng |
|---|---|---|---|
| `tests/e2e/project-platform.test.ts` (mới) | **48** | 2 | 0 |
| `tests/e2e/flow.test.ts` (module cũ, hồi quy) | **40** | 0 | 0 |
| `npm run test` (offline) | **262** | 0 | 0 |
| `npm run types` | sạch | | |
| `npm run build` | Compiled successfully | | |

## Từng ca — nền tảng dự án

### Tạo dự án và bảy bước

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| `create_project` | Sinh dự án + owner + đủ 7 stage trong một transaction | Đúng 1 owner; 7 stage đúng thứ tự và đúng tên `PLAN.md` §3 | ĐẠT |
| Dự án thứ hai | Tạo được, độc lập | Tạo được | ĐẠT |
| Thêm stage thứ 8 | Bị chặn | Lỗi; vẫn đúng 7 stage | ĐẠT |
| Xoá stage | Bị chặn | Lỗi (`project_guard_stage`) | ĐẠT |

### Thành viên và danh bạ (`0015`)

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Owner thêm developer + viewer qua RPC | Thành công, 3 thành viên | Đúng | ĐẠT |
| `project_member_directory` | Trả **họ tên**, không phải UUID trần | 3 dòng, mọi `full_name` không rỗng | ĐẠT |
| Owner thấy email | Có email | Cả 3 dòng có email | ĐẠT |
| Developer thấy email | **Không** thấy | Thấy đủ 3 tên, `email` đều `null` | ĐẠT |
| Người ngoài gọi danh bạ | Rỗng, không lỗi | `[]`, `error` null | ĐẠT |
| Owner tra người để mời | 1 dòng, `already_member=false` | Đúng | ĐẠT |
| Tra người đã là thành viên | `already_member=true` | Đúng | ĐẠT |
| Developer/người ngoài tra cứu | Bị chặn | Lỗi "Chỉ owner" cho cả hai | ĐẠT |
| Email `%` | Không liệt kê được ai | `[]` | ĐẠT |
| Gỡ owner cuối cùng | Bị chặn | Lỗi "owner cuối cùng" | ĐẠT |
| `profiles_select` không bị nới | Developer không đọc được hồ sơ người ngoài | `[]` | ĐẠT |

### Công việc và cách ly giữa dự án

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Owner tạo việc, giao developer | Thành công | Đúng | ĐẠT |
| Developer đổi trạng thái | Thành công | `in_progress` | ĐẠT |
| Giao việc cho **viewer** | Bị chặn | Lỗi khoá ngoại `assignee_role` | ĐẠT |
| Giao việc cho **người ngoài** | Bị chặn | Lỗi khoá ngoại | ĐẠT |
| Đổi `stage_id` sang stage dự án khác | Bị chặn | Lỗi khoá ngoại kép | ĐẠT |
| Đổi `project_id` sang dự án khác | Bị chặn ở **quyền cột** | Lỗi; `project_id` không đổi | ĐẠT |
| Viewer ghi công việc | Bị chặn | INSERT lỗi; UPDATE sửa 0 dòng | ĐẠT |
| Người ngoài đọc/ghi | Rỗng / lỗi | `[]` cho cả `projects` và `project_tasks`; INSERT lỗi | ĐẠT |
| Người ngoài tự thêm mình làm owner | Bị chặn cả hai đường | DML lỗi; RPC lỗi | ĐẠT |
| Developer xoá dự án | Bị chặn, kể cả xoá mềm | DELETE lỗi; `deleted_at` vẫn null | ĐẠT |

### Standard, Methodology, baseline, duyệt bước

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Chọn + khoá Standard | Thành công | Đúng | ĐẠT |
| Đổi Standard sau khi khoá | Bị chặn | Lỗi "Standard đã khóa" | ĐẠT |
| Chọn Methodology **sai Standard** | Bị chặn | Lỗi | ĐẠT |
| Chọn + khoá Methodology đúng Standard | Thành công | Đúng | ĐẠT |
| Viewer sửa dự án | Bị chặn | Sửa 0 dòng | ĐẠT |
| Baseline sai **hình dạng** (mảng) | Bị chặn | Lỗi `check` | ĐẠT |
| Baseline sai **nội dung** | *(xem Phát hiện 1)* | **Lưu được** | ĐẠT (đã sửa kỳ vọng) |
| `baseline_revision` tăng mỗi lần lưu | Tăng | Tăng | ĐẠT |
| Duyệt nhảy cóc bước 3 | Bị chặn | Lỗi "Cần duyệt các stage trước" | ĐẠT |
| Developer duyệt bước | Bị chặn | Lỗi "Chỉ owner" | ĐẠT |
| Bốn bước đầu duyệt được dù baseline sai | Thành công | Đúng | ĐẠT |
| **Cổng 1** — bước 5 với baseline sai | Bị chặn | Lỗi | ĐẠT |
| Sửa baseline rồi duyệt nốt 5–7 | Thành công, `approved_by` = owner | Cả 7 bước đã duyệt | ĐẠT |

### Giám sát

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Developer tạo kỳ | Bị chặn | Lỗi | ĐẠT |
| **Cổng 2** — tạo kỳ với baseline sai | Bị chặn | Lỗi | ĐẠT |
| Owner tạo kỳ | Chụp lược đồ + baseline + hệ số | `status=open`, `data_revision=0`, `baseline_snapshot` đúng, `factors_snapshot` là mảng, có `schema_hash` | ĐẠT |
| Nhập tay một quan sát | Thành công, `revision=1` | Đúng | ĐẠT |
| `expected_revision` sai | Bị chặn | Lỗi có chữ "revision" | ĐẠT |
| Quan sát ngoài khoảng ngày kỳ | Bị chặn | Lỗi | ĐẠT |
| Viewer nhập số liệu | Bị chặn | Lỗi | ĐẠT |
| Nhập CSV qua đúng đường server action | 2 dòng vào, tổng 3 quan sát | `O-001,O-002,O-003` | ĐẠT |
| CSV có 1 dòng sai | **Không dòng nào** vào | `prepareImportRecords` ném lỗi; số quan sát không đổi | ĐẠT |
| Owner khoá kỳ | Đóng băng vào `data_snapshot` | `status=locked`, có `locked_at`, snapshot 3 dòng | ĐẠT |
| Ghi/xoá sau khi khoá | Bị chặn cả hai | Lỗi cả hai; vẫn đúng 3 quan sát | ĐẠT |

### Báo cáo MRV

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Người dùng thường gọi `create_mrv_report` | Bị chặn | Lỗi — đúng thiết kế, RPC chỉ cấp cho `service_role` | ĐẠT |
| Backend sinh báo cáo preview từ kỳ đã khoá | — | **SKIP** | SKIP |
| Dữ liệu MẪU không xuất được bản `final` | — | **SKIP** | SKIP |

**Lý do skip (cả hai ca):** `SUPABASE_SERVICE_ROLE_KEY` chưa được đặt trong môi trường.
`create_mrv_report` được cấp **chỉ** cho `service_role` (`0013:994-995`) vì nó nhận
`p_requested_by` như tham số — ai gọi được cũng ghi được báo cáo dưới tên người khác. Bộ
test dùng `it.skipIf` và **không** giả lập bằng khoá khác, không tìm đường lách. Đặt biến
môi trường đó rồi chạy lại là hai ca này tự chạy.

⚠️ Vì vậy **đường sinh báo cáo MRV vẫn CHƯA được kiểm chứng đầu-cuối trên DB thật.** Đây là
mảng lớn nhất còn trống của bước 7.

## Hồi quy phần được giữ — `tests/e2e/flow.test.ts`

**40/40 ĐẠT.** Ba migration mới **không làm hỏng** module cũ: nông hộ, thửa ruộng, mùa vụ,
tính MRV, gộp lô tín chỉ, đặt hàng, thanh toán, chia doanh thu và chatbot đều chạy như cũ.

Đây là câu trả lời trực tiếp cho rủi ro R2/R3/R8 trong `docs/audit/audit-keep.md`: vì bước
6 chọn **THÊM, KHÔNG GỠ**, phần cũ không suy suyển.

## Phát hiện

### 1. `projects.baseline` không kiểm nội dung lúc ghi — kiểm ở hai cổng

Ca đầu tiên của tôi kỳ vọng cơ sở dữ liệu từ chối `{"baseline_stock_tc_ha": 42}` (số, thay
vì chuỗi canonical cho field `decimal`). **Nó không từ chối.** Kiểm chứng trực tiếp trên DB:

- `projects.baseline` chỉ có `CHECK (jsonb_typeof(baseline) = 'object')`.
- `project_guard_project` **không** gọi `project_validate_values`.
- `approve_project_stage` **có** gọi (bước ≥ 5); `create_monitoring_period` **có** gọi.

Nên đây **không phải lỗ hổng**, mà là hợp đồng "lưu bản nháp tự do, kiểm ở cổng". Hai cổng
đều đã được kiểm chứng đóng đúng (ca *Cổng 1* và *Cổng 2*). Tôi đã **sửa kỳ vọng của test**
cho khớp hành vi thật thay vì sửa cơ sở dữ liệu, và bổ sung hai ca cổng — bộ test giờ mạnh
hơn lúc đầu.

Điều cần biết cho người viết giao diện: **không được coi việc lưu baseline thành công là
baseline đã hợp lệ.** `saveBaseline` trong Module A đã tự kiểm bằng `validateValues` trước
khi ghi, nên đường qua giao diện an toàn; đường gọi thẳng PostgREST thì không.

### 2. `tests/e2e/flow.test.ts` tạo thêm 2 hội thoại chatbot mỗi lần chạy

Số `chat_conversations` đi từ 3 lên 5 trong phiên làm việc này. Truy nguồn theo thời điểm
tạo (08:37:42 UTC) cho thấy chúng do **chính `flow.test.ts`** sinh ra, không phải bộ test
mới của tôi — bộ test dự án không chạm gì tới chatbot. Đây là hệ quả của việc bộ e2e cũ
không tự dọn (đã ghi ở `flow.test.ts:27`), không phải điều bước 7 gây ra thêm.

### 3. Thứ tự áp migration khác thứ tự số hiệu

Trên DB thật: `project_platform` → **`project_identity`** → `project_platform_samples`,
tức `0013` → `0015` → `0014`. Không gây hại vì `0015` chỉ tạo hai hàm phụ thuộc
`project_members` và `profiles`, không phụ thuộc seed. Nhưng người dựng lại cơ sở dữ liệu
từ đầu theo thứ tự số hiệu sẽ ra một trình tự **khác** với production — cần biết để không
ngạc nhiên.

## Dữ liệu để lại trên cơ sở dữ liệu

| Bảng | Số dòng để lại | Ghi chú |
|---|---|---|
| `projects` | 4 | Tất cả tên bắt đầu `E2E-TEST-`, **tất cả đã xoá mềm** (`deleted_at` khác null) |
| `project_stages` | 28 | 7 stage × 4 dự án; **không xoá được** |
| `project_members` | 4 | Chỉ còn owner của mỗi dự án |
| `monitoring_periods` | 2 | Đã khoá |
| `monitoring_data` | 6 | Nằm trong kỳ đã khoá |
| `project_tasks` | 0 | Đã dọn |
| `mrv_reports` | 0 | Chưa sinh được (xem phần skip) |
| `auth.users` | +4 | `duan-*@test.local`, UUID cố định `e2e00000-...` |

**Không xoá cứng được, và đây là hành vi đúng chứ không phải thiếu sót.**
`project_guard_stage` (`0013:592-604`) từ chối mọi `DELETE` trên `project_stages`, còn
`project_stages.project_id` là `on delete restrict` — nên xoá dự án bị chặn hai lớp. Bỏ
được ràng buộc đó thì phải `ALTER`/`DROP TRIGGER`, mà bước 7 cấm điều đó và tôi **không
tìm đường vượt**. Bù lại, mọi bản ghi đều mang nhãn `E2E-TEST-` và đã xoá mềm.

Muốn dọn sạch về sau thì cần một migration `0016_*` được review riêng (tạm vô hiệu trigger
trong transaction rồi xoá theo nhãn), hoặc chấp nhận để lại. **Tôi không tạo migration đó**
vì brief yêu cầu báo lại trước.

Dữ liệu cũ **không bị đụng**: `cooperatives` vẫn 1 dòng; không bảng HTX/auth nào bị sửa.

## Điều vẫn chưa kiểm chứng được

1. **Sinh báo cáo MRV đầu-cuối** — thiếu `SUPABASE_SERVICE_ROLE_KEY`. Đây là khoảng trống
   quan trọng nhất: cả `estimateMrvReport` lẫn `create_mrv_report` chưa chạy lần nào trên
   dữ liệu thật, nên `PLAN.md` §7 ("xuất thử 1 report") **chưa hoàn tất**.

2. **Tải tệp lên Storage** — mục C13 vẫn mở. Bộ test không đụng `project-documents`, nên
   nghi vấn "policy `restrictive` chặn chính đường upload" **chưa được trả lời**. Cần một
   lượt upload thật bằng `supabase-js` với phiên `authenticated`.

3. **Giao diện chưa chạy thật trên trình duyệt.** Bộ test gọi thẳng PostgREST/RPC như
   server action làm, nhưng chưa có lượt render/thao tác thật nào — `npm run build` đạt
   không đồng nghĩa mọi màn hình hoạt động.

4. **Trợ lý chưa chạy trên dữ liệu dự án thật.** Hai công cụ `liet_ke_du_an` và
   `tien_do_du_an` (bước 6) mới được kiểm bằng client giả; chưa lượt gọi PostgREST nào.

5. **Đồng thời và tải.** Chỉ kiểm `expected_revision` tuần tự, chưa thử hai người ghi cùng
   lúc trên DB thật, chưa thử kỳ nhiều nghìn quan sát.

6. **Giới hạn 1 MB của server action** (tải tệp, nhập CSV lớn) — chưa kiểm, và sửa được
   bằng một dòng trong `next.config.ts`.
