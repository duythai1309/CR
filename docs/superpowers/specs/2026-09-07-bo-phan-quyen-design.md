# Thiết kế: mọi thành viên dự án đều toàn quyền

Ngày 07/09/2026. Quyết định của chủ sản phẩm.

## 1. Diễn giải đã chốt

"Role nào cũng có toàn quyền **trong dự án**" = mọi **thành viên** của dự án đều được đọc,
thêm, sửa, xoá, bất kể vai trò `owner` / `developer` / `viewer`.

**Lớp kiểm THÀNH VIÊN giữ nguyên.** Người không phải thành viên vẫn không vào được. Gỡ lớp
đó thì bất kỳ ai đăng nhập cũng đọc và xoá được dự án của khách hàng khác — đó là rò rỉ dữ
liệu chứ không phải nới quyền, và không nằm trong yêu cầu.

## 2. Ghi nhận trước khi sửa

Điều tra cho thấy mô hình quyền hiện tại **không sai**: `atLeast` đúng
(`owner=2 ≥ developer=1`), cột `setup` có grant, `writeSetup` không ghi cột ngoài danh
sách, `app_project_can_write` đúng. Dự án bị báo lỗi trong ảnh chỉ có một thành viên là
`duan-dev@test.local`. Đây là thay đổi **chính sách sản phẩm**, không phải sửa lỗi.

## 3. Ranh giới file

| Gói | Sở hữu độc quyền | Người làm |
|---|---|---|
| WP-PERM-DB | `supabase/migrations/0022_flat_project_roles.sql`, `supabase/rollback/0022_down.sql` | Codex `coder` |
| WP-PERM-APP | `src/components/project/rules.ts`, `src/lib/auth.ts`, mọi `actions.ts` trong `src/app/du-an/**`, `tests/project-rules.test.ts` | Claude `scribe` |

Chỉ đọc với cả hai: migration 0001–0021, `src/lib/chat/**`, `src/components/ui.tsx`,
`src/components/project/board/**`.

## 4. WP-PERM-DB — migration 0022

`create or replace` bốn thứ, giữ nguyên mọi phần khác của từng hàm:

1. **`app_project_can_write(uuid)`** (`0013:331-336`) — bỏ điều kiện
   `m.role in ('owner','developer')`, chỉ còn cần là thành viên và `deleted_at is null`.
2. **`approve_project_stage(uuid, smallint)`** (`0013:696`) — đổi
   `app_project_role(...) is distinct from 'owner'` thành `is null`. **Giữ nguyên** mọi
   phép kiểm còn lại: thứ tự stage, Standard/Methodology đã khoá, `project_validate_values`.
3. **`set_project_member(uuid, uuid, text)`** — bỏ yêu cầu owner, chỉ cần là thành viên.
4. **`create_mrv_report(...)`** (`0013:827`) — bỏ `role in ('owner','developer')` trong phép
   kiểm người yêu cầu.

**Giữ nguyên, không đụng:**
- Chốt "không xoá owner cuối cùng" (`0013:564-565`). Cột `role` vẫn tồn tại trong schema;
  chốt này ngăn dự án rơi vào trạng thái không có owner nào.
- Mọi policy RLS đang dùng `app_project_role(...) is not null` — chúng tự đúng.
- `app_project_role`, `app_is_admin`, phiên hỗ trợ của 0018, mọi guard của catalog.

`0022_down.sql` khôi phục **nguyên văn** bốn hàm chép từ 0013, kèm comment ghi rõ dòng nguồn.

**Codex chỉ viết file, KHÔNG áp.** Claude review rồi áp.

## 5. WP-PERM-APP — tầng ứng dụng

1. `abilitiesFor(role, projectDeleted)` — mọi quyền trả `true` khi dự án chưa xoá mềm.
   Điều kiện `projectDeleted` **giữ nguyên**: dự án trong thùng rác vẫn đóng mọi đường ghi.
2. 38 chỗ `requireProjectMember(projectId, "owner"|"developer")` đổi về mặc định, tức chỉ
   cần là thành viên.
3. `tests/project-rules.test.ts` đang chốt vào mô hình cũ nên **được phép sửa**, nhưng
   **không được xoá ca nào**: mỗi ca cũ phải có ca mới kiểm đúng ý nghĩa mới, gồm cả ca
   "dự án đã xoá mềm thì mọi quyền ghi vẫn tắt".

## 6. Kiểm chứng

`npm run types` và `npm run test` xanh. Không xoá ca test nào.
