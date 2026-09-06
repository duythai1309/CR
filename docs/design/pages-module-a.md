# Module A — làm lại giao diện cho đơn vị phát triển dự án carbon

Đợt trước (`ta-alignment.md`) chỉ đổi ngôn từ trên giao diện vốn viết cho người dùng phổ
thông. Đợt này viết lại chính các trang: bố cục, dữ liệu hiển thị và thao tác đều đi theo
cách làm việc của người dựng hồ sơ Verra/Gold Standard.

Không đổi schema, RPC hay policy. Mọi thứ dưới đây đọc từ những bảng và hàm đã có.

## Bốn giả định về người dùng, và chúng dẫn tới cái gì

| Giả định | Hệ quả trên giao diện |
| --- | --- |
| Làm nhiều dự án song song, mỗi dự án nhiều tháng | `/du-an` là bảng danh mục có lọc/sắp xếp, không phải lưới thẻ |
| Quen Jira | Lọc, sắp xếp, hai chế độ xem, chọn nhiều, phím tắt, thao tác hàng loạt |
| Phải bảo vệ từng con số trước VVB | Người duyệt + thời điểm duyệt, điều kiện duyệt trích từ RPC, dòng thời gian công việc |
| Đọc tài liệu chuẩn bằng tiếng Anh | Giữ nguyên thuật ngữ; chú thích tiếng Việt đi kèm, không dịch ngược |

## Trang danh sách dự án — `/du-an`

Trước: lưới thẻ phẳng, mỗi thẻ có tên, vai trò, `n/7`, Standard, Methodology.

Sau: một bảng danh mục. Mỗi dòng trả lời được bốn câu mà người làm nhiều dự án hỏi trước
tiên — *đang ở bước mấy*, *Standard/Methodology nào*, *kỳ giám sát gần nhất ra sao*, *cái
gì đang chặn*.

- **Bước hiện tại** hiện `n/7`, thanh tiến độ, và **tên bước đang chờ duyệt** — không chỉ
  con số. Bước đang chờ là bước có `ordinal` nhỏ nhất mà `approved_at is null`, đúng thứ
  tự mà `approve_project_stage` cưỡng chế.
- **Đang chặn** gộp ba nguồn có thật trong DB: công việc `status='blocked'`, công việc quá
  hạn (`due_at` đã qua và chưa `done`), và điều kiện khoá còn thiếu của bước đang chờ
  (chưa khoá Standard/Methodology, baseline chưa hợp lệ).
- **Kỳ giám sát gần nhất** lấy từ `monitoring_periods` (`start_date` mới nhất), hiện
  khoảng thời gian, `version` và `status`. Dự án chưa có kỳ nào thì nói rõ điều kiện tạo
  kỳ là khoá Methodology.
- **Lọc**: từ khoá, vai trò của tôi, Standard, trạng thái tiến độ, "chỉ dự án đang có việc
  chặn", "gồm cả dự án đã xoá". **Sắp xếp**: cập nhật gần nhất, tên, tiến độ, số việc
  chặn, kỳ giám sát gần nhất.
- Methodology MẪU có dải cảnh báo riêng trên mỗi dòng, không chỉ ở trong dự án.

Toàn bộ lọc/sắp xếp chạy ở client trên dữ liệu đã tải, không thêm truy vấn.

## Bảng công việc — `/du-an/[id]`

Mô hình giữ nguyên: **cột là bước**, `status` là trục riêng của card.

Thêm:

- **Hai chế độ xem** — Bảng (kanban) và Danh sách (bảng phẳng, sắp xếp được theo bước,
  trạng thái, người nhận, hạn).
- **Thanh lọc** — từ khoá, người nhận, trạng thái, bước, "chỉ việc của tôi", "chỉ việc
  đang chặn". Số việc bị lọc ra được nói rõ, không im lặng.
- **Chọn nhiều và thao tác hàng loạt** ở chế độ danh sách: đổi trạng thái hoặc chuyển bước
  cho nhiều việc một lượt. Chạy tuần tự qua đúng hai server action đã có
  (`setTaskStatus`, `moveTask`), báo cáo số việc thành công/thất bại.
- **Phím tắt**: `/` ô tìm, `b`/`l` đổi chế độ xem, `m` chỉ việc của tôi, `x` chỉ việc đang
  chặn, `c` mở form thêm việc, `Esc` xoá bộ lọc, `?` bảng phím tắt. Phím tắt tự tắt khi
  con trỏ đang ở trong ô nhập.
- **Hạn quá ngày** hiện màu đỏ và có nhãn "quá hạn n ngày"; việc `blocked` có viền riêng.

**Đường bàn phím giữ nguyên và được mở rộng.** Kéo-thả vẫn không phải đường duy nhất: hai
ô chọn trên mỗi card vẫn còn, và chế độ danh sách + thao tác hàng loạt là một đường thứ ba
hoàn toàn bằng bàn phím.

## Bảy bước — `/du-an/[id]/quy-trinh`

Đây là màn hình quan trọng nhất của giai đoạn lập kế hoạch, nên nó phải trả lời được ba
câu ngay: *bước này cần gì để duyệt*, *còn thiếu gì*, *ai duyệt bước trước và lúc nào*.

### Điều kiện duyệt lấy từ RPC, không phải từ quy trình chuẩn ngành

`approve_project_stage` (`0013_project_platform.sql:696-714`) kiểm đúng sáu điều, theo thứ
tự:

| # | Điều kiện trong RPC | Dòng |
| --- | --- | --- |
| 1 | Dự án tồn tại và `deleted_at is null` | 700 |
| 2 | `app_project_role(project) = 'owner'` | 701 |
| 3 | `ordinal` trong 1..7 | 702 |
| 4 | Không còn stage nào `ordinal <` mà `approved_at is null` | 703-705 |
| 5 | `ordinal >= 3` ⇒ `standard_locked_at is not null` | 706 |
| 6 | `ordinal >= 4` ⇒ `methodology_locked_at is not null` | 707 |
| 7 | `ordinal >= 5` ⇒ `project_validate_values(metric_schema, baseline, 'baseline')` không ném lỗi | 708-710 |

Màn hình hiện đúng bảy dòng này dưới dạng danh sách kiểm, mỗi dòng có trạng thái
đạt/chưa đạt/không áp dụng và trích dẫn dòng migration. **Không thêm điều kiện nào khác.**

Điều đó có nghĩa: tài liệu đã tải lên và công việc đã xong **không phải** điều kiện duyệt
trong hệ thống này. Màn hình nói thẳng như vậy thay vì để người dùng suy diễn — đó là kỷ
luật nghiệp vụ của đội, không phải ràng buộc phần mềm.

Điều kiện 7 trước đây không được nói trước: người dùng bấm Duyệt rồi nhận thông báo lỗi
thô từ Postgres. Nay baseline được kiểm trước bằng `validateValues`
(`src/lib/methodology/schema.ts`) và liệt kê từng field sai.

**Một khác biệt đã biết giữa hai bộ kiểm.** `project_validate_values` trong SQL chỉ đọc
`required`; nó **không** cưỡng chế `required_if`, còn `validateValues` phía TypeScript thì
có. Nếu để nguyên, giao diện sẽ chặn nút Duyệt ở những trường hợp mà cơ sở dữ liệu chấp
nhận. Nên `baselineGateErrors()` lọc bỏ đúng lớp lỗi đó: lỗi `Required field` trên field
có `required === false`. Phần còn lại (kiểu, biên, precision, enum, ngày ISO, field lạ)
khớp nhau.

### Vết kiểm toán

Mỗi bước đã duyệt hiện **ai duyệt** và **lúc nào**. `project_stages.approved_by` đã có
trong schema từ `0013`; đợt `ta-alignment` chỉ hiện `approved_at` vì chưa nối tên người.
Nay nối bằng `project_member_directory` (`0015`) — cùng RPC mà tab Thành viên dùng.

Người duyệt đã rời dự án không tra được tên vì directory chỉ liệt kê thành viên hiện tại;
chỗ đó hiện "Người duyệt không còn trong dự án" chứ không hiện UUID.

### Bố cục

Một dải bảy bước ở đầu trang cho biết đang ở đâu, rồi từng bước là một thẻ. Bước đang chờ
duyệt được làm nổi và mở sẵn; bước đã duyệt thu gọn lại nhưng vẫn xem được.

## Thành viên — `/du-an/[id]/thanh-vien`

- Mỗi người hiện họ tên, email (chỉ chủ dự án đọc được, do RPC quyết định), vai trò, và
  **khối lượng việc đang giữ**: đang làm / chưa làm / vướng / quá hạn, kèm liên kết mở
  đúng bộ lọc trên bảng công việc.
- Không có chỗ nào hiện UUID trần. Người không đặt họ tên hiện "(chưa đặt họ tên)".
- Cảnh báo khi dự án **không có Đơn vị phát triển nào** — vì khoá ngoại ba cột
  (`0013:131-132`) khiến không giao được việc cho ai cả.
- Cảnh báo khi có việc đang giao cho người **đã rời dự án**: `assignee_id` vẫn còn trong
  `project_tasks` nhưng không còn dòng `project_members` tương ứng.

## Chi tiết công việc — `/du-an/[id]/cong-viec/[taskId]`

- **Dòng thời gian** gộp ba nguồn có thật vào một danh sách theo thứ tự thời gian: tạo
  việc (`created_at`, `created_by`), bình luận (`task_comments`), đính kèm
  (`task_attachments` + `project_files`). Mỗi mục có người, thời điểm và nội dung.
- Đính kèm hiện thêm `checksum` rút gọn và kích thước — thứ cần trích dẫn khi đối chiếu
  bằng chứng.
- Thanh thuộc tính bên phải: bước, trạng thái, người nhận, hạn (đỏ khi quá hạn),
  `updated_at`.

## Tạo dự án — `/du-an/moi`

Nói trước cái gì được tạo ra (bảy stage, bạn là owner) và cái gì **chưa** được chọn
(Standard ở bước 3, Methodology ở bước 4, và cả hai khoá một chiều). Nêu luôn ranh giới
phạm vi để người dùng chuyên nghiệp không tưởng đây là hồ sơ nộp được.

## Khung và điều hướng

- Tab trong dự án nay có trạng thái **đang mở** (trước đây năm tab trông giống hệt nhau ở
  mọi trang).
- Đầu trang dự án hiện thêm **việc cần làm tiếp theo**: bước đang chờ và rào đầu tiên của
  nó.
- `MethodologyIdentity` giữ nguyên vị trí và nội dung — codex đang dựa vào nó.

## Ranh giới trung thực giữ nguyên trên giao diện

- Methodology MẪU: dải cảnh báo ở danh sách dự án, ở khung dự án và ở bước 4.
- Phạm vi dừng trước consultation, validation, registration, VVB verification, standard
  review và issuance — ghi ở danh sách dự án và ở cuối trang bảy bước.
- Import: chỉ CSV. Không chỗ nào nhắc `.xlsx`.

## Kiểm chứng

```
npm run types  → sạch
npm run test   → 305/305, 11 file pass  (265 trước đó + 40 ca mới)
npm run build  → Compiled successfully, cả 13 route dựng được
```

40 ca mới nằm ở `tests/project-portfolio.test.ts`: danh sách kiểm duyệt bước (kể cả việc
nó liệt kê **đúng bảy** điều kiện và mỗi điều trích dẫn được dòng migration), lọc lệch
`required_if`, cờ quá hạn/sắp hạn/đang chặn, bộ lọc và sắp xếp của bảng công việc, bộ lọc
và sắp xếp của danh mục dự án, khối lượng theo người và việc mồ côi. `tests/project-rules.test.ts`
giữ nguyên 27 ca cũ và vẫn xanh — `approvalBlockers` được viết lại thành lớp mỏng trên
`approvalChecklist` nhưng giữ đúng chuỗi thông báo cũ.

Không chạm Supabase thật, không `db push`, không `apply_migration`, không `test:e2e`.
Giao diện chưa được chạy thử trên trình duyệt với phiên đăng nhập thật.

### Primitive thêm vào `ui.tsx`

Chỉ **thêm**, không đổi cái đang có (`giam-sat`/`bao-cao` của worker song song đang dựa
vào `Card`, `Alert`, `Badge`, `Table`, `Empty`, `Stat` nguyên trạng): `Kbd`, `ProgressBar`,
`Meta`, `CheckMark`, `Toolbar`. `globals.css` thêm đúng một quy tắc ẩn dấu tam giác của
`<details>` trên WebKit; **không token màu nào bị đổi hay thêm**.

### Một lỗi cũ được sửa nhân tiện

`listMyProjects()` lấy vai trò của người dùng bằng cách đọc **dòng `project_members` đầu
tiên** của mỗi dự án. Policy đọc cho thấy cả đồng đội, nên dòng đầu tiên hoàn toàn có thể
là vai trò của người khác — bảng danh sách có thể gắn nhãn "Chủ dự án" cho một viewer.
`listPortfolio()` lọc `eq('user_id', profile.id)`.

## Cần đổi DB mới làm trọn được

1. **Không có lịch sử thay đổi công việc.** `project_tasks` chỉ có `updated_at`; không có
   bảng audit nào ghi lại "ai đổi trạng thái từ gì sang gì, lúc nào". Dòng thời gian hiện
   tại dựng từ bình luận và đính kèm, cộng thời điểm tạo — nó **không** phải lịch sử trạng
   thái. Cần một bảng `project_task_events` (append-only, RLS đọc theo membership) mới trả
   lời được câu VVB hay hỏi: số này đổi lúc nào và do ai.
2. **Không tra được tên người đã rời dự án.** `project_member_directory` chỉ liệt kê thành
   viên hiện tại, nên người duyệt stage hoặc tác giả bình luận đã rời dự án không hiện tên.
   Cần mở rộng RPC để trả cả những `user_id` từng xuất hiện trong dữ liệu của dự án.
3. **Không có bảng lời mời.** `project_lookup_invitee` chỉ tìm người đã có tài khoản; mời
   người chưa đăng ký cần bảng invitation + token.
4. **Không có `supersedes`/quy tắc hiệu lực cho monitoring period.** Nhiều kỳ chồng khoảng
   thời gian thì "kỳ gần nhất" ở danh sách dự án chỉ là kỳ có `start_date` lớn nhất, không
   phải kỳ đang có hiệu lực.
5. **`report_templates` vẫn là placeholder**, nên không có đường xuất hồ sơ theo mẫu chính
   thức của Standard.
