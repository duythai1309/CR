# Bước 3 — Auth và vai trò tầng ứng dụng cho nền tảng dự án

Ngày 06/9/2026. Tiếp nối `docs/audit/audit-keep.md` §3 (13 việc),
`docs/design/schema-review-findings.md` (mục C5, P1) và
`docs/design/schema-verification-report.md`.

Bước này **chặn cả Module A và Module B** (`PLAN.md` §6 bước 3).

**Ranh giới đã giữ:** không chạm Supabase thật (không `db push`, không `apply_migration`,
không đọc credential trong `.env.local`, không `test:e2e`). Không đụng
`src/lib/chat/**`, `src/app/api/chat/**`, `src/components/chat/**`. Không đụng vùng đang
chạy song song của `worker-codex`: `src/types/project-platform.ts`, `src/lib/methodology/**`,
`src/lib/monitoring/**`, `src/lib/mrv/report.ts`.

---

## 1. Quyết định vai trò toàn cục: **KHÔNG thêm giá trị vào `user_role`** — phương án (a)

### Quyết định

Người đăng ký mới cho nền tảng dự án mang vai trò toàn cục **`coop_staff`**, được dùng ở
đây với nghĩa **"tài khoản nền tảng, chưa gắn đặc quyền module cũ nào"**. Enum `user_role`
giữ nguyên 4 giá trị `platform_admin | coop_manager | coop_staff | buyer`.
`handle_new_user` (`0012_signup_role_guard.sql:27-50`) **không bị sửa**.

Quyền trên nền tảng dự án **không** đọc `user_role` một lần nào. Toàn bộ phân quyền nằm ở
`project_members.role` (`owner|developer|viewer`) và được RLS cưỡng chế
(`0013_project_platform.sql:887-915`).

### Vì sao không chọn (b) — thêm giá trị enum

Ba lý do, xếp theo sức nặng:

1. **`user_role` là một enum sắp bị thay thế.** Sau bước 3 nó chỉ còn đúng một việc: gác
   bốn module cũ `/htx`, `/cho`, `/don-hang`, `/quan-tri` — vốn sẽ bị gỡ ở bước 6
   (`PLAN.md` §6). Bỏ chi phí và rủi ro vào việc mở rộng một enum sắp co lại là sai thời
   điểm. Thời điểm đúng để phẫu thuật `user_role` là bước 6, khi biết chắc còn giữ giá trị
   nào.

2. **Giá trị mới không mua được quyền gì.** `create_project`
   (`0013_project_platform.sql:665-676`) cho **mọi tài khoản có `profiles`** tạo dự án, bất
   kể vai trò toàn cục. Một `coop_manager` đang dùng module cũ vẫn có thể đồng thời là
   Project Owner. Nên `user_role` không phải và không được là điều kiện vào nền tảng dự án;
   thêm `project_user` chỉ mua được **nhãn hiển thị và đích điều hướng mặc định** — hai thứ
   giải quyết được ở tầng ứng dụng mà không đụng cơ sở dữ liệu (xem §3).

3. **Chi phí rủi ro thực sự cao và bất đối xứng.** Chọn (b) buộc phải sửa
   `handle_new_user`, là hàm có chế độ hỏng **im lặng** nguy hiểm nhất trong toàn hệ thống:
   danh sách trắng `0012:33-38` **âm thầm hạ mọi giá trị lạ về `coop_staff`**, cố ý không
   báo lỗi (lý do ghi ở `0012:19-22`). Đây là rủi ro **R5** trong audit và là mục tôi đánh
   dấu "quan trọng nhất" trong `schema-review-checklist.md` (C7). Kèm theo: phải tách hai
   tệp migration vì giá trị enum mới không dùng được trong cùng transaction (C6), phải sửa
   `ROLE_LABEL` là `Record<Enums["user_role"], string>` nếu không `npm run types` đỏ ngay
   (`src/lib/labels.ts:5-10`), và `create or replace function handle_new_user` **đặt lại
   quyền mặc định** nên phải `revoke` lại (`0012:52`) — một bẫy phụ rất dễ sót.
   Đổi lại chỉ được một nhãn đẹp hơn. Trao đổi không xứng.

### Cái giá của (a), nói thẳng

`coop_staff` dịch ra là "Cán bộ hợp tác xã". Với một người phát triển dự án carbon thì
nhãn đó **sai nghĩa**. Ba hệ quả và cách xử lý:

| Hệ quả | Xử lý |
|---|---|
| `ROLE_LABEL[coop_staff]` hiện "Cán bộ hợp tác xã" trên thanh điều hướng | Trong ngữ cảnh dự án, thanh điều hướng hiện **vai trò dự án** (`PROJECT_ROLE_LABEL`) thay cho vai trò toàn cục — xem §3 |
| `homePathFor(coop_staff, null)` cũ đưa về `/thiet-lap` ("Thiết lập hợp tác xã") | `homePathFor` được viết lại để điều hướng **theo trạng thái**, không theo vai trò — xem §3 |
| `toolsForRole('coop_staff')` cho trợ lý các công cụ HTX trả về rỗng | Không rò rỉ (RLS lọc theo `app_coop_id()` = `null` ⇒ 0 dòng). Trợ lý hiện chỉ gắn ở route module cũ nên người dùng nền tảng dự án chưa gặp. Việc thật thuộc bước 6. |

**Không có va chạm với luồng cũ.** `coop_staff` hiện **không phải là lựa chọn đăng ký**:
biểu mẫu chỉ có `coop_manager` và `buyer` (`src/app/dang-ky/form.tsx:15-16`), còn
`coop_staff` là vai trò do `join_cooperative_by_code` gán khi gia nhập HTX bằng mã
(`0005_business_rpc.sql:69`). Hai nhóm phân biệt được bằng `cooperative_id`:
có HTX ⇒ cán bộ HTX thật; không có HTX ⇒ tài khoản nền tảng dự án.

### Điều kiện phải xem lại quyết định này

Ghi rõ để lần sau không phải đoán. Chuyển sang (b) **ngay** nếu một trong ba điều xảy ra:

1. Có mã của nền tảng dự án bắt đầu **đọc `user_role`** để quyết định quyền.
2. Cần phân biệt hai nhóm `coop_staff` ở tầng dữ liệu chứ không chỉ qua `cooperative_id`
   (ví dụ khi `cooperative_id` không còn là cột đáng tin sau bước 6).
3. Đến bước 6, khi module cũ bị gỡ — lúc đó `user_role` nên được thiết kế lại trọn vẹn,
   không phải vá thêm.

---

## 2. Migration `0015_project_identity.sql` — lấp mục C5

`docs/design/schema-review-findings.md` để mở C5 (P1): chưa có đường đọc tên thành viên,
nên danh sách thành viên hiện UUID trống tên và **chưa mời được ai**. Nguyên nhân:
`profiles_select` (`0003_rls.sql:59-60`) chỉ cho đọc hồ sơ của chính mình, của quản trị,
hoặc của người **cùng `cooperative_id`** — mà nền tảng dự án cố ý không gắn hợp tác xã.

Cách chữa: **không nới `profiles_select`** (đó là đường rò cả danh bạ nền tảng, bảng
`profiles` có cả `phone`), mà mở đúng hai cửa hẹp `security definer`.

### `project_member_directory(p_project_id uuid)`

Trả `(user_id, full_name, role, email)` cho thành viên của một dự án, và **chỉ khi người
gọi cũng là thành viên** dự án đó. Người ngoài nhận **tập rỗng, không phải lỗi** — không
xác nhận dự án có tồn tại hay không.

`email` chỉ trả cho **owner**. Thành viên thường thấy tên (đủ để hiển thị assignee và tác
giả bình luận); địa chỉ liên hệ là dữ liệu định danh, chỉ người quản lý thành viên mới
cần. Cột `phone` **không bao giờ** đi qua hàm này.

### `project_lookup_invitee(p_project_id uuid, p_email text)`

Trả `(user_id, full_name, already_member)` để owner mời người vào dự án. Đây là một
**oracle liệt kê người dùng**, nên bị siết ba tầng:

1. Chỉ **owner của đúng dự án truyền vào** gọi được — không có "tra cứu người chung".
2. Khớp `lower(email)` **tuyệt đối**. Không `LIKE`, không tiền tố, không ký tự đại diện.
3. Chỉ trả ba trường trên. Không `phone`, không `cooperative_id`, không `user_role`.

Không tìm thấy thì trả 0 dòng; tầng ứng dụng (`lookupInvitee`) đổi thành một thông báo
trung tính, **không** nói "email này chưa có tài khoản" — câu đó biến màn hình mời thành
công cụ dò xem ai có tài khoản.

### Tuân thủ khuôn

Cả hai hàm: `set search_path = public`; `revoke all ... from public, anon, authenticated,
service_role` rồi `grant execute ... to authenticated` — đúng khuôn `0007_harden.sql:63-78`
và `0013_project_platform.sql:977-995`, gồm cả việc thu từ `public` (PostgreSQL mặc định
cấp `EXECUTE` cho `PUBLIC`, chỉ thu từ `anon` là chưa đủ). **Không** `begin;`/`commit;` —
runner sở hữu transaction, đã chốt ở mục C8.

---

## 3. API mới của `src/lib/auth.ts` và sơ đồ điều hướng

### Giữ nguyên (phần được giữ đang dùng)

`getProfile`, `requireProfile`, `requireCoopProfile`, `Profile`, `UserRole` — **không đổi
chữ ký, không đổi hành vi**. 30 lời gọi `requireCoopProfile`/`requireProfile` trong module
cũ không phải sửa một dòng nào.

### `homePathFor(role, cooperativeId)` — viết lại RUỘT, giữ nguyên CHỮ KÝ

Đây là cách xử lý rủi ro **R9**: `src/app/page.tsx:3` và `:101` (trang chủ **công khai**)
gọi hàm này. Thay vì sửa `auth.ts` rồi phải nhớ sửa `page.tsx`, chữ ký được giữ nguyên nên
**`src/app/page.tsx` không cần sửa một ký tự nào** — không có cửa sổ nào để quên.

```
platform_admin              → /quan-tri
buyer                       → /cho
bất kỳ ai đã có HTX         → /htx
coop_manager chưa có HTX    → /thiet-lap      (luồng HTX cũ, giữ nguyên)
còn lại (coop_staff, chưa có HTX) → /du-an    (MỚI: tài khoản nền tảng dự án)
```

Điều hướng theo **trạng thái**, không theo vai trò — đó là cách phân biệt hai nghĩa của
`coop_staff` mà không cần giá trị enum mới.

### Thêm mới

| Hàm | Việc |
|---|---|
| `getProjectRole(projectId)` | Vai trò trong một dự án, hoặc `null`. Gọi thẳng RPC `app_project_role` (`0013:323-326`) — **đúng hàm mà mọi policy RLS dùng**, nên tầng ứng dụng không thể lệch với cơ sở dữ liệu. |
| `requireProjectMember(projectId, minimum?)` | Chặn trang/hành động theo vai trò dự án; `minimum` mặc định `viewer`, thứ tự `viewer < developer < owner`. Người không đủ quyền nhận **404 chứ không phải 403** — 403 xác nhận dự án tồn tại. DB hành xử y hệt (ca `D03`). |
| `getProjectMembers(projectId)` | Danh bạ, qua `project_member_directory`. |
| `lookupInvitee(projectId, email)` | Tra người để mời, qua `project_lookup_invitee`. |
| `ProjectRole` | Tái xuất từ `src/types/project-platform.ts` của `worker-codex` (chỉ đọc, không sửa). |

`requireProjectMember` là **lớp phòng thủ thứ hai**, cho trải nghiệm người dùng. Lớp chặn
thật vẫn là RLS: quên gọi nó thì Postgres vẫn từ chối dữ liệu ngoài phạm vi.

### Một cửa ép kiểu duy nhất

`src/types/database.ts` sinh từ DB thật và **chưa thể sinh lại** ở bước này (mục C9: phải
áp 0013–0015 rồi mới `supabase gen types`, mà bước 3 không được chạm Supabase thật). Nên
mọi truy vấn tới bảng/hàm mới đi qua đúng **một** hàm `projectClient()` trong `auth.ts`,
thay vì rải `as any`. Khi types được sinh lại: xoá hàm đó, TypeScript sẽ chỉ ra từng chỗ
phải sửa.

### Các tệp khác

| Tệp | Thay đổi |
|---|---|
| `src/middleware.ts:6` | `PROTECTED` thêm `/du-an`; **giữ nguyên** `/htx`, `/cho`, `/don-hang`, `/thiet-lap`, `/quan-tri`. `/`, `/dang-nhap`, `/dang-ky` vẫn công khai. |
| `src/lib/labels.ts` | Thêm `PROJECT_ROLE_LABEL` (`owner`→"Chủ dự án", `developer`→"Đơn vị phát triển", `viewer`→"Người xem"). `ROLE_LABEL` **không đổi** vì enum không đổi. |
| `src/app/dang-ky/form.tsx` | Ô chọn gửi `account_kind` (`du_an`/`htx`/`buyer`) — **ngữ cảnh, không phải giá trị enum**, nên trình duyệt không chọn được vai trò tuỳ ý. Thêm lựa chọn "Đơn vị phát triển dự án carbon" và đặt nó làm mặc định. |
| `src/app/auth-actions.ts` | Ánh xạ `account_kind → user_role` ở **một chỗ duy nhất**; giá trị lạ trả lỗi **nhìn thấy được** thay vì để `handle_new_user` âm thầm hạ về `coop_staff`. Chuyển hướng sau đăng ký dùng lại `homePathFor`. |
| `src/components/app-nav.tsx` | Thêm prop **tuỳ chọn** `projectRole`: có thì hiện menu dự án và nhãn vai trò dự án; không có thì hành vi cũ y nguyên (8 lời gọi hiện có không phải sửa). Thêm `accountLabel()` để `coop_staff` chưa có HTX hiện "Tài khoản nền tảng" thay vì "Cán bộ hợp tác xã". |
| `src/app/page.tsx` | **Không sửa** — xem phần `homePathFor` ở trên. |

---

## 4. Kết quả kiểm chứng

### Cơ sở dữ liệu — Docker cục bộ, không chạm Supabase thật

Tái dùng hạ tầng bước 2b (`tests/db/run.py`), cùng image pin theo digest, `--network none`,
tmpfs, không mount repo/secret. `run.py` được nới để áp **15** migration thay vì 14.

```
python3 -B tests/db/run.py --run-id step3-02 \
  --image postgis/postgis@sha256:d0b5a6ecab18997637f55a83cb4a9467391de5645916cfa1b6f2a8d19eee7be5
→ 15/15 migration áp sạch (gồm 0015_project_identity.sql)
→ RESULT: 93 / 93 ca đạt
```

15 ca mới cho C5 (`tests/db/cases.py`), chạy dưới phiên `authenticated` thật với GUC
`request.jwt.claim.sub`, không phải superuser:

| Ca | Nội dung |
|---|---|
| `D01` | Owner đọc danh bạ: đủ thành viên, **có** email |
| `D02` | Developer đọc danh bạ: thấy tên, **không** thấy email |
| `D03` | Outsider: **rỗng, không lỗi** — không lộ dự án có tồn tại |
| `D04` | `anon` không execute được (42501) |
| `D05` | `full_name` trả đúng từ `profiles` |
| `D06` | **`profiles_select` không bị nới**: vẫn không đọc được hồ sơ ngoài phạm vi |
| `I01`/`I02` | Owner tra người: `already_member` đúng cả hai chiều |
| `I03`/`I04`/`I09` | Developer, outsider, và owner của **dự án khác** đều bị từ chối |
| `I05`/`I06` | `%` và tiền tố `u3` trả **0 dòng** — không liệt kê được người dùng |
| `I07` | Email rỗng bị từ chối |
| `I08` | Khác hoa/thường vẫn khớp |

Lần chạy đầu (`step3-01`) có 2 FAIL ở `I01`/`I02`: **lỗi kỳ vọng của chính test**
(`||` trên `boolean` cho `true`/`false` chứ không phải `t`/`f`), không phải lỗi SQL. Đã
sửa kỳ vọng, không sửa migration. Cả hai log còn trong `tests/db/runs/step3-01`.

### Tầng ứng dụng

```
npm run types  → sạch, không lỗi
npm run test   → 97/97 ca đạt tại thời điểm sửa xong phần của bước 3
npm run build  → Compiled successfully, 21/21 trang, "/" dựng được
```

**97 chứ không phải 88** vì thêm `tests/auth-role.test.ts` (9 ca). 88 ca cũ vẫn đạt nguyên
vẹn, gồm `tests/chat.test.ts` 49/49 — chatbot không bị đụng.

Ở lần chạy kiểm tra cuối cùng, con số là **204/204 trên 9 tệp**: `worker-codex` chạy song
song đã thêm `tests/methodology.test.ts` (55), `tests/monitoring-import.test.ts` (40) và
`tests/mrv-report.test.ts` (12) trong lúc bước 3 đang làm. Phần thuộc bước 3 vẫn là 9 ca
mới; toàn bộ hai nhánh song song chạy chung không xung đột.

`npm run build` được chạy thêm ngoài yêu cầu vì đây là cách duy nhất chứng minh rủi ro
**R9** không xảy ra: trang chủ công khai `/` phải dựng được sau khi sửa `auth.ts`.

---

## 5. Điều còn chưa chắc

1. **`/du-an` chưa tồn tại.** Đây là hệ quả trực tiếp và **đã biết** của thứ tự bước:
   `homePathFor` và biểu mẫu đăng ký nay trỏ tới `/du-an`, nhưng trang đó là việc của
   **bước 4 (Module A)**, và `src/app/du-an/**` không nằm trong danh sách tệp bước 3 được
   ghi. **Cho tới khi Module A lên, người đăng ký mới sẽ gặp 404 sau khi tạo tài khoản.**
   Không có cách nào tránh trong phạm vi bước 3; phải coi Module A là việc kế tiếp ngay,
   hoặc tạm trỏ `/du-an` về `/thiet-lap` nếu cần deploy trước.

2. **RPC chưa được gọi từ mã ứng dụng thật.** `getProjectRole`, `getProjectMembers`,
   `lookupInvitee` đã kiểm ở tầng SQL (93/93) nhưng **chưa** đi qua PostgREST: tên tham số
   (`p_project_id`, `p_email`), hình dạng JSON trả về của hàm `returns table`, và cách
   `supabase-js` bọc kết quả đều chưa được chứng minh. Rủi ro chính là hình dạng trả về —
   PostgREST trả mảng object cho `returns table`, mã đã viết theo giả định đó nhưng **giả
   định chưa được kiểm**. Phải kiểm ngay khi Module A gọi thật.

3. **`src/types/database.ts` chưa sinh lại** (mục C9). Cho tới lúc đó, một cửa ép kiểu ở
   `auth.ts` che mất kiểm tra kiểu cho toàn bộ truy vấn bảng mới. `npm run types` sạch
   **không** chứng minh tên cột đúng.

4. **Môi trường kiểm chứng lệch bản vá.** Như bước 2b: PostgreSQL 17.0/PostGIS 3.4.3 trong
   Docker, đích là 17.6/PostGIS 3.3.7. Chưa chạy trên bản khớp đích.

5. **Chưa kiểm bằng phiên đăng nhập thật.** Shim đặt `auth.uid()` bằng GUC; không có
   GoTrue/JWT/PostgREST. Không kết luận được gì về xác thực token thật.

6. **Mục C13 (policy restrictive trên `storage.objects`) vẫn mở** — không thuộc phạm vi
   bước 3, nhưng vẫn là P1 chưa đóng trong `schema-review-findings.md`.

7. **Luồng mời hoàn chỉnh chưa có.** `0015` mới cấp *tra cứu*; chưa có bảng lời mời,
   token, hay bước chấp nhận. Owner hiện chỉ mời được người **đã có tài khoản**. Thiết kế
   luồng mời qua email thuộc Module A.
