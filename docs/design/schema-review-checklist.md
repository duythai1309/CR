# Checklist review schema nền tảng quản lý dự án Carbon Credit

Soạn ngày 06/9/2026, **trước khi đọc thiết kế** của `worker-codex` — cố ý như vậy để
tiêu chí là ràng buộc rút từ mã nguồn hiện có, không phải mô tả lại thứ đã được viết ra.

Nguồn ràng buộc: `docs/audit/audit-keep.md` (audit phần GIỮ LẠI) + `PLAN.md`.

## Đây là gì / không phải gì

- **Là**: bộ tiêu chí kiểm chứng được để review migration schema mới (bước 2, `PLAN.md` §6).
- **Không phải**: kết quả review. Tại thời điểm soạn, chưa mục nào được chấm.

## Chuẩn review đã chốt

1. **`PLAN.md` là thiết kế thắng.** Entity model theo §2; vai trò dự án là
   `owner | developer | viewer`. `docs/superpowers/specs/2026-09-05-project-layer-design.md`
   **đã bị thay thế** — dùng tên bảng hoặc tên vai trò của spec đó là SAI (xem C14).
2. Hỗ trợ đúng 2 Standard: **Verra (VCS)** và **Gold Standard**.
3. `metric_schema` do người thiết kế tự định nghĩa (xem C16).
4. Export MRV report theo template có sẵn của từng cặp `(standard, methodology)`.

## Ranh giới của người review

- **KHÔNG** `supabase db push`, **KHÔNG** `apply_migration`, **KHÔNG** chạm project Supabase thật.
- **KHÔNG** `npm run test:e2e` (chạy trên DB thật — `vitest.e2e.config.ts:5-12`).
- Chỉ đọc `supabase/migrations/**` và `docs/design/schema-project-platform.md`; không sửa.
- Ghi kết quả review vào file riêng, không ghi đè file này.

## Chuẩn bị một lượt review

```bash
cd /Users/phamduythai/CR
export F13=supabase/migrations/0013_project_platform.sql
export F14=supabase/migrations/0014_project_platform_samples.sql
export DOC=docs/design/schema-project-platform.md
export NEW="$F13 $F14"          # mọi migration mới, thêm vào nếu có tệp khác
```

**Lệnh an toàn** (chỉ đọc, không chạm DB): mọi `grep`/`sed`/`awk` trên tệp; `npm run types`;
`npm run test`; `npm run build`.
**Lệnh cấm**: bất cứ thứ gì kết nối `NEXT_PUBLIC_SUPABASE_URL` hoặc gọi MCP Supabase ghi.

> **Cảnh báo chung cho mọi lệnh `grep` bên dưới.** Migration hiện có sinh policy bằng vòng
> lặp `do $$ ... execute format(...)` (`supabase/migrations/0003_rls.sql:88-108`). Nếu
> thiết kế mới cũng làm vậy, **grep tĩnh sẽ đếm thiếu**: phải đọc mảng tên bảng trong vòng
> lặp rồi nhân ra. Luôn chạy `grep -n 'do \$\$' $NEW` trước tiên; có kết quả thì mọi phép
> đếm bên dưới phải làm thủ công.

## Mục lục & mức độ

| Nhóm | Mã | Nội dung | Mức |
|---|---|---|---|
| A. Bảo mật & RLS | C1 | Fail-closed RLS, đủ 4 thao tác | **P0** |
| | C2 | Quyền hàm: `security definer` + `search_path` + revoke/grant | **P0** |
| | C3 | Policy đệ quy trên bảng thành viên | **P0** |
| | C4 | `app.bypass_profile_guard` không bị RPC mới lạm dụng | **P0** |
| | C5 | Rò/thiếu danh tính thành viên qua `profiles_select` | P1 |
| B. Bẫy migration | C6 | Enum: `add value` và chỗ dùng phải khác tệp | **P0** |
| | C7 | `handle_new_user` — danh sách trắng vai trò | **P0** |
| | C8 | Dựng lại DB từ đầu vẫn chạy; không sửa migration đã áp | P1 |
| | C9 | `src/types/database.ts` phải sinh lại | P1 |
| C. Không phá phần giữ | C10 | Không `DROP`/`ALTER` lên phần được giữ | **P0** |
| | C11 | Không làm gãy chatbot | **P0** |
| | C12 | Không phá build TypeScript | P1 |
| | C13 | Đính kèm tệp: bucket & policy | P1 |
| D. Đúng thiết kế & phạm vi | C14 | Trung thành `PLAN.md`, không dùng tên spec đã thay thế | **P0** |
| | C15 | Đúng phạm vi bước 1→7 và 12→14 | P1 |
| | C16 | `metric_schema` thật sự tổng quát, không nhúng mã | P1 |
| | C17 | Seed methodology ghi rõ là MẪU chưa thẩm định | P1 |
| E. Toàn vẹn dữ liệu | C18 | Cách ly giữa các dự án (FK kép) | **P0** |
| | C19 | Nguyên tử & khoá | P1 |
| | C20 | Snapshot/version báo cáo MRV | P1 |
| | C21 | Hành vi xoá có chủ ý | P1 |
| | C22 | Index cho đường nóng RLS | P2 |

Quy ước mức độ: **P0** = chặn merge; **P1** = phải sửa trước khi viết Module A/B;
**P2** = ghi nhận, sửa được sau.

---

## A. Bảo mật & RLS

### C1 — Fail-closed RLS: mọi bảng mới bật RLS và có policy tường minh cho đủ 4 thao tác — **P0**

**Kiểm cái gì.** Bảng bật RLS mà thiếu policy thì **vô hình với tất cả**, kể cả chủ dữ
liệu — đây là mặc định fail-closed của Postgres (đã ghi ở `docs/audit/audit-keep.md` §4,
ràng buộc 1). Ngược lại, bảng **quên** bật RLS thì mở toang cho mọi tài khoản
`authenticated`. Phải kiểm cả hai chiều, và kiểm đủ `SELECT/INSERT/UPDATE/DELETE` chứ
không chỉ `SELECT` — khuôn hiện có sinh đủ bốn (`0003_rls.sql:96-106`).

**Kiểm bằng cách nào.**

```bash
# 1. Bảng mới khai báo
grep -ohiE '^create table (if not exists )?[a-z_.]+' $NEW \
  | awk '{print tolower($NF)}' | sed 's/^public\.//' | sort -u > /tmp/rv_tables

# 2. Bảng đã bật RLS
grep -ohiE 'alter table [a-z_.]+ enable row level security' $NEW \
  | awk '{print tolower($3)}' | sed 's/^public\.//' | sort -u > /tmp/rv_rls

# ⇒ phải RỖNG: bảng mới mà quên bật RLS
comm -23 /tmp/rv_tables /tmp/rv_rls

# 3. Liệt kê (bảng, thao tác) đã có policy
grep -ohiE 'create policy [a-z_]+ on [a-z_.]+ for (all|select|insert|update|delete)' $NEW \
  | awk '{print tolower($5), toupper($7)}' | sed 's/^public\.//' | sort -u
```

Đối chiếu bảng kết quả bước 3 với `/tmp/rv_tables`: mỗi bảng phải có `ALL`, hoặc có đủ
bốn dòng `SELECT/INSERT/UPDATE/DELETE`.

Kiểm thêm hai thứ grep không bắt được, phải đọc mắt:
- Policy `for all` dùng chung một biểu thức cho cả đọc và ghi — tiện nhưng thường quá
  rộng ở chiều ghi. Với bảng mà `viewer` chỉ được đọc, `for all` là dấu hiệu sai.
- Policy `insert` phải có `with check`; chỉ có `using` là vô nghĩa với `INSERT`.

**FAIL trông ra sao.**
- `comm -23` in ra tên bảng ⇒ **P0, chặn merge**: bảng đó không có RLS.
- Có bảng bật RLS nhưng vắng mặt hoàn toàn ở bước 3 ⇒ bảng vô hình; triệu chứng lúc chạy
  là truy vấn trả `[]` và `insert` báo `new row violates row-level security policy`.
- Có `SELECT` nhưng thiếu `DELETE` ⇒ không ai xoá được, kể cả `owner` — mà `PLAN.md` §5
  ghi rõ Project Owner có quyền "xoá project".
- Policy `insert` chỉ có `using` ⇒ Postgres báo lỗi ngay lúc chạy migration.

---

### C2 — Quyền hàm: `security definer` + `set search_path = public` + revoke/grant — **P0**

**Kiểm cái gì.** Mọi hàm trợ giúp RLS mới phải theo đúng khuôn đã dùng trong repo:
`security definer`, `set search_path = public`, thu quyền khỏi `public` và `anon`, cấp
lại cho `authenticated`. Khuôn mẫu: `0003_rls.sql:6-19` (khai báo) và
`0007_harden.sql:63-78` (revoke/grant). **Thiếu `set search_path` là lỗ hổng leo thang
quyền**: hàm `security definer` chạy bằng quyền chủ sở hữu, người gọi đặt được
`search_path` trỏ vào schema của mình thì chiếm được luồng thực thi. Đây chính là thứ
`0007_harden.sql:3-4` được viết ra để vá.

**Kiểm bằng cách nào.**

```bash
# Đọc cụm quanh mỗi khai báo hàm — bắt buộc đọc mắt, không chỉ đếm
grep -niE -A 4 '^create( or replace)? function' $NEW

# Đếm nhanh ba thuộc tính
grep -ciE '^create( or replace)? function' $NEW   # số hàm
grep -ci 'security definer'                 $NEW
grep -ci 'set search_path *= *public'       $NEW

# Khuôn revoke/grant
grep -niE 'revoke .* on function|grant execute on function' $NEW
```

Ba con số ở lệnh đếm phải **bằng nhau** (trừ khi có hàm cố ý để `security invoker` — phải
có bình luận giải thích tại chỗ). Mỗi hàm mới phải xuất hiện đúng hai lần trong lệnh
`revoke/grant`: một `revoke ... from public, anon` và một `grant execute ... to authenticated`.

**FAIL trông ra sao.**
- Số hàm > số `set search_path` ⇒ **P0**. Nêu đích danh tên hàm thiếu.
- Chỉ `revoke ... from anon` mà không có `from public` ⇒ vẫn gọi được, vì Postgres mặc
  định cấp `EXECUTE` cho `PUBLIC` — đúng cái bẫy đã ghi ở `0007_harden.sql:54-56`.
- Hàm trigger mà lại `grant execute to authenticated` ⇒ thừa quyền; khuôn đúng là thu hết
  (`0007_harden.sql:32-35`), vì quyền trigger được kiểm lúc tạo trigger chứ không lúc chạy.

---

### C3 — Policy đệ quy trên bảng thành viên dự án — **P0**

**Kiểm cái gì.** Policy trên bảng thành viên (`project_members` hay tên tương đương) mà
tự truy vấn chính bảng đó sẽ gây **đệ quy vô hạn**. Repo đã gặp và đã giải: ba hàm trợ
giúp ở `0003_rls.sql:6-19` được viết `security definer` **chính vì lý do này** — bình
luận ở `0003_rls.sql:4-5` nói thẳng "tránh đệ quy khi policy của bảng profiles lại phải
đọc chính bảng profiles". Thiết kế mới phải lặp lại đúng thủ pháp đó.

**Kiểm bằng cách nào.**

```bash
# Tên bảng thành viên thực tế trong thiết kế (điều chỉnh nếu khác)
export MT=project_members

# In toàn văn từng policy trên bảng thành viên
sed -n "/create policy .* on $MT/,/;/p" $NEW

# Trong phần thân (bỏ dòng tiêu đề "on <bảng>"), có nhắc lại chính tên bảng không?
sed -n "/create policy .* on $MT/,/;/p" $NEW | grep -vE "on +$MT" | grep -n "$MT"
```

Lệnh cuối phải **RỖNG**. Nếu có kết quả, đọc tiếp: tham chiếu đó phải nằm **bên trong một
hàm `security definer`** chứ không phải viết thẳng trong `using`/`with check`. Kiểm chéo:
tên hàm được gọi trong policy có xuất hiện ở danh sách `security definer` của C2 không.

**FAIL trông ra sao.**
- Lệnh cuối in ra dòng có `exists (select 1 from project_members ...)` nằm trong
  `using(...)` của chính policy trên `project_members` ⇒ **P0, chặn merge**.
- Triệu chứng lúc chạy (không thấy được bằng đọc tĩnh nếu quan hệ vòng đi qua 2–3 bảng):
  Postgres trả `infinite recursion detected in policy for relation "project_members"`,
  hoặc `stack depth limit exceeded` (SQLSTATE `54001`). Nếu review chỉ đọc tĩnh thì phải
  **vẽ đồ thị phụ thuộc**: policy bảng X đọc bảng Y, policy bảng Y đọc bảng X ⇒ vòng.
- Vòng gián tiếp cũng FAIL: policy trên `projects` đọc `project_members`, mà policy trên
  `project_members` lại đọc `projects`.

---

### C4 — `app.bypass_profile_guard` không bị RPC mới lạm dụng — **P0**

**Kiểm cái gì.** Trigger `guard_profile_escalation` (bản hiện hành
`0005_business_rpc.sql:8-20`) chặn người dùng tự đổi `role`/`cooperative_id`, **trừ khi**
là admin hoặc biến cấu hình `app.bypass_profile_guard` đang bật
(`0005_business_rpc.sql:11`). Ba hàm onboarding cố ý bật cờ này
(`0005:47`, `0005:68`, `0009_coop_two_tier.sql:29`). Đây là rủi ro **R12** trong audit:
bất kỳ RPC `security definer` mới nào đặt cờ này rồi `update profiles` đều là **đường tự
cấp `platform_admin`**.

**Kiểm bằng cách nào.**

```bash
# Migration mới có đụng tới cờ này không?
grep -n 'bypass_profile_guard' $NEW

# Có RPC mới nào ghi vào profiles không?
grep -niE -B 20 'update +(public\.)?profiles' $NEW | grep -iE 'create( or replace)? function|update +(public\.)?profiles|set_config'
```

Lệnh 1 lý tưởng là **RỖNG** — thiết kế dự án không có lý do gì phải đổi `profiles.role`.
Nếu có kết quả, mỗi chỗ phải trả lời được: (a) hàm này ai gọi được (kiểm `grant` ở C2),
(b) nó có kiểm `auth.uid()` ngay đầu không, (c) nó có ràng buộc giá trị `role` ghi vào
trong một danh sách trắng cứng không, (d) có bình luận giải thích vì sao cần vượt trigger.

**FAIL trông ra sao.**
- Có `set_config('app.bypass_profile_guard', 'on', true)` trong một hàm mà tham số
  `role`/`p_role` **đến từ người gọi** ⇒ **P0**: người dùng truyền `platform_admin` là
  xong. So sánh với khuôn đúng ở `0009_coop_two_tier.sql:30` — vai trò được **gán cứng**
  `role = 'coop_manager'`, không lấy từ tham số.
- Hàm mới ghi `profiles` nhưng **không** kiểm `auth.uid() is null` ở đầu (khuôn:
  `0005:60`, `0009:15`) ⇒ P0.
- Cấp `execute` cho `anon` ⇒ P0.
- Vô hại nhưng phải nêu: cờ này có phạm vi transaction (`set_config(..., true)`), nên một
  hàm bật cờ rồi gọi tiếp hàm khác trong cùng transaction thì hàm sau cũng được vượt
  trigger — đọc kỹ chuỗi gọi lồng nhau, không chỉ từng hàm riêng lẻ.

---

### C5 — Danh tính thành viên: `profiles_select` có đủ, và có rò không — P1

**Kiểm cái gì.** Màn hình dự án chắc chắn phải hiện tên người: danh sách thành viên,
assignee của task, người bình luận. Nhưng policy đọc `profiles` hiện tại
(`0003_rls.sql:59-60`) chỉ cho thấy: **chính mình**, hoặc **admin**, hoặc **người cùng
`cooperative_id`**. Một Project Owner và một Project Developer thuộc hai hợp tác xã khác
nhau (hoặc chưa thuộc hợp tác xã nào — `profiles.cooperative_id` cho phép `null`,
`0001_core_schema.sql:45`) thì **không đọc được tên nhau**. Đây là rủi ro **R6** trong
audit ở dạng cụ thể: fail-closed nên an toàn, nhưng giao diện sẽ hiện danh sách thành
viên trống trơn mà không báo lỗi gì.

Chiều ngược lại cũng phải kiểm: nới `profiles_select` quá tay ⇒ rò danh bạ toàn nền tảng.

**Kiểm bằng cách nào.**

```bash
# Thiết kế có đụng policy profiles không?
grep -niE 'policy .* on +(public\.)?profiles|drop policy .*profiles' $NEW

# Có bảng/khung nhìn nào phơi tên người ra ngoài phạm vi hợp tác xã không?
grep -niE 'full_name|create view|create materialized view' $NEW
```

Đọc `docs/design/schema-project-platform.md` tìm phần nói về hiển thị thành viên. Thiết kế
đạt phải làm **một** trong hai: (a) nới `profiles_select` thêm đúng một vế "cùng dự án",
đi qua hàm `security definer` để tránh đệ quy (xem C3); hoặc (b) tự lưu tên hiển thị
trong bảng thành viên dự án và không đụng `profiles`.

**FAIL trông ra sao.**
- Thiết kế **không nhắc gì** tới `profiles_select` ⇒ P1: danh sách thành viên sẽ trống,
  assignee hiện `—`. Lỗi im lặng, chỉ lộ ra khi dựng giao diện Module A.
- Nới thành `using (true)` hoặc bỏ hẳn policy ⇒ **nâng lên P0**: mọi tài khoản đọc được
  họ tên, số điện thoại, tên công ty của toàn bộ người dùng (`profiles` có cả `phone`,
  `0001_core_schema.sql:43`).
- Sao chép `full_name` sang bảng mới mà không nói rõ đây là bản chụp ⇒ P1: hai nguồn sự
  thật, đổi tên ở `profiles` không lan sang.

---

## B. Bẫy migration PostgreSQL

### C6 — Enum: `alter type ... add value` và chỗ SỬ DỤNG phải nằm ở hai tệp khác nhau — **P0**

**Kiểm cái gì.** Nếu thiết kế thêm giá trị vào enum **đang có** (`user_role` là trường hợp
duy nhất đáng lo — `0001_core_schema.sql:6`), thì `alter type ... add value` và mọi chỗ
**dùng** giá trị mới phải ở **hai tệp migration khác nhau**. Migration Supabase chạy trong
một transaction; Postgres không cho dùng giá trị enum vừa thêm trong chính transaction đã
thêm nó (trừ khi enum cũng được tạo trong transaction đó).

Lưu ý phạm vi: ràng buộc này **chỉ áp cho enum đã tồn tại từ trước**. Enum **mới toanh**
(`project_role`, `task_status`, …) tạo và dùng ngay trong cùng tệp thì **hoàn toàn hợp lệ**
— đừng báo FAIL nhầm chỗ này.

**Kiểm bằng cách nào.**

```bash
# Có thêm giá trị vào enum cũ không?
grep -rniE 'alter type +[a-z_]+ +add value' supabase/migrations/

# Enum nào được TẠO MỚI trong đợt này (những enum này được miễn trừ)
grep -niE '^create type +[a-z_]+ +as enum' $NEW
```

Với mỗi giá trị được `add value`, tìm mọi chỗ dùng nó và so tên tệp:

```bash
# ví dụ, thay bằng giá trị thật mà thiết kế thêm vào
for v in project_owner project_developer viewer; do
  echo "── $v"; grep -rn "'$v'" supabase/migrations/ | cut -d: -f1 | sort -u
done
```

Với mỗi giá trị: tệp chứa `add value` **không được** xuất hiện trong danh sách tệp có dùng
`'<giá trị>'` (ngoài chính dòng `add value`).

**FAIL trông ra sao.**
- Cùng một tệp vừa `alter type user_role add value 'project_owner'` vừa có
  `... = 'project_owner'` trong policy/hàm/seed ⇒ **P0**. Triệu chứng khi áp thật:
  `ERROR: unsafe use of new value "project_owner" of enum type user_role`
  (SQLSTATE `55P04`), migration chết giữa chừng.
- `add value` không có `if not exists` ⇒ chạy lại migration lần hai là lỗi (liên quan C8).
- Cách né sạch bẫy này, và là thiết kế được ưu tiên: **không đụng `user_role` chút nào**,
  mà tạo enum mới `project_role` cho trục vai trò theo dự án — đúng kết luận §3 của audit
  ("giữ `user_role` làm trục nền tảng, thêm trục thứ hai theo dự án"). Nếu thiết kế làm
  vậy thì C6 tự động PASS và **C7 cũng không còn rủi ro** — ghi rõ điều đó vào kết quả
  review vì nó gỡ hai mục P0 cùng lúc.

---

### C7 — `handle_new_user`: danh sách trắng vai trò — **P0, mục quan trọng nhất**

**Kiểm cái gì.** `handle_new_user` (bản hiện hành `0012_signup_role_guard.sql:27-50`)
ánh xạ vai trò người dùng khai lúc đăng ký qua một **danh sách trắng cứng**
(`0012:33-38`): chỉ `coop_manager`, `coop_staff`, `buyer` được nhận; **mọi giá trị khác bị
âm thầm hạ về `coop_staff`**, cố ý không báo lỗi (lý do ghi ở `0012:19-22`).

Hệ quả nếu thiết kế thêm vai trò vào `user_role` mà quên sửa hàm này: **mọi tài khoản đăng
ký mới đều thành `coop_staff`**. Không exception, không log, không dòng đỏ nào trong test.
Người dùng đăng ký làm Project Owner, đăng nhập được, và thấy một hệ thống trống rỗng.
Đây là điểm gãy khó phát hiện nhất trong toàn bộ phần auth (rủi ro **R5** của audit).

**Kiểm bằng cách nào.**

```bash
# Bước 1 — thiết kế có thêm vai trò vào user_role không?
grep -rn 'alter type user_role' supabase/migrations/
```

Nếu **RỖNG** ⇒ C7 PASS, ghi rõ "không đụng `user_role`" rồi sang mục khác.

Nếu **có**, bắt buộc làm tiếp cả ba bước:

```bash
# Bước 2 — hàm có được viết lại không?
grep -rn 'handle_new_user' supabase/migrations/ | grep -v '^supabase/migrations/000'

# Bước 3 — danh sách trắng mới gồm những gì?
grep -niE -A 14 'create or replace function handle_new_user' $NEW

# Bước 4 — đối chiếu: mọi giá trị vừa add value phải có mặt trong nhánh `when` của hàm
```

Kiểm thêm hai thứ đi kèm, vì chúng cùng một chuỗi và hỏng cùng lúc:
- `src/app/auth-actions.ts:42-47` — server action chặn vai trò ở tầng Next.js.
- `src/app/dang-ky/form.tsx:14-16` — ô chọn vai trò lúc đăng ký.

**FAIL trông ra sao.**
- `alter type user_role add value` có, nhưng `handle_new_user` **không** được
  `create or replace` trong đợt này ⇒ **P0, chặn merge**. Đây là FAIL im lặng: migration
  chạy trơn tru, test xanh, và sai sót chỉ lộ ra khi có người thật đăng ký.
- Hàm được viết lại nhưng nhánh `case` thiếu một trong các vai trò mới ⇒ P0 cho đúng vai
  trò đó.
- Hàm được viết lại nhưng bỏ mất `security definer` hoặc `set search_path = public`
  (`0012:28`) ⇒ P0, xem C2.
- Hàm được viết lại nhưng thiếu `revoke all on function public.handle_new_user() from
  public, anon, authenticated` ở cuối (`0012:52`) ⇒ P0: `create or replace` **đặt lại
  quyền mặc định**, nghĩa là `PUBLIC` lại gọi được hàm. Đây là bẫy phụ rất dễ sót.
- Thiết kế sửa hàm nhưng **không** sửa `dang-ky/form.tsx` và `auth-actions.ts` ⇒ P1: người
  dùng không có cách nào chọn vai trò mới, mọi người vẫn đăng ký thành vai trò cũ.

---

### C8 — Dựng lại DB từ đầu vẫn chạy; không sửa migration đã áp — P1

**Kiểm cái gì.** 14 bản migration đã áp lên project thật (`0001`→`0012`, xem
`docs/audit/audit-keep.md` §4). Sửa một tệp đã áp thì DB thật không đổi, nhưng người khác
dựng lại DB từ đầu sẽ ra một lược đồ **khác** — hai môi trường lệch nhau âm thầm. Ngoài
ra `0007_harden.sql:45-52,66-72` cấp/thu quyền theo **đúng chữ ký hàm**; đổi chữ ký một
hàm cũ làm lần dựng lại thất bại.

**Kiểm bằng cách nào.**

```bash
# Có tệp migration cũ nào bị sửa trong đợt này không? ⇒ phải RỖNG
git status --porcelain supabase/migrations/ | grep -vE '001[34]_'
git diff --stat HEAD -- supabase/migrations/ | grep -vE '001[34]_'

# Thiết kế có drop/thay hàm cũ mà 0007 đang grant không?
grep -niE 'drop function|create or replace function' $NEW \
  | grep -iE 'app_coop_id|app_user_role|app_is_admin|handle_new_user|guard_profile|sync_field_area|create_cooperative_and_join|join_cooperative_by_code|build_credit_batch|unlock_field_season|save_field|check_field_overlap'

# Tính chạy-lại-được
grep -ciE 'if not exists|or replace' $NEW
```

**FAIL trông ra sao.**
- `git status` in ra tệp `0001`–`0012` bị sửa ⇒ P1 (nâng lên **P0** nếu tệp đó đã áp lên
  DB thật — cả 12 tệp đều đã áp).
- Có `drop function` lên một hàm mà `0007_harden.sql` còn `grant`, và không có
  `create ... ` thay thế cùng chữ ký ⇒ P1: lần dựng lại từ đầu sẽ chết ở `0007`… thực ra
  không, vì `0007` chạy **trước**; nhưng lược đồ cuối cùng sẽ thiếu hàm mà mã ứng dụng còn
  gọi. Kiểm chéo bằng `grep -rn '<tên hàm>' src/`.
- Migration mới tạo lại một đối tượng đã có mà không `if not exists`/`or replace` ⇒ P2:
  chỉ đau khi chạy lại, không đau lần đầu.

---

### C9 — `src/types/database.ts` phải được sinh lại — P1

**Kiểm cái gì.** `src/types/database.ts` (2260 dòng) là tệp **sinh ra từ DB thật**, không
viết tay. Mọi mã ứng dụng đi qua `SupabaseClient<Database>` nên bảng mới không có trong
tệp này thì **không truy vấn được mà không ép kiểu**. Vì bước 2 không được áp migration
lên DB thật, tệp này **chưa thể** cập nhật ở bước 2 — điều cần kiểm là thiết kế có **nêu
rõ** đây là việc bắt buộc của bước 3 hay không.

**Kiểm bằng cách nào.**

```bash
# Tệp types có thay đổi trong đợt này không? (ở bước 2 thì KHÔNG nên có)
git status --porcelain src/types/database.ts

# Thiết kế có nhắc việc sinh lại types không?
grep -niE 'database\.ts|gen types|generate.*type' $DOC

# Bảng mới đã có mặt trong types chưa? (kỳ vọng: CHƯA)
grep -c 'projects\|stages\|monitoring_periods' src/types/database.ts
```

**FAIL trông ra sao.**
- `src/types/database.ts` **bị sửa tay** trong đợt này ⇒ P1: tệp sinh tự động mà sửa tay
  thì lần `supabase gen types` sau sẽ ghi đè, mất thay đổi.
- Thiết kế không nhắc gì tới việc sinh lại types ⇒ P1: bàn giao thiếu, người làm bước 3 sẽ
  vấp ngay dòng đầu tiên. Ghi vào kết quả review như một việc phải làm kèm, không phải lỗi
  của lược đồ.

---

## C. Không phá phần được giữ lại

### C10 — Không `DROP`/`ALTER` lên phần được giữ — **P0**

**Kiểm cái gì.** `PLAN.md` §1 giữ landing page, chatbot, auth. Danh sách đối tượng DB
**bất khả xâm phạm** trong đợt này:

| Đối tượng | Vì sao | Nguồn |
|---|---|---|
| `profiles` | Gốc của toàn bộ auth; bảng chat trỏ FK vào | `0001:40-48` |
| `cooperatives` | Khoá phân vùng của mọi RLS hiện có; chat trỏ FK vào | `0001:28-38` |
| `chat_conversations`, `chat_messages`, `chat_settings` | Bảng của chatbot | `0010`, `0011` |
| `emission_factors` | Công cụ `tra_cuu_he_so` của trợ lý đọc | `0002:9-19`, `handlers.ts:92` |
| trigger `on_auth_user_created` | Không có nó thì tài khoản mới không có hồ sơ | `0001:68-70` |
| bucket `evidence` + 3 policy storage | Ảnh bằng chứng đã có | `0004:54-71` |
| `app_user_role()`, `app_coop_id()`, `app_is_admin()` | Mọi policy hiện có gọi | `0003:6-19` |

Thêm một ràng buộc chiều ngược: **không tạo FK từ bảng chat/auth trỏ sang bảng mới**. Bảng
chat phải sống độc lập; buộc nó vào lược đồ dự án là biến chatbot thành thứ không gỡ ra
được, trái với "giữ nguyên chatbot".

**Kiểm bằng cách nào.**

```bash
# Mọi lệnh phá huỷ trong đợt này
grep -niE '^ *(drop|alter) +(table|type|function|trigger|policy|view)' $NEW

# Có chạm 7 nhóm đối tượng cấm không? ⇒ đọc từng dòng, không chỉ đếm
grep -niE 'profiles|cooperatives|chat_|emission_factors|on_auth_user_created|storage\.|evidence|app_coop_id|app_user_role|app_is_admin' $NEW

# FK ngược từ bảng chat sang bảng mới ⇒ phải RỖNG
grep -niE 'alter table +(public\.)?chat_' $NEW
```

Không phải mọi kết quả đều là FAIL — `alter table field_seasons add column ...` để nối vào
dự án là hợp lệ và cần thiết. Phân loại từng dòng thành: (a) thêm cột/index/FK vào bảng
cũ = **được**, (b) thêm policy mới = **được**, (c) `drop`/đổi kiểu/đổi tên/`drop policy`
trên bảng cũ = **phải giải trình**, (d) chạm bảng chat = **cấm**.

**FAIL trông ra sao.**
- Bất kỳ `drop table` nào lên 7 nhóm trên ⇒ **P0, chặn merge**.
- `drop table cooperatives cascade` ⇒ P0 kép: `cascade` sẽ **xoá luôn cột
  `chat_conversations.cooperative_id`** (`0010_chat.sql:15`), tức âm thầm cắt bớt lược đồ
  chatbot. Đúng rủi ro **R8** của audit.
- `alter table chat_messages add ... references projects(...)` ⇒ P0: trói chatbot vào
  module mới.
- `drop policy` trên bảng cũ mà không tạo lại ⇒ P0: bảng đó thành vô hình (xem C1).
- `create or replace` lên `app_coop_id`/`app_is_admin` ⇒ P0 trừ khi có giải trình và giữ
  nguyên chữ ký + `security definer` + `search_path` (xem C2, C8).

---

### C11 — Không làm gãy chatbot — **P0**

**Kiểm cái gì.** Chatbot đọc 14 bảng nghiệp vụ qua 10 công cụ
(`docs/audit/audit-keep.md` §2). Có **hai** kiểu gãy, và kiểu nguy hiểm hơn là kiểu không
ai nghĩ tới:

1. **Gãy biên dịch** — `src/lib/chat/handlers.ts:4-6` import `@/lib/mrv/factors`,
   `@/lib/mrv/collect`, `@/lib/mrv/types`. Xoá `src/lib/mrv/**` ⇒ **cả `/api/chat` không
   build được** (rủi ro **R2**). Tương tự, `handlers.ts:7-13` import ba hằng nhãn từ
   `src/lib/labels.ts:75,84,92`, vốn là `Record` trên enum `batch_status`/`order_status`/
   `payment_status`; drop ba enum đó ⇒ `labels.ts` đỏ ⇒ `handlers.ts` đỏ (rủi ro **R3**).
2. **Gãy im lặng** — drop bảng mà giữ công cụ: `handlers.ts:66-68` ném lỗi,
   `api/chat/route.ts:118-120` **bắt lại** và trả `{ loi: ... }` cho model. Route không
   sập; trợ lý chỉ trả lời "không tra được" cho mọi câu hỏi liên quan.

**Kiểm bằng cách nào.**

```bash
# Đợt này có drop bảng nào mà chatbot đang đọc không?
grep -niE 'drop (table|type)' $NEW \
  | grep -iE 'emission_factors|emission_calculations|seasons|field_seasons|fields|farmers|straw_management|water_events|fertilizer_applications|credit_batches|batch_items|orders|payments|revenue_shares|batch_status|order_status|payment_status'

# Bảng nào bị đổi tên/đổi cột mà handlers đang select
grep -niE 'rename|alter column|drop column' $NEW

# Kiểm chứng dứt điểm, không chạm DB:
npm run types && npm run test
```

`npm run types` và `npm run test` là **hai lệnh quyết định** của mục này: chúng bắt trọn
kiểu gãy 1 mà không cần DB. Riêng kiểu gãy 2 thì **test không bắt được** — xem C-note dưới.

**FAIL trông ra sao.**
- `npm run types` đỏ ở `src/lib/labels.ts` hoặc `src/lib/chat/handlers.ts` ⇒ **P0**.
- Có `drop table orders/payments/revenue_shares/credit_batches` mà thiết kế **không** kèm
  kế hoạch sửa 4 công cụ (`liet_ke_lo_tin_chi`, `chia_doanh_thu`, `lo_dang_chao_ban`,
  `don_hang_cua_toi`) và `src/lib/chat/eval/fixture.ts` ⇒ P0. Nếu bước 2 cố ý **chưa**
  drop mà để lại bước sau, ghi PASS kèm ghi chú — hoãn là hợp lệ, quên mới là lỗi.
- **Bẫy của bẫy**: `tests/chat.test.ts:283-291` chỉ canh `TOOLS` ↔ `FIXTURE_RESULTS`, nó
  **không** canh `HANDLERS`. Sửa `handlers.ts` cho hỏng mà giữ nguyên `TOOLS` thì
  `npm run test` vẫn **xanh** (rủi ro **R11**). Không được lấy màu xanh làm bằng chứng cho
  kiểu gãy 2 — phải đọc mắt từng handler đối chiếu danh sách bảng bị drop.

---

### C12 — Không phá build TypeScript: liệt kê chính xác chỗ sẽ đỏ — P1

**Kiểm cái gì.** Nếu enum `user_role` đổi, các chỗ sau **chắc chắn** đỏ vì chúng là
`Record` phủ toàn enum hoặc `switch` theo giá trị. Thiết kế đạt phải **liệt kê đủ** danh
sách này như việc bàn giao cho bước 3 — thiếu là thiết kế chưa trọn (rủi ro **R4**).

| Vị trí | Vì sao đỏ / phải sửa |
|---|---|
| `src/lib/labels.ts:5-10` | `ROLE_LABEL: Record<Enums["user_role"], string>` — thiếu khoá ⇒ lỗi kiểu |
| `src/lib/auth.ts:42-46` | `homePathFor` trỏ `/cho`, `/quan-tri`, `/htx`, `/thiet-lap` — không đỏ nhưng **sai đích** |
| `src/lib/auth.ts:28-34` | `requireCoopProfile` ép mọi người phải có `cooperative_id` |
| `src/lib/chat/tools.ts:25-26,146,158,165,173` | mảng `roles` liệt kê vai trò theo tên ⇒ vai trò mới **không thấy công cụ nào** |
| `src/components/app-nav.tsx:6-32` | menu chọn theo `profile.role`, ba nhánh cứng |
| `src/app/dang-ky/form.tsx:14-16` | ô chọn vai trò lúc đăng ký |
| `src/app/auth-actions.ts:42-47` | kiểm vai trò hợp lệ ở server action |
| `src/middleware.ts:6` | `PROTECTED` liệt kê nhánh route cũ |
| `src/lib/chat/prompt.ts:88` | `ROLE_LABEL[ctx.role]` |

**Kiểm bằng cách nào.**

```bash
npm run types    # lệnh quyết định — không chạm DB
npm run test

# Thiết kế có bàn giao danh sách này không?
grep -niE 'labels\.ts|homePathFor|app-nav|auth-actions|middleware|ROLE_LABEL|tools\.ts' $DOC
```

**FAIL trông ra sao.**
- `npm run types` đỏ ⇒ P1 (nâng **P0** nếu lỗi nằm ở `src/app/page.tsx` — landing page
  công khai sập, rủi ro **R9**; nhắc lại: `page.tsx:3` gọi `getProfile`/`homePathFor` và
  `page.tsx:7` phụ thuộc enum `vn_region`/`season_type` qua `src/lib/region.ts:1-4`).
- Thiết kế đổi enum nhưng phần "việc tầng ứng dụng phải làm kèm" trống hoặc chỉ nói chung
  chung ("cập nhật giao diện") ⇒ P1: bàn giao không kiểm chứng được.
- Nếu thiết kế **không** đụng `user_role` (khuyến nghị ở C6) ⇒ C12 chỉ còn phần
  `homePathFor`/`PROTECTED`/`app-nav` cần thêm nhánh cho route dự án mới; hạ xuống P2.

---

### C13 — Đính kèm tệp: bucket và policy — P1

**Kiểm cái gì.** `PLAN.md` §2 yêu cầu `Task.attachments[]`, §3 bước 2 và bước 7 yêu cầu
upload báo cáo khả thi và PDD. Bucket `evidence` hiện có phân vùng theo **thư mục đầu tiên
= `cooperative_id`** (`0004_functions_storage_factors.sql:61-71`). Với tệp thuộc **dự án**
(không thuộc hợp tác xã nào), khuôn đó **không dùng lại được**: một Project Developer
không có `cooperative_id` phù hợp sẽ bị chặn, hoặc tệ hơn, thiết kế mở rộng policy
`evidence` quá tay và làm rò ảnh bằng chứng đang có.

**Kiểm bằng cách nào.**

```bash
# Có bucket mới không, và có đụng bucket cũ không?
grep -niE 'storage\.buckets|storage\.objects|bucket_id|foldername' $NEW

# Thiết kế nói gì về đính kèm
grep -niE 'attachment|đính kèm|upload|bucket|storage' $DOC
```

Thiết kế đạt phải làm rõ: bucket nào, quy ước đường dẫn thư mục (nên là `project_id` làm
cấp đầu, đối xứng với khuôn `cooperative_id` hiện có), và policy đọc/ghi/xoá gắn vào tư
cách thành viên dự án qua hàm `security definer` (xem C2, C3).

**FAIL trông ra sao.**
- Bảng `attachments` có cột `storage_path` nhưng **không** có bucket hay policy nào được
  tạo ⇒ P1: cột trỏ vào hư không, upload sẽ bị storage từ chối.
- Sửa policy `evidence_read`/`evidence_write`/`evidence_delete` đang có ⇒ **P0** theo C10
  (đụng phần được giữ), trừ khi chỉ **thêm** policy mới cho bucket mới.
- Policy storage mới dùng `bucket_id = '...'` mà **không** kiểm `foldername` ⇒ P0: mọi
  người đăng nhập đọc được tệp của mọi dự án.
- Thiết kế lờ hẳn phần đính kèm ⇒ P1: `PLAN.md` §2 và §3 đòi, nên đây là thiếu phạm vi
  chứ không phải quyết định thu hẹp có chủ ý (xem C15).

---

## D. Đúng thiết kế & đúng phạm vi

### C14 — Trung thành `PLAN.md`, không dùng tên của spec đã bị thay thế — **P0**

**Kiểm cái gì.** Quyết định đã chốt: `PLAN.md` thắng,
`docs/superpowers/specs/2026-09-05-project-layer-design.md` **bị thay thế**. Hai tài liệu
chồng lấn nhưng khác nhau, và đây chính là rủi ro **R1** của audit. Dấu hiệu nhận biết
thiết kế đi nhầm đường — lấy nguyên văn từ spec cũ:

| Của spec đã bị thay thế (SAI) | Của `PLAN.md` (ĐÚNG) |
|---|---|
| `organizations`, `project_cooperatives` | không có trong `PLAN.md` §2 |
| `monitoring_periods` **có** | `MonitoringPeriod` — **giữ**, tên này trùng nhau |
| vai trò `project_developer \| mrv_officer \| htx_manager` | `owner \| developer \| viewer` |
| HTX ↔ dự án M:N | `PLAN.md` §2 không có HTX trong entity model |
| `crediting_program`, `methodology_code` (cột phẳng) | `Standard` và `Methodology` là **bảng riêng** |
| `project_status` 12 giá trị (có `vvb_verification`) | `PLAN.md` §3 chỉ 7 stage |

Thực thể `PLAN.md` §2 đòi: `Standard`, `Methodology` (+ `metric_schema[]`), `Project`,
`Stage` (1..7, có thứ tự), `Task` (status `todo|in_progress|done|blocked`, assignee,
attachments, comments), `Member` (`owner|developer|viewer`), `MonitoringPeriod`,
`MonitoringData`, `MRVReport`.

**Kiểm bằng cách nào.**

```bash
# Dấu vết của spec đã bị thay thế ⇒ phải RỖNG (hoặc giải trình được)
grep -niE 'organizations|project_cooperatives|mrv_officer|htx_manager|crediting_program|vvb' $NEW $DOC

# Vai trò dự án phải đúng ba giá trị
grep -niE "as enum.*owner|'owner'|'developer'|'viewer'" $NEW

# Đủ 9 thực thể của PLAN.md §2 chưa?
grep -ohiE '^create table (if not exists )?[a-z_.]+' $NEW | awk '{print $NF}' | sort -u
```

Đối chiếu danh sách bảng in ra với 9 thực thể trên. Thiếu bảng nào thì hỏi: cố ý hoãn (ghi
rõ trong `$DOC`) hay bỏ sót?

**FAIL trông ra sao.**
- Có bảng `organizations` hoặc `project_cooperatives` ⇒ **P0**: thiết kế bám spec đã bị
  thay thế. Không phải lỗi kỹ thuật, là lỗi **sai đề bài** — chi phí sửa về sau rất lớn vì
  mọi FK và policy đều treo trên tên bảng.
- Vai trò là `project_developer`/`mrv_officer`/`htx_manager` ⇒ **P0**, phải là
  `owner|developer|viewer`.
- `Standard`/`Methodology` bị làm phẳng thành cột `text` trên `projects` thay vì bảng
  riêng ⇒ P0: `PLAN.md` §2 đòi `Methodology` mang `metric_schema[]`, không nhét vào cột
  phẳng được, và §3 bước 3–4 đòi dropdown Methodology **lọc theo** Standard đã chọn.
- Thiếu `Stage` như một bảng có thứ tự ⇒ P1: `PLAN.md` §3 đòi kanban 7 cột.

---

### C15 — Đúng phạm vi: chỉ bước 1→7 và 12→14 — P1

**Kiểm cái gì.** `PLAN.md` §0 nói rõ bước **8–11** (stakeholder consultation, validation,
registration) và **15–17** (verification bởi VVB, standard review, issuance) **nằm ngoài
phạm vi** phiên bản đầu. Dựng bảng cho chúng ngay bây giờ là **vượt phạm vi**: mỗi bảng
thừa là thêm policy phải bảo trì, thêm bề mặt rò dữ liệu, và khoá cứng một thiết kế chưa
ai kiểm chứng nhu cầu.

**Kiểm bằng cách nào.**

```bash
grep -niE 'vvb|verifier|verification|validation|issuance|registry|registration|stakeholder|consultation|finding' $NEW $DOC
```

Phân biệt ba loại kết quả — chỉ loại (c) là FAIL:
(a) chỉ là **giá trị enum** dự phòng cho trạng thái dự án, có bình luận nói rõ chưa dùng
    ⇒ chấp nhận được, ghi P2;
(b) chỉ nhắc trong tài liệu ở phần "ngoài phạm vi" ⇒ đúng, PASS;
(c) có **bảng, cột, policy, hàm** thật cho VVB/validation/issuance ⇒ vượt phạm vi.

**FAIL trông ra sao.**
- Có bảng kiểu `vvb_findings`, `validation_reports`, `issuance_records` ⇒ P1, nêu tên và
  đề nghị gỡ khỏi đợt này.
- Vai trò `viewer` được mô tả là "dành cho VVB" ⇒ **không** FAIL: `PLAN.md` §5 nói đúng
  như vậy ("tuỳ chọn, mở rộng sau, dùng cho Verifier/VVB ở bước 15"). Giữ enum value là
  hợp lệ; dựng cả portal mới là không.
- Chiều ngược lại cũng là FAIL của mục này: **thiếu** Module B (bước 12→14 —
  `MonitoringPeriod`, `MonitoringData`, `MRVReport`) ⇒ P1, vì `PLAN.md` §0 yêu cầu xây
  **cả hai module cùng lúc**.

---

### C16 — `metric_schema` thật sự tổng quát, và không nhúng mã — P1

**Kiểm cái gì.** `PLAN.md` §2 gọi đây là "điểm mấu chốt kỹ thuật":
`Methodology.metric_schema` phải đủ linh hoạt để Module B **tự sinh** form nhập liệu và
bảng import cho rừng, biogas, năng lượng tái tạo… mà không hard-code theo từng loại dự án.
Rủi ro thực tế của repo này là ngầm bê nguyên mô hình lúa nước: repo hiện có
`water_regime`, `straw_method`, `preseason_water`, `organic_amendment`
(`0001_core_schema.sql:10-25`) — nếu chúng rò vào `metric_schema` thì tính tổng quát chỉ
là danh nghĩa.

Ràng buộc thứ hai, thuộc về an toàn: `metric_schema` là JSON do người dùng/seed nạp vào và
sẽ được ứng dụng diễn giải. **Không được có `eval`, JavaScript, hay SQL nhúng trong JSON.**
Công thức tính credit phải là dữ liệu có cấu trúc (cây biểu thức, hoặc mã công thức tra
trong bảng), không phải chuỗi đem đi thực thi.

**Kiểm bằng cách nào.**

```bash
# Ràng buộc kiểu/khoá của metric_schema
grep -niE -B 3 -A 12 'metric_schema' $NEW

# Có ràng buộc jsonb + kiểm hình dạng không?
grep -niE 'jsonb|json_typeof|pg_jsonschema|check *\(' $NEW | grep -i 'metric\|schema'

# Mùi hard-code lúa nước trong phần dùng chung
grep -niE 'water_regime|straw|preseason|rice|lua|thua_ruong|field_season' $NEW $DOC

# Mùi mã nhúng ⇒ phải RỖNG
grep -niE '"eval"|javascript|function *\(|=>|execute *\(|dynamic sql|format *\(' $DOC
grep -niE "'eval'|javascript" $NEW
```

Bài kiểm quyết định — **thử bằng tay hai methodology khác loại**: lấy đúng cấu trúc
`metric_schema` mà thiết kế đề xuất, viết thử schema cho (1) một methodology lúa nước
(AMS-III.AU hoặc tương đương) và (2) một methodology **không phải nông nghiệp** (ví dụ
biogas hộ gia đình hoặc cải thiện bếp đun). Nếu (2) phải thêm khái niệm mới không có trong
cấu trúc ⇒ chưa tổng quát.

**FAIL trông ra sao.**
- `metric_schema` là `jsonb` **không có ràng buộc hình dạng nào** và tài liệu cũng không
  đặc tả khoá bắt buộc ⇒ P1: sẽ thành bãi rác, mỗi methodology một hình dạng, Module B
  không sinh form được. Kỳ vọng tối thiểu: đặc tả rõ `key`, `label`, `unit`, `type`,
  `required`, `min`/`max`, và cách khai công thức.
- Có cột riêng cho khái niệm lúa nước (`water_regime`, `straw_*`) **trong bảng dùng
  chung** `methodologies`/`monitoring_data` ⇒ P1: đó là hard-code trá hình. Chúng phải nằm
  **bên trong** `metric_schema` của riêng methodology lúa nước.
- Công thức lưu dạng chuỗi kèm gợi ý "chạy bằng `eval`" hoặc `execute format(...)` trên
  chuỗi lấy từ bảng ⇒ **P0**: thực thi mã từ dữ liệu, mở đường SQL/JS injection.
- `MonitoringData` lưu mỗi bản ghi một cột cứng thay vì `(metric_key, value)` theo schema
  ⇒ P1: thêm methodology mới sẽ phải thêm cột, đúng thứ `PLAN.md` §2 muốn tránh.

---

### C17 — Seed methodology phải ghi rõ là MẪU chưa thẩm định — P1

**Kiểm cái gì.** Dữ liệu Standard/Methodology của Verra và Gold Standard trong
`0014_project_platform_samples.sql` là **do ta tự soạn**, không phải trích xuất từ tài liệu
chính thức. Đây là hệ thống phục vụ kiểm định tín chỉ carbon: một con số hoặc một mã
methodology trình bày như trích dẫn chính thức mà thực ra là bịa sẽ đi thẳng vào hồ sơ
phát hành. Repo đã có chuẩn hành xử đúng cho việc này: `emission_factors` có cột `source`
(`0002_mrv_and_market.sql:16`), và system prompt của trợ lý bắt buộc "khi nêu một hệ số,
kèm nguồn trích dẫn mà công cụ trả về" (`src/lib/chat/prompt.ts:65`).

**Kiểm bằng cách nào.**

```bash
# Seed có cột/ghi chú về nguồn và tình trạng thẩm định không?
grep -niE 'source|nguon|nguồn|reference|url|official|chính thức|mẫu|sample|placeholder|chưa thẩm định|unverified' $F14

# Bảng methodologies có chỗ để ghi nguồn không?
grep -niE -A 20 'create table (if not exists )?(public\.)?methodolog' $F13

# Đọc toàn bộ phần bình luận đầu tệp seed
sed -n '1,30p' $F14
```

**FAIL trông ra sao.**
- Seed chèn `('VM0007', 'Verra', ...)` kèm mô tả nghe như trích dẫn chuẩn, **không** có
  bình luận nói rõ đây là dữ liệu mẫu ⇒ P1. Kỳ vọng: khối bình luận ở đầu tệp và/hoặc cột
  `source`/`is_sample`/`status` ghi rõ.
- Có **con số** (hệ số, ngưỡng, công thức tính credit) trong seed mà không có nguồn ⇒
  **nâng lên P0**: đây là loại sai gây hậu quả ra ngoài phần mềm.
- Bảng `methodologies` **không có** cột nào để ghi nguồn/phiên bản tài liệu ⇒ P1: sau này
  không có chỗ đặt trích dẫn thật khi thay dữ liệu mẫu bằng dữ liệu thẩm định.
- Seed nằm chung tệp với `0013` ⇒ P2: nên tách để dựng DB sạch không kèm dữ liệu mẫu; ở
  đây đã tách sẵn nên chỉ cần xác nhận `0013` không chứa `insert` nghiệp vụ nào.
