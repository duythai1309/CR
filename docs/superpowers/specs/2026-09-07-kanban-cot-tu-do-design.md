# Thiết kế: bảng Kanban kiểu Jira với cột do người dùng tự tạo

Ngày 07/09/2026. Chủ sản phẩm chọn **cột tự do hoàn toàn, không có category**.

## 1. Ràng buộc đang chặn

```sql
0013:119  status text not null default 'todo'
          check (status in ('todo','in_progress','done','blocked'))
0013:930  grant update(stage_id,title,description,status,assignee_id,due_at,position) ...
```

Bốn cột hiện tại là bốn giá trị `status` bị khoá bằng CHECK. Thêm cột đòi migration.

## 2. Hệ quả đã được chấp nhận, không được giấu

`status = 'done'` đang gánh việc ở **năm nơi ngoài bảng Kanban**:

| Nơi | Hiện đang làm gì |
|---|---|
| `src/app/du-an/data.ts:101` | đếm "việc đang mở" cho danh mục dự án |
| `src/app/du-an/[id]/quy-trinh/page.tsx:219` | "x/y công việc ở mục này đã xong" |
| `src/app/du-an/[id]/thanh-vien/page.tsx:59` | việc chưa giao và chưa xong |
| `src/lib/chat/handlers.ts:1255` | `OPEN_STATUSES` |
| `src/lib/chat/handlers.ts:543` | thống kê theo trạng thái |

Cột tự do nghĩa là hệ thống **không còn biết thế nào là xong**. Năm chỗ này đổi ý nghĩa
chứ không được đoán bừa: đếm tổng công việc, hoặc đếm theo tên cột. Trợ lý mất khả năng
trả lời "còn bao nhiêu việc đang mở" — đây là đánh đổi đã được chấp nhận khi chọn phương án.

**Cấm tuyệt đối:** suy ra "xong" bằng tên cột, bằng vị trí cột cuối, hay bằng bất kỳ mẹo
nào. Đoán sai một con số tiến độ còn tệ hơn không có con số.

## 3. Ranh giới file

| Gói | Sở hữu độc quyền | Người làm |
|---|---|---|
| WP-DB | `supabase/migrations/0021_board_columns.sql`, `supabase/rollback/0021_down.sql` | Codex `coder` |
| WP-UI | `src/components/project/board/**`, `src/app/du-an/[id]/board.tsx`, `src/app/du-an/[id]/page.tsx`, `src/app/du-an/[id]/actions.ts`, `src/components/project/rules.ts` (chỉ THÊM) | Claude `scribe` |

Chỉ đọc với cả hai: migration 0001–0020, `src/lib/**`, `src/types/**`,
`src/components/ui.tsx`, `src/app/du-an/[id]/quy-trinh/**`, mọi file test hiện có.

Năm chỗ ở §2 thuộc **vòng sau**, không ai đụng trong đợt này.

## 4. WP-DB — migration 0021

Bảng mới:

```
project_board_columns(
  id uuid pk, project_id uuid not null references projects(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 60),
  position numeric not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
)
```

`project_tasks` thêm `column_id uuid references project_board_columns(id) on delete restrict`.

Bắt buộc:

1. **RLS bật**, policy theo đúng khuôn `project_tasks` ở `0013:893-896`: đọc khi
   `app_project_role(project_id) is not null`; ghi khi `app_project_can_write(project_id)`.
2. **Grant cột tường minh** cho `authenticated`, theo đúng cách 0013 làm ở dòng 930.
3. **Backfill trong cùng migration**: mỗi dự án đang có được seed bốn cột `Chưa làm`,
   `Đang làm`, `Xong`, `Vướng` theo đúng thứ tự, rồi `column_id` của mọi task hiện có
   được gán theo `status` cũ. Không dự án nào được để trống cột sau khi chạy.
4. **Trigger seed cột cho dự án mới.** `project_bootstrap` hiện dựng bảy stage khi tạo dự
   án; cột mặc định phải được dựng cùng lúc đó, trong cùng transaction. Đọc
   `0013_project_platform.sql` tìm `project_bootstrap` và mở rộng nó.
5. `status` **giữ nguyên**, không drop, không đổi CHECK. Nó vẫn đang được năm chỗ ở §2 đọc,
   và vòng này không đụng chúng. Cột `column_id` là nguồn sự thật cho bảng Kanban.
6. Không xoá được cột đang chứa task — dùng `on delete restrict`, và nêu rõ trong comment.

`0021_down.sql`: drop cột `column_id` rồi drop bảng, khôi phục `project_bootstrap` nguyên
văn chép từ 0013. Ghi rõ trong comment rằng rollback làm mất tên cột người dùng đã đặt.

**Codex chỉ viết file, KHÔNG áp migration.** Claude review rồi áp.

## 5. WP-UI — bảng Kanban

1. **Cột lấy từ `project_board_columns`**, không còn từ `TASK_STATUSES`.
2. **Quản lý cột**: thêm, đổi tên, xoá, kéo đổi thứ tự. Xoá cột còn task phải báo lỗi đọc
   được, không được im lặng.
3. **Kéo sắp xếp card trong cùng cột.** Cột `position` đã có sẵn (`0013:124`) và
   `nextPosition` trong `rules.ts` dùng bậc thang 1000 để chèn giữa mà không đánh số lại —
   dùng lại, đừng thay thuật toán.
4. **Mở card nhanh ngay trên bảng**: bấm card mở panel sửa tại chỗ. Không bỏ trang chi tiết
   hiện có.
5. Thả card sang cột khác đặt `column_id`. **Cũng đặt `status`** theo cột tương ứng nếu ánh
   xạ được từ bốn cột mặc định; cột do người dùng tự tạo thì giữ `status` cũ của task.
   Đây là cầu tạm để năm chỗ ở §2 chưa hỏng ngay trong vòng này.
6. `rules.ts` **chỉ được THÊM hàm**. `groupTasksByStage` và `groupTasksByStatus` giữ nguyên
   — cả hai đang có test chốt vào.

## 6. Kiểm chứng

- `npm run types` và `npm run test` xanh. **Không xoá, không sửa ca test nào đang có.**
- Logic thuần mới thêm phải có test riêng.
