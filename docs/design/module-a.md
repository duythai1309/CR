# Module A — quản lý dự án (kanban bảy bước)

Bước 4 của `PLAN.md` §6, theo `PLAN.md` §3 và §5. Xây trên schema `0013_project_platform.sql`
và auth ở `docs/design/auth-role-design.md`.

## Route đã tạo

| Route | Nội dung |
|---|---|
| `/du-an` | Danh sách dự án của người dùng, tiến độ `n/7`, nút tạo |
| `/du-an/moi` | Tạo dự án |
| `/du-an/[id]` | **Bảng kanban bảy cột** |
| `/du-an/[id]/cong-viec/[taskId]` | Chi tiết công việc: sửa, bình luận, đính kèm, xoá |
| `/du-an/[id]/quy-trinh` | Bảy bước: chọn/khoá Standard, Methodology, baseline, tài liệu, duyệt bước |
| `/du-an/[id]/thanh-vien` | Mời theo email, đổi vai trò, gỡ thành viên |

`src/app/du-an/layout.tsx` (khung ngoài) và `src/app/du-an/[id]/layout.tsx` (khung một dự
án: kiểm tư cách thành viên một lần, tiêu đề, tab) bọc cả hai nhánh của Module B.

## Quyết định đáng ghi lại

**Cột kanban là BƯỚC, không phải trạng thái.** `PLAN.md` §3 nói "mỗi Stage là 1 cột, Task
là card", nên kéo card sang cột khác đổi `stage_id`; `status`
(`todo|in_progress|done|blocked`) là thuộc tính riêng của card, đổi bằng ô chọn ngay trên
card. Đây là cách đọc duy nhất khiến cả hai câu trong `PLAN.md` §3 cùng đúng.

**Kéo-thả không bao giờ là đường duy nhất.** HTML5 drag-and-drop thuần, không thư viện.
Mỗi card có hai ô chọn — *Bước* và *Trạng thái* — làm được đúng việc kéo-thả làm, bằng bàn
phím. Người dùng bàn phím, trình đọc màn hình và màn hình cảm ứng không mất chức năng nào.

**Ghi đi đúng đường mà `0013` cho phép.** Tạo dự án, đổi thành viên, duyệt bước đi qua RPC
(`create_project`, `set_project_member`, `approve_project_stage`) vì ba bảng đó bị thu hết
quyền ghi trực tiếp. Công việc, bình luận, đính kèm, tài liệu ghi thẳng vì `0013:929-932`
có cấp quyền theo cột. Không chỗ nào tự `INSERT` vào `project_members`/`project_stages`.

**Checklist additionality dựng bằng công việc ở bước 6**, không thêm bảng mới. Schema
không có bảng checklist, và thêm bảng ở bước 4 là vượt phạm vi.

**Giao việc chỉ cho Đơn vị phát triển.** Không phải lựa chọn giao diện mà là khoá ngoại ba
cột `(project_id, assignee_id, assignee_role)` (`0013:131-132`). Ô chọn lọc sẵn để người
dùng không chọn được thứ chắc chắn bị từ chối.

**Tái dùng lõi của Module B cho form baseline.** Bước 5 gọi `buildMethodologyForm` và
`validateValues` (`src/lib/methodology/**`) thay vì tự viết — form baseline sinh từ
`metric_schema`, không hard-code theo methodology.

## Quyền — `PLAN.md` §5

`abilitiesFor(role, projectDeleted)` trong `src/components/project/rules.ts` là nguồn duy
nhất cho việc ẩn/khoá. Nó **chép lại** điều kiện của cơ sở dữ liệu chứ không định nghĩa
thêm: `canWriteTasks` khớp `app_project_can_write` (kể cả vế `deleted_at is null`), các
quyền còn lại khớp `app_project_role(...)='owner'`.

Đây **không phải lớp bảo vệ**. Mọi hàm ở đó bị bỏ qua thì RLS vẫn từ chối. `requireProjectMember`
trả 404 (không phải 403) cho người ngoài, để không xác nhận dự án có tồn tại.

## Kiểm chứng

```
npm run types  → sạch
npm run test   → 231/231 (204 cũ + 27 ca mới ở tests/project-rules.test.ts)
npm run build  → Compiled successfully, mọi route /du-an dựng được
```

Không chạm Supabase thật; không `db push`, không `apply_migration`, không `test:e2e`.

## Chưa làm được và vì sao

1. **Chưa chạy trên cơ sở dữ liệu thật.** `0013`–`0015` mới chỉ áp trên Docker cục bộ
   (`docs/design/schema-verification-report.md`). Mọi truy vấn ở đây đúng theo lược đồ đã
   kiểm, nhưng chưa có lượt gọi PostgREST thật nào — đặc biệt hình dạng trả về của các RPC
   `returns table` vẫn là giả định.

2. **Tải tệp bị chặn ở 1 MB.** Server action của Next.js mặc định giới hạn thân yêu cầu
   1 MB; nới nó cần `serverActions.bodySizeLimit` trong `next.config.ts`, mà tệp đó không
   nằm trong danh sách được ghi ở bước 4. Ràng buộc phía DB/bucket là 50 MB, nên khoảng
   giữa 1–50 MB hiện sẽ lỗi. Sửa là một dòng, cần một bước được phép ghi `next.config.ts`.

3. **Mục C13 vẫn mở.** Policy `restrictive` trên `storage.objects` có thể chặn chính đường
   upload; chưa kiểm được vì cần Storage HTTP thật. Nếu đúng, toàn bộ đường tải tệp
   (tài liệu bước và đính kèm công việc) sẽ hỏng — đây là rủi ro lớn nhất còn lại của
   Module A.

4. **Chưa có luồng mời qua email.** `0015` chỉ tra được người **đã có tài khoản**; không có
   bảng lời mời/token. Người chưa đăng ký phải tự đăng ký trước rồi mới mời được.

5. **Chưa có lịch sử sửa công việc.** `project_tasks` có `updated_at` nhưng không có bảng
   audit; `docs/design/schema-project-platform.md` đã xếp việc này vào dự án con sau.
