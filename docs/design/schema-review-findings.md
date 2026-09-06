# Kết quả review schema nền tảng dự án Carbon Credit

Ngày 06/9/2026. Người review: agent phụ trách nửa "GIỮ LẠI".
Đối tượng review:

| Tệp | Dòng |
|---|---|
| `supabase/migrations/0013_project_platform.sql` | 997 |
| `supabase/migrations/0014_project_platform_samples.sql` | 777 |
| `docs/design/schema-project-platform.md` | 605 |

Tiêu chí: `docs/design/schema-review-checklist.md` (22 mục C1–C22).

**Ghi chú về checklist.** Thân của các mục C18–C22 (nhóm E) chưa kịp viết ra tệp;
tiêu chí của chúng đã được định nghĩa trong mục lục checklist và được áp dụng đầy đủ ở
đây. Không mục nào bị bỏ qua.

**Ranh giới đã tuân thủ.** Chỉ đọc; không sửa tệp của `worker-codex`; **không** áp
migration lên Supabase thật; không chạy `test:e2e`. Mọi kết luận rút từ đọc mã tĩnh và
từ hai lệnh không chạm DB (`npm run types`, `npm run test`).

---

## Tóm tắt

*(điền ở cuối — xem phần Phán quyết)*

---

## Nhóm A — Bảo mật & RLS

### C1 — Fail-closed RLS, đủ 4 thao tác — **PASS có ghi chú**

Kiểm: `0013:848-863` bật RLS cho **cả 16/16 bảng mới**; không bảng nào sót.
`comm -23` giữa danh sách `create table` và danh sách `enable row level security` cho kết
quả rỗng.

Thiết kế **cố ý không** viết policy INSERT/UPDATE/DELETE cho 6 bảng
(`project_members`, `project_stages`, `monitoring_periods`, `monitoring_imports`,
`monitoring_data`, `mrv_reports`). Đây **không** phải lỗi sót như checklist C1 giả định,
mà là kiến trúc "ghi chỉ qua RPC": quyền bảng cũng bị thu tương ứng
(`0013:918-921` revoke all, `0013:922-925` chỉ `grant select`), nên đường ghi trực tiếp bị
chặn ở **hai lớp** — không có policy *và* không có quyền bảng. Ghi thật đi qua các hàm
`security definer` (`0013:665-846`). Cách này chặt hơn policy, chấp nhận.

Các bảng có ghi trực tiếp đều đủ cặp policy + grant tương ứng, đã đối chiếu từng cặp:
`project_tasks` (`0013:893-896` + `0013:929-932`), `task_comments` (`0013:897-900`),
`project_files` (`0013:903-904`), `task_attachments` (`0013:905-907`),
`project_documents` (`0013:908-909`), `methodology_factors` (`0013:872-880`),
`standards`/`methodologies`/`report_templates` (`0013:866-884`).
Mọi policy `insert` đều có `with check`; không có policy `for all` nào.

Ghi chú P2 — `projects` không có policy/quyền `DELETE`, nhưng `PLAN.md` §5 cho Owner
"xoá project". Thiết kế giải quyết bằng **xoá mềm**: cột `deleted_at` (`0013:84`) nằm
trong `grant update(...)` (`0013:928`) và trigger chặn xoá cứng (`0013:531`). Đạt yêu cầu
`PLAN.md`, chỉ cần tầng ứng dụng hiểu đúng ngữ nghĩa.

### C2 — Quyền hàm: `security definer` + `search_path` + revoke/grant — **PASS**

Kiểm 27 hàm mới. **27/27 có `set search_path = public`** — không hàm nào thiếu, tức không
dính lỗ hổng mà `0007_harden.sql:3-4` được viết ra để vá.

Phân bố `security definer` đúng chỗ và có chủ đích:
- Có definer: 3 helper RLS (`0013:323-336`), các guard cần đọc/ghi vượt RLS
  (`0013:474`, `496`, `554`, `577`, `645`), và toàn bộ 7 RPC (`0013:665-846`).
- Cố ý **invoker**: các validator thuần (`0013:340`, `381`, `430`) và guard không cần
  vượt quyền (`0013:511`, `527`, `592`, `606`, `614`, `628`). Đây là lựa chọn **an toàn
  hơn**, không phải thiếu sót.

Khuôn revoke/grant theo đúng `0007_harden.sql:63-78`, và chặt hơn một bậc:
`0013:977-988` thu quyền **cả 27 hàm** khỏi `public, anon, authenticated, service_role`
(có `from public` — đúng cái bẫy `0007_harden.sql:54-56` cảnh báo), rồi `0013:989-993` chỉ
cấp lại 11 hàm cho `authenticated` và `0013:994-995` cấp 2 hàm cho `service_role`.
**Không hàm trigger nào được cấp cho client** — đúng khuôn `0007_harden.sql:32-35`.

### C3 — Policy đệ quy — **PASS**

`project_members` có đúng một policy (`0013:889`), và thân của nó gọi
`public.app_project_role(project_id)` chứ không truy vấn `project_members` trực tiếp.
Hàm đó là `security definer` (`0013:323-326`) nên đọc bảng không đi qua policy — đúng
thủ pháp mà `0003_rls.sql:4-5` đã dùng cho `profiles`.

Kiểm vòng gián tiếp: `projects_read` (`0013:887`) → `app_project_role` (definer, không
qua RLS) ⇒ không có cạnh `projects → project_members` ở tầng policy. Đồ thị phụ thuộc
policy không có chu trình. Storage policy `0013:954-956` đọc `project_members` từ
`storage.objects` — khác bảng, không tạo vòng.

### C4 — `app.bypass_profile_guard` — **PASS**

`grep 'bypass_profile_guard'` trên cả hai tệp cho kết quả **rỗng**. Không hàm mới nào ghi
vào `profiles`; `profiles` chỉ được tham chiếu làm FK. Rủi ro R12 không xuất hiện.

### C5 — Danh tính thành viên qua `profiles_select` — **P1**

**Vì sao sai.** Thiết kế cố ý không nới `profiles_select` — `0013:679` ghi rõ "không mở
SELECT toàn bộ profiles", và `set_project_member` (`0013:680`) nhận `p_user_id` như một
UUID đã biết. Quyết định đó đúng về bảo mật, và tác giả **đã tự nêu giới hạn này** ở
`docs/design/schema-project-platform.md:185` ("v1 DB chỉ trả membership UUID… luồng invite
email/token/accept chưa có bảng/RPC trong v1 này"). Nên đây **không phải lỗi bị bỏ sót**,
mà là một khoảng trống đã biết và chưa được lấp. Vẫn giữ P1 vì nó **chặn Module A**:
policy `0003_rls.sql:59-60` chỉ cho đọc `profiles` của chính mình, của admin, hoặc
của người **cùng `cooperative_id`**. Hai thành viên dự án khác hợp tác xã — hoặc chưa
thuộc hợp tác xã nào, mà `create_project` (`0013:669-671`) **cho phép** đúng như vậy —
sẽ không đọc được tên nhau.

Hệ quả cụ thể ở giao diện Module A: danh sách thành viên (`project_members` đọc được, có
`user_id`) hiện ra một cột UUID trống tên; assignee của task hiện `—`; tác giả bình luận
vô danh. Không có lỗi nào được ném ra — đúng kiểu hỏng im lặng mà audit đã cảnh báo (R6).

Thêm một hệ quả vận hành: owner phải **biết trước UUID** của người muốn mời. Không có
đường tra cứu nào trong thiết kế (không có RPC tìm người theo email), nên trên thực tế
chưa mời được ai.

**Cách sửa đề xuất.** Thêm vào migration một RPC `security definer` hẹp, ví dụ
`project_directory(p_project_id uuid)` trả `(user_id, full_name)` cho **đúng thành viên
của dự án mà người gọi cũng là thành viên**, và `project_lookup_user(p_email citext)` trả
tối đa một dòng để owner mời người. Cả hai chỉ trả trường hiển thị, không trả `phone`.
Cách này giữ nguyên `profiles_select` (không đụng phần được giữ, C10) mà vẫn lấp được lỗ
chức năng.

---

## Nhóm B — Bẫy migration PostgreSQL

### C6 — Enum: `add value` và chỗ dùng ở hai tệp — **PASS (không áp dụng)**

`grep 'alter type'` trên cả `0013` và `0014` cho kết quả **rỗng**. Thiết kế **không đụng
`user_role`**; vai trò dự án là cột `text` có `check (role in ('owner','developer','viewer'))`
(`0013:96`), không phải enum Postgres. Bẫy `unsafe use of new value` không tồn tại.
Tài liệu nêu rõ lựa chọn này (`schema-project-platform.md:14`).

Đây đúng là phương án mà checklist C6 khuyến nghị ("không đụng `user_role` chút nào, tạo
trục vai trò riêng theo dự án"), và nó **gỡ luôn hai mục P0 cùng lúc** — C6 và C7.

Ghi chú P2 về lựa chọn `text + check` thay vì enum: đổi tập giá trị sau này phải `alter
table ... drop constraint / add constraint` thay vì `add value`, không có bẫy transaction.
Đánh đổi hợp lý.

### C7 — `handle_new_user`: danh sách trắng vai trò — **PASS**

Bước 1 của quy trình kiểm cho kết quả rỗng ⇒ dừng đúng theo checklist. `handle_new_user`
không bị `create or replace`, nên cũng không dính bẫy phụ "`create or replace` đặt lại
quyền mặc định" mà checklist C7 cảnh báo. Danh sách trắng `0012_signup_role_guard.sql:33-38`
giữ nguyên; không tài khoản nào bị âm thầm hạ vai trò.

Rủi ro R5 — điểm gãy im lặng nguy hiểm nhất trong phần auth — **không hiện diện**.

### C8 — Dựng lại DB từ đầu; không sửa migration đã áp — **P2**

`git status`/`git diff` trên `supabase/migrations/` chỉ liệt kê `0013` và `0014`; **không
tệp nào trong `0001`–`0012` bị sửa**. Không có `drop function` lên hàm cũ nào mà
`0007_harden.sql` đang `grant`. Phần chính của C8 PASS.

**Vấn đề còn lại — `begin;` / `commit;` tường minh.** `0013:4` và `0013:997`
(tương tự `0014:5`, `0014:777`) bọc toàn tệp trong transaction tường minh. **Không tệp nào
trong `0001`–`0012` làm vậy** — đây là lệch quy ước của repo, và nó tương tác với công cụ
áp migration:

- `supabase db push` / `supabase migration up` **đã tự bọc mỗi tệp trong một transaction**.
  `BEGIN` lồng phát cảnh báo `there is already a transaction in progress`, còn `COMMIT` ở
  cuối tệp **kết thúc transaction ngoài sớm hơn dự kiến** — phần ghi sổ phiên bản của công
  cụ có thể rơi ra ngoài phạm vi nguyên tử.
- Chính điều thiết kế muốn bảo đảm ("Lỗi tạo đối tượng thì rollback cả file",
  `schema-project-platform.md:170`) **đã được công cụ bảo đảm sẵn**; thêm `begin/commit`
  không tăng an toàn mà tạo một biến số mới.

**Cách sửa đề xuất.** Bỏ `begin;`/`commit;` khỏi cả hai tệp để đồng nhất với `0001`–`0012`
và để công cụ tự bọc; hoặc, nếu muốn giữ, ghi rõ trong tài liệu rằng hai tệp này **chỉ
được áp bằng `psql -1 -v ON_ERROR_STOP=1 -f`** chứ không bằng `supabase db push`. Không
được để hai đường áp cùng tồn tại mà không nói rõ.

### C9 — `src/types/database.ts` phải sinh lại — **PASS**

`git status src/types/database.ts` sạch — tệp sinh tự động **không bị sửa tay**, đúng như
kỳ vọng ở bước 2. Việc sinh lại được bàn giao tường minh cho bước 3
(`schema-project-platform.md:182`: "Regenerate `src/types/database.ts` sau kiểm DB thử,
**giữ types legacy/chat/auth**"). Không thiếu bàn giao.

---

## Nhóm C — Không phá phần được giữ lại

### C10 — Không `DROP`/`ALTER` lên phần được giữ — **PASS**

Lệnh lọc `drop|alter` ngoài phạm vi bảng mới cho kết quả **rỗng**. Đối chiếu từng nhóm
trong bảng cấm của checklist:

| Đối tượng | Kết quả |
|---|---|
| `profiles`, `cooperatives` | chỉ được tham chiếu làm FK; không `alter`, không `drop` |
| `chat_conversations/_messages/_settings` | **không xuất hiện một lần nào** trong `0013`/`0014` |
| `emission_factors` | không xuất hiện; hệ số mới nằm ở bảng riêng `methodology_factors` (`0014:67` ghi rõ "không đọc/ghi emission_factors legacy") |
| trigger `on_auth_user_created` | không đụng |
| bucket `evidence` + 3 policy | không đụng; hai bucket mới được `insert` riêng (`0013:946-952`) |
| `app_user_role/app_coop_id/app_is_admin` | không `create or replace`; chỉ **gọi** `app_is_admin()` trong policy catalog |

Chiều ngược lại cũng đạt: `grep 'alter table public.chat_'` rỗng — **không có FK nào từ
bảng chat/auth trỏ sang bảng mới**, đúng ràng buộc "chatbot phải gỡ ra được".

### C11 — Không làm gãy chatbot — **PASS**

Không có `drop table`/`drop type` nào. Không bảng nào mà 10 công cụ trợ lý đang đọc bị
đụng tới; ba enum `batch_status`/`order_status`/`payment_status` còn nguyên, nên
`src/lib/labels.ts:75,84,92` và `src/lib/chat/handlers.ts:7-13` không đỏ.
`src/lib/mrv/**` không bị xoá trong đợt này nên `handlers.ts:4-6` an toàn.

Kiểm chứng bằng hai lệnh không chạm DB:

```
npm run types   → sạch, không lỗi
npm run test    → 5 tệp, 88/88 ca đạt (trong đó tests/chat.test.ts 49/49)
```

Đúng theo cảnh báo R11 của audit, tôi **không** lấy màu xanh của `npm run test` làm bằng
chứng cho kiểu gãy im lặng; đã kiểm bổ sung bằng đọc mã rằng không bảng nào trong danh sách
14 bảng của chatbot bị `drop`/`rename`/`drop column`.

Điểm mount widget (`src/app/htx/layout.tsx:19`, `cho/layout.tsx:17`,
`don-hang/layout.tsx:11`, `quan-tri/page.tsx:94`) và `/quan-tri/tro-ly` không bị đụng;
tài liệu còn ghi rõ ràng buộc giữ chúng ở bước 3
(`schema-project-platform.md:183`: "Không bỏ các điểm mount chatbot hoặc `/quan-tri/tro-ly`").

### C12 — Không phá build TypeScript — **PASS**

`npm run types` sạch. Vì `user_role` không đổi, `ROLE_LABEL` (`src/lib/labels.ts:5-10`)
không thiếu khoá và `src/app/page.tsx` (landing công khai) không bị ảnh hưởng — rủi ro R9
không phát sinh.

Bàn giao tầng ứng dụng được liệt kê đầy đủ và **đúng số dòng**
(`schema-project-platform.md:180-190`): `auth-actions.ts:69`, `auth.ts:42` (`homePathFor`),
`middleware.ts:6`, `app-nav.tsx:6`, `labels.ts:5`, cộng `requireProjectMember(projectId)`.
So với bảng 9 dòng của checklist C12, tài liệu phủ 8; thiếu duy nhất
`src/lib/chat/tools.ts` — nhưng đó là **đúng**, vì `user_role` không đổi nên mảng `roles`
của công cụ trợ lý không cần sửa. Không có thiếu sót thật.

### C13 — Đính kèm tệp: bucket và policy — **P1**

Phần đạt: hai bucket **mới** riêng, private, có `file_size_limit` và
`allowed_mime_types` (`0013:946-952`); không đụng bucket `evidence`. Đường dẫn được ràng
buộc **hai lớp**: `check` trên bảng (`0013:147-149`: cấp 1 = `project_id`, cấp 2 =
`uploaded_by`) và policy storage đối xứng (`0013:957-960`). Policy đọc cho mọi thành viên,
ghi chỉ cho `app_project_can_write`. Đây là thiết kế chặt.

**Vấn đề — hai policy `restrictive` có thể chặn chính đường upload.**
`0013:970-975` tạo hai policy `as restrictive` trên `storage.objects` cho `UPDATE` và
`DELETE` của vai trò `authenticated`, với điều kiện `bucket_id not in
('project-documents','methodology-templates')`.

Phân tích tác động lên `evidence` là **đúng**: policy restrictive được AND vào mọi policy
permissive của cùng lệnh, và với `bucket_id='evidence'` điều kiện luôn đúng, nên
`evidence_delete` (`0004_functions_storage_factors.sql:69-71`) không đổi hành vi. Tài liệu
nói đúng điều này (`schema-project-platform.md:138`).

Rủi ro nằm ở **hai bucket mới**: Supabase Storage không chỉ `INSERT` vào
`storage.objects` khi tải tệp lên. Tuỳ phiên bản và tuỳ đường tải (resumable/TUS, hoặc
bước ghi `metadata`/`version` sau khi tải xong, hoặc `upload(..., { upsert: true })`), API
storage phát sinh `UPDATE` trên chính hàng đó **dưới vai trò `authenticated`**. Nếu vậy,
policy `project_platform_objects_no_update` sẽ **chặn chính thao tác tải tệp lên** hai
bucket mới — mà mục đích của nó chỉ là chống ghi đè.

Tôi **không kiểm chứng được** điều này bằng đọc mã tĩnh: nó phụ thuộc phiên bản Storage
của project, và ranh giới review cấm chạm môi trường thật.

**Cách sửa đề xuất.** Ưu tiên theo thứ tự:
1. Trên **DB thử nghiệm cô lập**, tải thử một tệp lên `project-documents` bằng
   `supabase-js` với phiên `authenticated` thật, trước khi áp lên môi trường thật. Đây là
   ca kiểm thử bắt buộc, hiện **chưa có** trong danh sách 15 ca ở
   `schema-project-platform.md:172`.
2. Nếu upload bị chặn: bỏ riêng policy `..._no_update`, giữ `..._no_delete`. Tính bất biến
   vẫn được bảo đảm bởi `unique (bucket_id, object_path)` (`0013:146`) + trigger
   `project_files_immutable` (`0013:618`) + quy ước tên object mới mỗi phiên bản — tức lớp
   restrictive `UPDATE` là dư thừa chứ không phải trụ cột.

---

## Nhóm D — Đúng thiết kế & đúng phạm vi

### C14 — Trung thành `PLAN.md`, không dùng tên spec đã bị thay thế — **PASS**

`grep 'organizations|project_cooperatives|mrv_officer|htx_manager|crediting_program'` trên
cả ba tệp cho kết quả **rỗng**. Tài liệu tuyên bố rõ ở dòng đầu
(`schema-project-platform.md:3`): "spec project-layer ngày 05/09 bị thay thế… Không lấy
tên role/tổ chức từ spec cũ". Rủi ro **R1** — hai thiết kế cạnh tranh — đã được đóng.

Vai trò dự án đúng ba giá trị `PLAN.md` §5 yêu cầu: `check (role in
('owner','developer','viewer'))` (`0013:96`).

Đối chiếu 9 thực thể của `PLAN.md` §2 với 16 bảng thực tế — **phủ đủ, không thiếu cái nào**:

| `PLAN.md` §2 | Bảng |
|---|---|
| Standard | `standards` (`0013:13`) |
| Methodology + `metric_schema[]` | `methodologies` (`0013:19`), `metric_schema jsonb` (`0013:30`) |
| Project | `projects` (`0013:73`) |
| Stage (1..7, có thứ tự) | `project_stages`, `check (ordinal between 1 and 7)` (`0013:104`) |
| Task (status/assignee/attachments/comments) | `project_tasks` (`0013:113`), `task_attachments`, `task_comments` |
| Member (owner/developer/viewer) | `project_members` (`0013:94`) |
| MonitoringPeriod | `monitoring_periods` (`0013:185`) |
| MonitoringData (nhập tay + import) | `monitoring_data`, `monitoring_imports` |
| MRVReport | `mrv_reports` (`0013:247`) |

`Standard` và `Methodology` là **bảng riêng** với FK kép, không bị làm phẳng thành cột
`text` — đúng yêu cầu §3 bước 3–4 (dropdown Methodology lọc theo Standard đã chọn).
Bảy stage được sinh đúng tên bước của `PLAN.md` §3 (`0013:582-586`).

### C15 — Đúng phạm vi bước 1→7 và 12→14 — **PASS**

`grep '^create table.*(vvb|valid|issuance|registr|stakeholder)'` rỗng: **không bảng nào**
cho bước 8–11 hay 15–17. Các từ "validation"/"validator" xuất hiện chỉ với nghĩa kiểm tra
dữ liệu kỹ thuật (`project_validate_*`), không phải "validation" trong quy trình carbon.

Vai trò `viewer` có mặt nhưng chỉ là giá trị trong `check` — đúng loại (a) mà checklist
C15 cho phép, và khớp `PLAN.md` §5 ("tuỳ chọn, mở rộng sau, dùng cho Verifier/VVB").

Chiều ngược lại cũng đạt: **Module B có đủ** (`monitoring_periods`, `monitoring_imports`,
`monitoring_data`, `mrv_reports`, `report_templates`), nên không rơi vào lỗi "thiếu một
nửa phạm vi".

### C16 — `metric_schema` tổng quát, không nhúng mã — **PASS, chất lượng cao**

**Không có mã nhúng.** `grep "'eval'|javascript|execute format|dynamic sql"` rỗng. Công
thức được biểu diễn bằng **AST thuần dữ liệu**, và `project_validate_expression`
(`0013:340-379`) cưỡng chế ở tầng DB:
- toán tử **whitelist** đúng 7 giá trị `add/subtract/multiply/divide/min/max/pow`
  (`0013:352`);
- lá chỉ được là `constant|field|baseline|factor|calculation`, mọi tham chiếu phải tồn tại
  (`0013:365-376`);
- giới hạn độ sâu 24 (`0013:347`) và số toán hạng 2–16 (`0013:355`);
- **không tạo được chu trình**: một `calculation` chỉ tham chiếu được các calculation
  **đứng trước nó** (`0013:373`, cưỡng chế bằng cách bồi dần mảng `calcs` ở `0013:426`).

**Tính tổng quát được chứng minh bằng dữ liệu, không chỉ bằng lời.** Seed có 4 methodology
thuộc **3 loại dự án khác nhau**: `afolu` (rừng), `energy` (điện thay thế), `biogas`. Bài
kiểm quyết định của checklist C16 ("thử một methodology **không phải nông nghiệp**") đã
được chính tác giả thực hiện sẵn — `DEMO-GS-BIOGAS` dùng cùng envelope v1 mà không cần
thêm khái niệm nào.

**Không có hard-code lúa nước.** Không cột `water_regime`/`straw_*`/`preseason` nào trong
bảng dùng chung; `0014:67` ghi rõ hệ số mới "không đọc/ghi `emission_factors` legacy".

Meta-schema có ràng buộc hình dạng thật (`project_validate_metric_schema`, `0013:381-428`):
bắt buộc `schema_version=1`, `fields`/`factor_requirements`/`calculations` là mảng, `id`
khớp `^[a-z][a-z0-9_]{0,63}$`, `type` trong 6 giá trị, `scope` trong 2 giá trị, `unit` bắt
buộc, `enum` phải có `options`. `MonitoringData` lưu `metric_values jsonb` theo schema chứ
không phải cột cứng — đúng thứ `PLAN.md` §2 yêu cầu.

Giới hạn đã được tác giả tự khai báo (`schema-project-platform.md:196`): v1 chỉ biểu đạt
observation dạng scalar, chưa có conditional-required, mảng lồng, kiểm thứ nguyên đơn vị,
aggregation có trọng số. Chấp nhận cho v1 vì có `schema_version` để nâng cấp.

### C17 — Seed ghi rõ là MẪU chưa thẩm định — **PASS, chuẩn mực**

Đây là mục tôi lo nhất khi soạn checklist, và là mục thiết kế làm tốt nhất. Bảo vệ ở
**bốn lớp**, không chỉ bằng bình luận:

1. **Bình luận đầu tệp** (`0014:1-4`): "DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH
   CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận."
2. **Cột bắt buộc trong lược đồ**: `is_sample boolean not null default true`,
   `professionally_validated boolean not null default false`, `disclaimer text **not null**`
   (`0013:27-29`), cộng `check (not is_sample or not professionally_validated)`
   (`0013:37`) — không thể vừa là mẫu vừa là đã thẩm định.
3. **Mã methodology cố ý giả**: `DEMO-VCS-FOREST`, `DEMO-VCS-ENERGY`, `DEMO-GS-FOREST`,
   `DEMO-GS-BIOGAS`, phiên bản `demo-1.0`. **Không mượn mã thật** như `VM0007` hay
   `AMS-III.D` — đây chính là kiểu sai mà checklist C17 cảnh báo, và tác giả đã tránh.
4. **Cưỡng chế lúc chạy**: `create_mrv_report` (`0013:838-840`) **từ chối** tạo báo cáo
   `final` khi `m.is_sample` hoặc `not m.professionally_validated` hoặc template chưa
   `ready`. Dữ liệu mẫu chỉ ra được bản `preview`. Con số chưa thẩm định **không thể** đi
   vào một báo cáo chính thức.

`methodology_factors.source` là `not null` (`0013:46`) — có chỗ đặt trích dẫn thật, đúng
khuôn `emission_factors.source` (`0002_mrv_and_market.sql:16`). Template placeholder có
`object_path`/`checksum` NULL và `status='placeholder'`, không giả vờ có tệp thật.

---

## Nhóm E — Toàn vẹn dữ liệu

### C18 — Cách ly giữa các dự án (FK kép) — **PASS, điểm mạnh nhất của thiết kế**

Thủ pháp: mỗi bảng con mang **cột `project_id` riêng**, kèm `unique (id, project_id)` trên
bảng cha, và FK **kép/ba** neo cả khoá lẫn `project_id`. Postgres từ chối ở tầng ràng
buộc, không phải ở tầng mã ứng dụng.

Tôi thử 9 ca tấn công cụ thể trên giấy; **cả 9 đều bị chặn**:

| # | Ca tấn công | Bị chặn bởi |
|---|---|---|
| 1 | Task của dự án A trỏ `stage_id` của dự án B | FK `(stage_id, project_id) → project_stages(id, project_id)` (`0013:130`) |
| 2 | Giao task cho người **không phải thành viên** | FK `(project_id, assignee_id, assignee_role) → project_members(project_id, user_id, role)` (`0013:131-132`) |
| 3 | Giao task cho một **viewer** | cùng FK trên + `assignee_role` bị `check (= 'developer')` (`0013:122`) và **không nằm trong `grant update(...)`** (`0013:930`) |
| 4 | Giao task cho developer của dự án khác | cùng FK — bộ ba `(A, user_B, 'developer')` không tồn tại |
| 5 | `monitoring_data` gắn vào kỳ của dự án khác | FK `(period_id, project_id) → monitoring_periods(id, project_id)` (`0013:238`) + RPC tự suy `project_id` từ kỳ (`0013:768`) |
| 6 | Báo cáo dùng template khác Standard/Methodology | FK ba cột `(template_id, methodology_id, standard_id)` (`0013:275-276`) **và** kiểm lại trong RPC (`0013:836`) |
| 7 | Đính kèm tệp của dự án khác vào task | hai FK cùng neo `project_id` (`0013:166-167`) |
| 8 | Đổi `project_tasks.project_id` để "chuyển" task sang dự án khác | **quyền cột**: `project_id` không có trong `grant update(...)` (`0013:930`) |
| 9 | Tự thêm mình làm owner bằng `insert into project_members` | không có policy INSERT **và** không có quyền bảng (`0013:918-925`); chỉ `set_project_member` với kiểm owner (`0013:684`) |

Kỳ giám sát còn được neo ba tầng: FK `(project_id, methodology_id, standard_id) →
projects(id, methodology_id, standard_id)` (`0013:207-208`) — kỳ **không thể** dùng
methodology khác với methodology đã khoá của dự án.

### C19 — Nguyên tử & khoá — **PASS**

**Tạo project + owner + 7 stage có nguyên tử không? — Có.** `create_project` (`0013:665`)
insert một dòng; trigger `projects_bootstrap` **AFTER INSERT** (`0013:577-590`) tạo
membership owner và đúng 7 stage **trong cùng transaction của người gọi**. Một câu lệnh
từ client, hoặc thành công trọn vẹn hoặc không có gì.

Đây là điểm đối chiếu trực tiếp với lỗi cũ mà checklist nêu: `computeAndSave`
(`src/lib/mrv/collect.ts:215-245`) làm hai lượt PostgREST riêng biệt — `update ... set
is_current=false` rồi `insert` — nên `insert` lỗi là thửa-vụ mất sạch bản tính hiệu lực.
**Thiết kế mới không lặp lại lỗi đó**: mọi ghi nhiều bảng đều nằm trong một hàm plpgsql.

**Có mất được owner cuối cùng không? — Không.** `project_guard_member` (`0013:565-570`)
chặn cả DELETE lẫn hạ vai trò khi không còn owner nào khác. Chạy `before ... for each row`
nên bắt cả đường RPC lẫn (giả định) đường DML trực tiếp.

**Kỳ đã khoá còn ghi được không? — Không, chặn hai lớp.** `project_guard_period`
(`0013:632-634`) cấm mọi UPDATE khi `old.status='locked'`; `project_guard_monitoring_data`
(`0013:650`) khoá dòng kỳ bằng `for update` rồi từ chối nếu `status <> 'open'`. Ba RPC ghi
đều kiểm lại `p.status <> 'open'`.

**Đồng thời.** Thứ tự khoá được thống nhất và ghi rõ: **project trước, period sau**
(`0013:751-753`, lặp lại ở `delete_monitoring_record` và `lock_monitoring_period`) — tránh
deadlock chéo. Optimistic concurrency bằng `p_expected_revision` so với
`data_revision`. `set_project_member`/`approve_project_stage`/`create_monitoring_period`
đều `select ... for update` trên `projects` **trước** khi kiểm quyền, nên không bị đua với
một owner khác đang thu hồi quyền.

Ghi chú P2 — `approve_project_stage` (`0013:711-712`) dùng `update ... where approved_at
is null`: duyệt lại một stage đã duyệt là **no-op im lặng**, không báo lỗi. Nên trả về
trạng thái hoặc raise để giao diện phân biệt được "vừa duyệt" và "đã duyệt từ trước".

### C20 — Snapshot/version — **PASS**

**Publish methodology version mới có làm báo cáo cũ đổi số không? — Không.** Ba lớp:
1. Một dòng `methodologies` = **một phiên bản** (`unique (standard_id, code, version)`,
   `0013:34`); bản mới là dòng mới, không sửa dòng cũ.
2. `project_guard_methodology` (`0013:478`) cấm mọi UPDATE lên dòng `published`.
3. Kỳ giám sát **chụp** `schema_snapshot`, `baseline_snapshot`, `factors_snapshot` ngay
   lúc tạo (`0013:731-737`), lấy từ DB chứ không nhận từ client — nên kể cả catalog đổi,
   kỳ vẫn giữ bản đã chụp.

**`schema_hash`/`data_revision` có đủ để phát hiện dữ liệu đổi sau khi sinh report không?
— Có, và mạnh hơn mức phát hiện: nó *ngăn* dữ liệu đổi.**
- `schema_hash` là cột **generated** từ `metric_schema` (`0013:31`), và kỳ có
  `check (schema_hash = project_json_hash(schema_snapshot))` (`0013:195`) — hash không thể
  lệch khỏi nội dung.
- Báo cáo chỉ sinh từ kỳ **đã khoá** (`0013:834`), và kỳ đã khoá thì bất biến. Ảnh chụp dữ
  liệu (`data_snapshot`) được đóng băng lúc khoá (`0013:813`) với thứ tự ổn định
  (`order by record_key`).
- `mrv_reports` lưu lại toàn bộ `schema_hash`, `schema_snapshot`, `baseline_revision`,
  `factors_snapshot`, `data_revision`, `input_snapshot`, `template_snapshot`,
  `engine_version` (`0013:255-266`) và là **append-only** (`0013:624`). Tái lập được con số
  bất kỳ lúc nào.

Ghi chú P2 — `results` và `calculation_trace` do backend truyền vào (`0013:817-818`); DB
**không tự tính lại** để đối chiếu với AST. Snapshot đảm bảo *đầu vào* không đổi, nhưng
một lỗi ở engine sinh ra `results` sai từ đầu vào đúng thì DB không phát hiện được.
`engine_version` cho phép truy vết sau này; nên bổ sung một bộ test tái tính từ
`input_snapshot` trong CI ở bước 5.

### C21 — Hành vi xoá có chủ ý — **P2**

Toàn bộ **43/43 FK dùng `on delete restrict`**, không một `cascade` nào — nhất quán với
nguyên tắc "không phá lịch sử", và tránh được dây cascade sang dữ liệu được giữ. Xoá
project là **xoá mềm** (`deleted_at`), hard delete bị trigger chặn (`0013:531`). Tệp,
document, import, report đều append-only qua `project_reject_mutation` (`0013:614-625`).

**Hệ quả chưa được nêu trong tài liệu: xoá tài khoản người dùng sẽ thất bại.**
`profiles.id references auth.users(id) **on delete cascade**`
(`0001_core_schema.sql:41`). Mười FK mới trỏ vào `profiles` với `on delete restrict`
(`0013:77,96,108,125,138,156,203,222,239,268`). Chuỗi khi xoá một tài khoản:

```
delete auth.users → cascade xoá profiles → RESTRICT từ projects.created_by
                                          (và 9 FK khác) → toàn bộ lệnh xoá THẤT BẠI
```

Nghĩa là **một khi người dùng đã tạo dự án, viết một task, hay tải một tệp, tài khoản của
họ không xoá được nữa** qua Supabase Auth. Bảng chat cố ý chọn khác (`chat_conversations
.user_id → profiles on delete **cascade**`, `0010_chat.sql:12`), nên hai nửa hệ thống hiện
hành xử ngược nhau. Tài liệu nói "thu hồi object/vĩnh viễn dữ liệu là quy trình riêng
ngoài thiết kế này" (`schema-project-platform.md:18`) nhưng không nêu ràng buộc cụ thể này.

**Cách sửa đề xuất.** Không đổi `restrict` (giữ lịch sử là đúng), mà **ghi rõ vào tài
liệu** rằng xoá tài khoản không còn là thao tác nguyên tử, kèm quy trình thay thế: ẩn danh
`profiles.full_name`/`phone` và giữ `id`, thay vì xoá dòng. Nếu sản phẩm cần quyền được
xoá dữ liệu cá nhân, phải thiết kế đường ẩn danh này trước khi có người dùng thật.

### C22 — Index cho đường nóng RLS — **PASS**

`0013:281-318` tạo 38 index; cùng với PK/UNIQUE, tài liệu tuyên bố phủ đủ 43 FK
(`schema-project-platform.md:65`) và tôi đếm khớp: 16 bảng / 42 policy / 43 FK đúng như
tài liệu ghi.

Hai hàm nằm trên đường nóng đều có index đỡ:
- `app_project_role(p_project_id)` lọc `(project_id, user_id)` — trúng **PK** của
  `project_members` (`0013:99`), tra một dòng.
- `app_project_ids()` lọc `user_id` — trúng `members_user_idx` (`0013:287`).
- `app_project_can_write` join `projects × project_members` trên `id`/`project_id` — trúng
  PK cả hai phía.

Ghi chú P2 — `app_project_can_write` được gọi trong `with check` của mọi policy ghi và
`app_project_role` trong mọi policy đọc, tức chạy **mỗi dòng, mỗi truy vấn**. Cả hai là
`stable` nên Postgres được phép nhớ kết quả trong một câu lệnh, nhưng vẫn nên đo lại khi
số dự án lớn. Tác giả đã tự nêu rủi ro tải ở `schema-project-platform.md:198`.

---

## Bảng kết quả 22 mục

| Mã | Nội dung | Kết quả |
|---|---|---|
| C1 | Fail-closed RLS, đủ 4 thao tác | PASS (có ghi chú kiến trúc RPC-only) |
| C2 | Quyền hàm: definer + `search_path` + revoke/grant | PASS (27/27 hàm) |
| C3 | Policy đệ quy | PASS |
| C4 | `app.bypass_profile_guard` | PASS (không đụng) |
| C5 | Danh tính thành viên qua `profiles_select` | **P1** |
| C6 | Bẫy enum PostgreSQL | PASS (không áp dụng) |
| C7 | `handle_new_user` danh sách trắng | PASS (không đụng) |
| C8 | Dựng lại DB; không sửa migration cũ | **P2** (`begin;`/`commit;`) |
| C9 | Sinh lại `src/types/database.ts` | PASS |
| C10 | Không phá phần được giữ | PASS |
| C11 | Không làm gãy chatbot | PASS (`types` sạch, 88/88 test) |
| C12 | Không phá build TypeScript | PASS |
| C13 | Đính kèm tệp: bucket & policy | **P1** (policy restrictive UPDATE) |
| C14 | Trung thành `PLAN.md` | PASS |
| C15 | Đúng phạm vi 1→7, 12→14 | PASS |
| C16 | `metric_schema` tổng quát, không nhúng mã | PASS |
| C17 | Seed ghi rõ là MẪU | PASS |
| C18 | Cách ly giữa các dự án | PASS (9/9 ca tấn công bị chặn) |
| C19 | Nguyên tử & khoá | PASS |
| C20 | Snapshot/version | PASS |
| C21 | Hành vi xoá có chủ ý | **P2** (xoá tài khoản) |
| C22 | Index đường nóng RLS | PASS |

**18 PASS · 0 P0 · 2 P1 · 2 P2.**

---

## Phán quyết: **ĐẠT CÓ ĐIỀU KIỆN**

Thiết kế vượt mức mong đợi ở những chỗ khó nhất. Bốn điểm đáng ghi nhận:

1. **Né sạch hai bẫy P0 nguy hiểm nhất** bằng một quyết định kiến trúc đúng: không đụng
   `user_role`, tách `project_members.role` thành trục thứ hai. Nhờ đó C6 và C7 — trong đó
   C7 là mục tôi đánh dấu "quan trọng nhất" vì nó hỏng **im lặng** — không còn khả năng
   xảy ra.
2. **Cách ly dự án làm bằng ràng buộc, không bằng mã ứng dụng.** FK kép/ba cộng quyền theo
   cột chặn được cả 9 ca tấn công tôi nghĩ ra, kể cả ca tinh vi nhất (đổi `project_id` của
   task để chuyển sang dự án khác).
3. **Trung thực của dữ liệu mẫu được cưỡng chế ở tầng DB**, không chỉ bằng bình luận: mã
   methodology cố ý giả, `is_sample`/`disclaimer` là cột `not null`, và `create_mrv_report`
   **từ chối** xuất báo cáo `final` từ dữ liệu chưa thẩm định. Với một hệ thống mà con số
   đi vào hồ sơ phát hành tín chỉ, đây là chỗ dễ làm ẩu nhất và đã được làm nghiêm nhất.
4. **Tài liệu tự khai giới hạn** ở `schema-project-platform.md:192-203` — bảy điểm bất
   định, trong đó điểm 1 tự nhận "SQL chưa được PostgreSQL thực thi" là mức bất định lớn
   nhất. Review dựa được vào một tài liệu như vậy.

Không có phát hiện P0. Hai P1 đều **không** phải lỗi trong lược đồ mà là khoảng trống ở
biên: một cái do thiết kế cố ý không nới quyền (C5), một cái do tương tác với thành phần
ngoài tầm kiểm soát tĩnh (C13).

### Bắt buộc sửa trước khi áp lên DB thật

| # | Mục | Việc |
|---|---|---|
| 1 | C13 · P1 | Trên **DB thử nghiệm cô lập**, tải thử tệp lên `project-documents` bằng phiên `authenticated` thật. Nếu policy `project_platform_objects_no_update` (`0013:970-972`) chặn đường upload thì bỏ riêng policy đó, giữ `..._no_delete`. Bổ sung ca này vào danh sách kiểm thử `schema-project-platform.md:172` — hiện **chưa có**. |
| 2 | C8 · P2 | Chốt một đường áp duy nhất: bỏ `begin;`/`commit;` khỏi `0013`/`0014` cho đồng nhất với `0001`–`0012`, **hoặc** ghi rõ hai tệp này chỉ áp bằng `psql -1 -v ON_ERROR_STOP=1 -f`, không bằng `supabase db push`. |
| 3 | C21 · P2 | Ghi vào tài liệu hệ quả "xoá tài khoản `auth.users` sẽ thất bại sau khi người dùng tạo dự án", kèm quy trình ẩn danh thay cho xoá. Không cần đổi `restrict`. |

### Bắt buộc sửa trước khi bắt đầu Module A (không chặn việc áp DB)

| # | Mục | Việc |
|---|---|---|
| 4 | C5 · P1 | Bổ sung đường đọc danh tính thành viên trong phạm vi dự án — RPC `security definer` hẹp trả `(user_id, full_name)` cho thành viên cùng dự án, và một đường tra người theo email để owner mời. **Không** nới `profiles_select` toàn cục. Thiếu cái này thì danh sách thành viên và assignee hiện UUID trống tên, và trên thực tế chưa mời được ai. |

### Khuyến nghị, không chặn

- C19 · P2 — `approve_project_stage` (`0013:711`) duyệt lại stage đã duyệt là no-op im
  lặng; nên trả trạng thái hoặc raise.
- C20 · P2 — thêm test CI tái tính `results` từ `input_snapshot` để bắt lỗi engine; DB
  hiện tin `results` do backend truyền vào.
- C1 · P2 — `platform_admin` không có membership thì không đọc được dự án nào
  (`schema-project-platform.md:130`). Đúng nguyên tắc đặc quyền tối thiểu, nhưng nghĩa là
  **không có đường hỗ trợ vận hành**; nên chốt chủ ý này với sản phẩm.
- C22 · P2 — đo lại chi phí `app_project_can_write`/`app_project_role` khi số dự án lớn.

### Ranh giới đã giữ trong lượt review này

Không sửa tệp nào của `worker-codex`; không áp migration lên Supabase thật; không chạy
`test:e2e`. Hai lệnh duy nhất được chạy là `npm run types` và `npm run test`, cả hai không
chạm cơ sở dữ liệu. Tệp duy nhất được ghi là chính tài liệu này.
