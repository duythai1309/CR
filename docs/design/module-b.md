# Module B — giám sát và báo cáo MRV (giao diện)

Bước 5 của `PLAN.md` §6, theo `PLAN.md` §4. Dựng **giao diện** trên lõi TypeScript do
`worker-codex` viết (`docs/design/engine-core.md`) và schema `0013_project_platform.sql`.

Lõi được **import và dùng nguyên trạng**: `src/lib/methodology/**`, `src/lib/monitoring/**`,
`src/lib/mrv/report.ts`, `src/types/project-platform.ts` không bị sửa một dòng nào.

## Route đã tạo

| Route | Nội dung |
|---|---|
| `/du-an/[id]/giam-sat` | Danh sách kỳ giám sát, tạo kỳ mới |
| `/du-an/[id]/giam-sat/[periodId]` | Dashboard một kỳ: đối chiếu baseline, nhập tay, nhập CSV, ước tính + vết tính, khoá kỳ |
| `/du-an/[id]/bao-cao` | Danh sách báo cáo, sinh báo cáo từ kỳ đã khoá |
| `/du-an/[id]/bao-cao/[reportId]` | Chi tiết báo cáo, ảnh chụp, vết tính, hai đường xuất |
| `/du-an/[id]/bao-cao/[reportId]/in` | Bản in (Ctrl/Cmd+P → lưu PDF) |
| `/du-an/[id]/bao-cao/[reportId]/csv` | Tải CSV số liệu |

Component dùng chung: `src/components/monitoring/` — `metric-fields.tsx` (ô nhập sinh từ
schema), `csv-import.tsx` (xem trước lỗi), `trace-view.tsx` (vết tính), `summary.ts`
(gom số liệu, thuần và có test).

## Quyết định đáng ghi lại

**Form sinh từ `metric_schema`, không switch theo loại dự án.** Cả nhập tay lẫn nhập CSV
đi qua `buildMethodologyForm`, nên bốn methodology mẫu trong `0014` — rừng (AFOLU), điện
thay thế, biogas — dùng chung một màn hình. Không chỗ nào trong giao diện nhắc tên một
methodology cụ thể.

**Số thập phân là CHUỖI, từ ô nhập tới cơ sở dữ liệu.** Ô nhập dùng `type="text"` +
`inputMode="decimal"` chứ không phải `type="number"`: `type="number"` cho trình duyệt
quyền chuẩn hoá lại theo locale và đưa giá trị qua dấu phẩy động. Cả `summary.ts` cũng
tính bằng `Decimal` của lõi, không bằng `number`.

**Xem trước CSV chạy trên trình duyệt, nhưng không phải ranh giới tin cậy.** Cùng bộ hàm
(`parseCSV`/`previewTable`) chạy hai lần: một lần trong trình duyệt để người dùng thấy hết
lỗi theo dòng/cột trước khi gửi, một lần trên máy chủ (`prepareImportRecords`) trên chính
văn bản gửi lên. Máy chủ không tin cờ `valid` của trình duyệt. Còn một lỗi thì **không
dòng nào** được ghi — `prepareImportRecords` ném lỗi, và RPC chạy trong một transaction.

**Chỉ nhận CSV, và nói thẳng như vậy.** Lõi có sẵn chỗ cắm `SpreadsheetParser` nhưng chưa
có bộ đọc `.xlsx`, và việc thêm thư viện đã bị chốt là để sau. Giao diện ghi rõ "Tệp Excel
(.xlsx) chưa hỗ trợ — hãy lưu sang CSV trước" thay vì hứa rồi hỏng.

**Kỳ đang mở tính tại chỗ, kỳ đã khoá tính từ ảnh chụp.** Dashboard gọi thẳng
`evaluateMethodology` để hiện ước tính trực tiếp. Báo cáo thì đi qua `estimateMrvReport`,
vốn từ chối nếu kỳ chưa khoá hoặc dữ liệu lệch khỏi ảnh chụp — nên con số trong báo cáo
không bao giờ đổi theo dữ liệu sau này.

**Vết tính hiện nguyên bản.** `trace-view.tsx` in đúng chuỗi engine trả về, không định
dạng lại theo locale, không làm tròn cho đẹp. Người mở vết ra là để kiểm; làm tròn ở đó là
bóp méo đúng thứ họ đang kiểm.

**Client `service_role` riêng, phạm vi một hàm.** `create_mrv_report` chỉ được cấp cho
`service_role` (`0013:994-995`) vì nó nhận `p_requested_by` như tham số. Trình tự bắt buộc,
ghi trong `bao-cao/service-client.ts`: xác thực bằng phiên người dùng → đọc kỳ và dữ liệu
bằng client **của người dùng** (RLS còn hiệu lực) → tính bằng hàm thuần → chỉ bước ghi cuối
dùng service role, với `p_requested_by` lấy từ phiên đã xác thực. Cố ý **không** tái dùng
`src/lib/supabase/admin.ts`: tệp đó tồn tại cho đúng một việc khác, và nới phạm vi của nó
là cách một client bỏ qua RLS lan ra khắp mã nguồn.

## Sự trung thực của con số — bốn chỗ được cưỡng chế

1. Báo cáo luôn ghi `p_status: 'preview'`. Giao diện **không có** đường tạo `final`;
   `create_mrv_report` (`0013:838-840`) cũng từ chối `final` từ methodology chưa thẩm định,
   nên hai lớp nói cùng một điều.
2. Nhãn `Ước tính MRV — không phải tín chỉ đã phát hành` xuất hiện trên trang danh sách,
   trang chi tiết, bản in và tệp CSV.
3. Trang báo cáo nêu rõ methodology đang dùng là **dữ liệu MẪU do nhóm tự soạn, chưa thẩm
   định**, lấy từ chính cột `disclaimer`/`is_sample` trong cơ sở dữ liệu.
4. Bản in **cố ý không** mang hình thức của Verra hay Gold Standard, và nói thẳng nó không
   phải mẫu chính thức. Một tài liệu trông giống hồ sơ chính thức mà không phải hồ sơ chính
   thức nguy hiểm hơn là không có gì để in.

## Kiểm chứng

```
npm run types  → sạch
npm run test   → 245/245 (204 nền + 27 Module A + 14 Module B mới)
npm run build  → Compiled successfully; cả 6 route của Module B dựng được
```

Không chạm Supabase thật; không `db push`, không `apply_migration`, không `test:e2e`,
không `npm install`.

## Chưa làm được và vì sao

1. **Export theo template thật của Standard — chưa làm được.** `PLAN.md` §4 nói "export
   theo template chuẩn của Standard". Kho mã **không có** tệp mẫu PDF/Word của Verra hay
   Gold Standard; bảng `report_templates` chỉ có bản ghi `placeholder` với
   `object_path`/`checksum` là NULL. Thay vào đó xuất bằng thứ làm được không cần thư viện
   mới: bản in HTML (trình duyệt lưu PDF) và CSV. Cả hai đều ghi rõ không phải mẫu chính
   thức. Cần tệp mẫu thật cộng một bộ dựng tài liệu thì mới làm đúng được.

2. **Chưa chạy trên cơ sở dữ liệu thật.** Toàn bộ Module B gọi RPC qua PostgREST, mà chưa
   lượt gọi nào chạy thật — `0013`–`0015` mới áp trên Docker cục bộ. Rủi ro cụ thể nhất:
   hình dạng tham số `p_records` (mảng object JSON) và kiểu trả về của
   `save_monitoring_records`. Đây là điều chưa chắc lớn nhất của bước này.

3. **Sinh báo cáo cần `SUPABASE_SERVICE_ROLE_KEY`, hiện chưa đặt.** Không có khoá thì màn
   hình báo đúng lý do thay vì lỗi khó hiểu, nhưng chức năng chưa dùng được cho tới khi
   người vận hành đặt biến môi trường đó ở phía máy chủ.

4. **Nhập tệp lớn có thể vượt giới hạn server action.** Văn bản CSV đi kèm biểu mẫu, mà
   Next.js mặc định giới hạn thân yêu cầu 1 MB; nới cần `serverActions.bodySizeLimit` trong
   `next.config.ts` — tệp không nằm trong danh sách được ghi ở bước này. Lõi cho tới 10 Mi
   ký tự, nên khoảng giữa hiện sẽ lỗi.

5. **`.xlsx` chưa hỗ trợ** — đã chốt để sau; interface `SpreadsheetParser` giữ nguyên chỗ
   cắm, giao diện không hứa.

6. **Chưa có quy tắc chọn kỳ hiệu lực khi nhiều bản chồng nhau.** `0013` cho phép nhiều kỳ
   cùng khoảng ngày khác `version` (để hiệu chỉnh) và **không** có cột `supersedes`. Giao
   diện liệt kê tất cả; cộng dồn nhiều bản của cùng một khoảng ngày sẽ tính trùng. Đây là
   điểm bất định số 4 mà `docs/design/schema-project-platform.md` đã nêu, chưa giải.
