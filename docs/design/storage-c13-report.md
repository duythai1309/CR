# C13 — kiểm chứng upload Storage thật

Đóng mục **C13 (P1)** trong `docs/design/schema-review-findings.md` — phát hiện duy nhất
còn mở từ lượt review schema, và cũng là mục 2 trong phần "chưa kiểm chứng được" của
`docs/design/e2e-report.md`.

Chạy trên Supabase dev `agri-carbon-pass` (`uyzswphovqzmautoipfz`) ngày 06/9/2026.
Toàn bộ ca dùng **phiên `authenticated` thật qua khoá công khai** — không service role.

---

## Câu trả lời dứt điểm

> **C13 ĐẠT. Hai policy `restrictive` KHÔNG chặn đường upload hợp lệ. KHÔNG cần migration `0016`.**

Nghi vấn ban đầu là Supabase Storage upload bằng `INSERT` **rồi** `UPDATE` metadata, nên
`project_platform_objects_no_update` (`0013:970-972`) sẽ chặn luôn cả đường ghi hợp lệ.
Thực đo cho thấy **không phải vậy**: đường upload thường chỉ cần `INSERT`, và nó chạy
thành công.

Bằng chứng dứt điểm nằm ở chỗ hai kết quả này cùng đúng một lúc:

| Thao tác | Kết quả thật |
|---|---|
| `upload(path, blob)` — đường thường | **THÀNH CÔNG**, `error = null`, trả đúng `path` |
| `upload(path, blob, { upsert: true })` — sinh UPDATE | **BỊ CHẶN**, `403 AccessDenied` |

Nếu đường upload thường có bước UPDATE thì ca thứ nhất đã phải hỏng giống ca thứ hai.
Nó không hỏng ⇒ upload thường không đụng tới UPDATE ⇒ policy restrictive chỉ chặn đúng
thứ nó nhắm tới là **ghi đè**.

Và ghi đè bị chặn là **đúng thiết kế**, không phải lỗi: tệp trong hệ thống này cố ý bất
biến (`project_files` có trigger `project_files_immutable`, `0013:618`). Mã sản phẩm không
bao giờ dùng `upsert` — `uploadDocument` và `attachFileToTask` sinh một `randomUUID()` mới
cho mỗi lần tải lên, nên mỗi tệp là một đường dẫn mới.

Nguyên văn lỗi của ca upsert, để đối chiếu về sau:

```json
{"message":"new row violates row-level security policy",
 "name":"StorageApiError","status":400,"statusCode":"403","code":"AccessDenied"}
```

Thông điệp `new row violates row-level security policy` khớp với `with check` của
`project_platform_objects_no_update` — đúng policy đã nhắm tới, không phải policy khác.

---

## Từng ca — `tests/e2e/storage-upload.test.ts`

**18/18 ĐẠT.**

### C13.1 — đường upload hợp lệ

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Developer upload `{project}/{user}/{tên}` (3 đoạn) | Thành công | `error = null`, path đúng | ĐẠT |
| Đường **4 đoạn** mà mã sản phẩm sinh ra `{project}/{user}/{uuid}/{tên}` | Thành công | `error = null`, path đúng | ĐẠT |

Ca thứ hai quan trọng riêng: `src/app/du-an/**` sinh đường dẫn bốn đoạn, khác dạng tối
thiểu ba đoạn mà ràng buộc `check` đòi. Cả hai đều qua được cả `check` của bảng lẫn policy
`storage.objects` — nghĩa là mã sản phẩm hiện tại upload được thật.

### C13.2 — upsert

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Upload lại cùng path, không upsert | Bị từ chối vì trùng | Lỗi | ĐẠT |
| Upload lại cùng path, `upsert: true` | *(đo, không định trước)* | **BỊ CHẶN** `403 AccessDenied` | ĐẠT — đúng thiết kế bất biến |

### C13.3 — metadata `project_files`

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Đăng ký metadata với checksum sha256 đúng | Thành công | `error = null` | ĐẠT |
| `object_path` cấp 1 không phải `project_id` | Bị chặn | Lỗi `check` | ĐẠT |
| `object_path` cấp 2 không phải người tải lên | Bị chặn | Lỗi `check` | ĐẠT |
| Checksum sai định dạng | Bị chặn | Lỗi `check` | ĐẠT |

### C13.4 — phân quyền upload

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Viewer upload | Bị chặn | `403 AccessDenied` | ĐẠT |
| Người ngoài dự án upload | Bị chặn | Lỗi | ĐẠT |
| Developer upload vào **thư mục người khác** | Bị chặn | Lỗi | ĐẠT |
| Người ngoài upload vào dự án không thuộc | Bị chặn | Lỗi | ĐẠT |

### C13.5 — đọc

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Owner / developer / viewer tải tệp | Đều tải được | Cả ba `error = null`, nội dung đúng | ĐẠT |
| Người ngoài tải | Không tải được | Bị chặn | ĐẠT |
| Người ngoài liệt kê thư mục | Rỗng | `[]` | ĐẠT |

Viewer tải được là **đúng** `PLAN.md` §5: người xem đọc mọi thứ trong dự án, chỉ không ghi.

### C13.6 — xoá

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Developer xoá object trong bucket mới | Bị chặn | `data = 0 dòng`, `error = null`; tệp vẫn tải được | ĐẠT |

### C13.7 — hồi quy bucket `evidence`

| Ca | Kỳ vọng | Kết quả thật | KL |
|---|---|---|---|
| Cán bộ HTX upload rồi xoá trong `evidence` | Cả hai đều được | Upload `error = null`; xoá trả đúng 1 dòng | ĐẠT |

Đây là điểm mấu chốt của hồi quy: policy `restrictive` chỉ phủ hai bucket **mới**, nên
`evidence_delete` của `0004_functions_storage_factors.sql:69-71` còn nguyên tác dụng.
Phân tích tĩnh ở lượt review nói đúng, và giờ đã có bằng chứng chạy thật.

---

## Phát hiện phụ

### 1. Xoá bị chặn trả về "thành công rỗng", không phải lỗi

`storage.remove()` trên bucket mới trả `data = []` và `error = null`. Ứng dụng **không
phân biệt được** "đã xoá" với "bị policy chặn" nếu chỉ kiểm `error`.

Hiện không ảnh hưởng: Module A không có đường xoá object — nút "Gỡ" chỉ xoá dòng
`task_attachments`, không đụng tệp. Nhưng ai viết tính năng xoá tệp sau này phải kiểm
`data.length`, không kiểm `error`.

### 2. Bucket `evidence` chỉ nhận ảnh

Lần chạy đầu ca C13.7 hỏng với `415 InvalidMimeType` vì tôi gửi `text/plain`. Không phải
lỗi sản phẩm: `evidence` khai `allowed_mime_types = {image/jpeg, image/png, image/webp,
image/heic}` (`0004:54-59`). Đã sửa test dùng PNG 1×1. Ghi lại vì đây là ràng buộc dễ vấp.

Đối chiếu ba bucket trên DB thật:

| Bucket | Giới hạn | MIME |
|---|---|---|
| `evidence` | 10 MiB | chỉ ảnh |
| `project-documents` | 50 MiB | PDF, DOCX, XLSX, CSV, ảnh |
| `methodology-templates` | 50 MiB | PDF, DOCX |

### 3. Điều đã đo và điều chỉ suy ra

Đã đo: đường upload của người dùng chạy thành công đầu-cuối dưới phiên `authenticated`.
**Chưa đo:** chuỗi câu lệnh SQL mà Storage server phát ra bên trong. Kết luận "upload
thường không cần UPDATE" là **suy ra** từ việc upload thành công trong khi upsert bị chặn —
suy luận chắc chắn, nhưng không phải quan sát trực tiếp vào log của Storage.

---

## Có cần migration `0016` không

**Không.** Không viết tệp `0016_storage_upload_fix.sql` nào, vì không có gì để sửa:
đường upload hợp lệ chạy được, còn thứ bị chặn (`upsert`, `delete`) đúng là thứ thiết kế
muốn chặn.

Nếu về sau sản phẩm **cần** ghi đè tệp tại chỗ, khi đó mới phải cân nhắc bỏ
`project_platform_objects_no_update`. Đánh đổi lúc đó: người có quyền ghi trong dự án sẽ
thay được **nội dung bytes** của một object trong khi hàng `project_files` giữ nguyên
`checksum` cũ — tức checksum không còn chứng minh được điều gì, và báo cáo MRV trỏ tới tệp
đó mất tính kiểm chứng. Với một hệ thống mà toàn bộ giá trị nằm ở tính kiểm chứng được,
giữ nguyên chặn là lựa chọn đúng.

---

## Tệp còn lại trên Storage

Bucket `project-documents` — **4 tệp, không xoá được** (đúng thiết kế bất biến, và bước
này cấm `ALTER`/`DROP` để lách):

```
f43607ae-…/e2e00000-…-000000000002/E2E-TEST-696422122-ngan.csv
f43607ae-…/e2e00000-…-000000000002/523da697-…/E2E-TEST-696422122-that.csv
f5727452-…/e2e00000-…-000000000002/E2E-TEST-696464669-ngan.csv
f5727452-…/e2e00000-…-000000000002/30a53526-…/E2E-TEST-696464669-that.csv
```

Mỗi tệp 61 byte, `text/csv`, tên mang tiền tố `E2E-TEST-`, nằm dưới thư mục của hai dự án
`E2E-TEST-…` do bộ test tạo. Xoá được thì phải dùng service role hoặc bỏ policy — **không
làm**, vì brief cấm và vì để lại đúng 244 byte có nhãn rõ ràng rẻ hơn việc nới quyền.

Bucket `evidence` — **6 tệp, tất cả từ 01/9/2026**, tức dữ liệu cũ. Tệp mà ca C13.7 tải lên
đã **tự xoá thành công**, nên không để lại gì. Dữ liệu HTX không bị đụng.

Bộ test cũng tạo thêm 2 dự án `E2E-TEST-…` (một cho luồng chính, một cho ca upload chéo dự
án). Cùng lý do đã ghi ở `docs/design/e2e-report.md`, dự án không xoá cứng được.

---

## Vẫn chưa kiểm được

1. **TUS / resumable upload.** `supabase-js` `.upload()` dùng đường POST thường cho tệp
   nhỏ. Tệp lớn qua đường resumable có thể phát sinh `UPDATE` trên `storage.objects` và khi
   đó sẽ vấp policy. Cần kiểm riêng nếu sản phẩm bật resumable.
2. **Tệp lớn.** Chỉ thử 61 byte. Giới hạn 50 MiB của bucket, và giới hạn 1 MB của server
   action Next.js (đã ghi ở `docs/design/module-a.md`), đều chưa chạm tới.
3. **Đường qua giao diện thật.** Bộ test gọi `supabase-js` trực tiếp như server action làm,
   nhưng chưa có lượt bấm nút thật nào trên trình duyệt.
4. **`methodology-templates`.** Chỉ quản trị nền tảng ghi được bucket này; chưa có tài
   khoản `platform_admin` trong bộ test nên chưa kiểm.
