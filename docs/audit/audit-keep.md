# Audit nửa A — phần GIỮ LẠI (landing page · chatbot · auth)

Ngày 06/9/2026. Bước 1 trong `PLAN.md` §6. **Chỉ đọc, không sửa mã.**
Phạm vi: landing page, chatbot, auth/role, hạ tầng chung.
Ngoài phạm vi (agent khác): `src/app/htx/**`, `cho/**`, `don-hang/**`, `quan-tri/**`,
`src/lib/mrv/**`, `src/lib/market/**`, `src/lib/gis/**` — chỉ đọc để lần phụ thuộc.

---

## 1. Landing page

### File thuộc landing page

| Đường dẫn | Vai trò |
|---|---|
| `src/app/page.tsx` (773 dòng) | Toàn bộ trang chủ `/`, server component |
| `src/app/layout.tsx:1-35` | Root layout: font Be Vietnam Pro, metadata `Agri-Carbon Pass` |
| `src/components/site-header.tsx` | Thanh nav dính, client component |
| `src/components/hero-carousel.tsx` | Băng chuyền hero (video + ảnh) |
| `src/components/lazy-video.tsx` | Nạp video khi lọt viewport |
| `src/app/globals.css:1-76` | Tailwind v4 `@theme`: bảng màu leaf/soil/forest/mint/carbon |
| `src/components/auth-layout.tsx` | Khung trang đăng nhập/đăng ký (dùng chung ảnh landing) |
| `public/anh/*.jpg` (10 tệp), `public/video/*.mp4` (3 tệp) | Ảnh/video của trang |
| `media-goc/*.mp4` (3 tệp) | Video gốc chưa cắt, **không** được phục vụ ra web |
| `src/app/icon0.svg`, `icon1.png`, `apple-icon.png` | Favicon |

Route công khai: `/` (landing), `/dang-nhap`, `/dang-ky`. `src/middleware.ts:6` không
liệt kê `/` nên trang chủ luôn công khai; thiếu biến môi trường Supabase thì trang công
khai vẫn dựng được (`src/middleware.ts:18-24`).

**Chatbot KHÔNG được gắn vào landing page** — widget chỉ nằm trong các layout đã đăng
nhập (xem §2).

### Phụ thuộc vào phần sắp bị thay — có, 4 chỗ

1. **`src/app/page.tsx:3`** → `getProfile, homePathFor` từ `@/lib/auth`.
   `homePathFor` (`src/lib/auth.ts:42-46`) trả về `/cho`, `/quan-tri`, `/htx`,
   `/thiet-lap` — **toàn bộ là route sắp bị thay**. Nút CTA chính của header
   (`site-header.tsx:93`, `:135`) trỏ vào đó.
2. **`src/app/page.tsx:7`** → `ACTIVE_REGION_FACTORS`, `IPCC_GLOBAL_DEFAULT` từ
   `@/lib/region`, mà `src/lib/region.ts:1-4` lấy kiểu từ enum `vn_region` và
   `season_type` trong `src/types/database.ts`. Xoá hai enum này ⇒ **lỗi biên dịch ở
   trang chủ**, không phải lỗi lúc chạy.
3. **Liên kết cứng tới chợ**: `page.tsx:344`, `:532`, `:562`, `:563` trỏ `/cho` và
   `/don-hang`. Gỡ marketplace ⇒ 404 ngay trên trang chủ.
4. **Nội dung**: toàn bộ văn bản, ảnh, video nói về lúa nước / hợp tác xã / bán tín chỉ
   (`page.tsx:9-40` các slide hero). Không phải phụ thuộc kỹ thuật, nhưng lệch hoàn toàn
   với sản phẩm quản lý dự án kiểu Jira. "Giữ nguyên landing page" về mặt mã là làm được;
   về mặt thông điệp thì sẽ mâu thuẫn với phần còn lại.

Ngoài 4 điểm trên, landing page **không** chạm bảng nghiệp vụ nào (không đọc `fields`,
`seasons`, `credit_batches`…). Con số hiển thị là hằng số trong `src/lib/region.ts:19-29`.

---

## 2. Chatbot

### File và route

**API**
- `src/app/api/chat/route.ts` — `POST /api/chat`, trả SSE, chạy bằng phiên đăng nhập.
- `src/app/api/eval/chat/route.ts` — `POST /api/eval/chat`, xác thực bằng
  `EVAL_API_TOKEN` (`:46-56`), chạy trên **dữ liệu mẫu**, không chạm DB thật (`:98-103`).

**Thư viện** — `src/lib/chat/`: `config.ts`, `guards.ts`, `handlers.ts` (470 dòng, nơi
truy vấn DB), `knowledge.ts`, `prompt.ts`, `provider.ts`, `run.ts`, `settings.ts`,
`tools.ts`, `providers/gemini.ts`, `providers/registry.ts`, `eval/fixture.ts` (349 dòng),
`eval/trajectory.ts`.

**Giao diện** — `src/components/chat/chat-panel.tsx`, `chat-widget.tsx`.

**Điểm gắn widget (tất cả đều nằm trong module sắp bị thay):**
`src/app/htx/layout.tsx:19`, `src/app/cho/layout.tsx:17`,
`src/app/don-hang/layout.tsx:11`, `src/app/quan-tri/page.tsx:94`.
**Trang riêng:** `src/app/htx/tro-ly/page.tsx`. **Cấu hình:** `src/app/quan-tri/tro-ly/`
(`page.tsx`, `form.tsx`, `actions.ts`).

**Migration:** `supabase/migrations/0010_chat.sql`, `0011_chat_settings.sql`.

**Kiểm thử:** `tests/chat.test.ts` (khoảng 40 ca).

### Chatbot đọc dữ liệu từ bảng nào

Bảng của riêng nó — `0010_chat.sql`, `0011_chat_settings.sql`:

| Bảng | Dùng ở | Khoá ngoại ra ngoài |
|---|---|---|
| `chat_conversations` | `api/chat/route.ts:49,58`; `htx/tro-ly/page.tsx:19` | `user_id → profiles`, `cooperative_id → cooperatives` (`0010_chat.sql:12,15`) |
| `chat_messages` | `api/chat/route.ts:72,80,161` | `conversation_id`, `user_id → profiles` (`0010_chat.sql:25-26`) |
| `chat_settings` | `lib/chat/settings.ts:90,106`; `quan-tri/tro-ly/actions.ts:55` | `updated_by → profiles` (`0011_chat_settings.sql:16`) |

Bảng nghiệp vụ mà 10 công cụ đọc (`src/lib/chat/handlers.ts`):

| Công cụ | Dòng | Bảng đọc |
|---|---|---|
| `tra_cuu_he_so` | `handlers.ts:92` | `emission_factors` |
| `liet_ke_mua_vu` | `handlers.ts:110` | `seasons`, `field_seasons(count)` |
| `tong_ket_mua_vu` | `handlers.ts:133` | `field_seasons`, `fields`, `emission_calculations` |
| `thua_thieu_nhat_ky` | `handlers.ts:173` | `field_seasons`, `fields`, `farmers`, `seasons`, `cooperatives`, `straw_management`, `emission_calculations` |
| `chi_tiet_thua_vu` | `handlers.ts:225` | + `water_events`, `fertilizer_applications` |
| `liet_ke_nong_ho` | `handlers.ts:301` | `farmers`, `fields` |
| `liet_ke_lo_tin_chi` | `handlers.ts:330` | `credit_batches`, `cooperatives`, `seasons` |
| `chia_doanh_thu` | `handlers.ts:364,372` | `credit_batches`, `orders`, `revenue_shares` |
| `lo_dang_chao_ban` | `handlers.ts:412` | `credit_batches`, `cooperatives` |
| `don_hang_cua_toi` | `handlers.ts:440` | `orders`, `payments`, `credit_batches` |

Thêm `cooperatives` đọc trực tiếp ở `api/chat/route.ts:90` để dựng system prompt.

### Nếu xoá các bảng đó, chatbot có gãy không? — CÓ. Điểm gãy cụ thể

**A. Gãy lúc biên dịch (`npm run build` / `npm run types` đỏ) — nguy hiểm nhất vì chặn cả deploy:**

1. `src/lib/chat/handlers.ts:4-6` import `@/lib/mrv/factors`, `@/lib/mrv/collect`,
   `@/lib/mrv/types`. Xoá `src/lib/mrv/**` ⇒ **cả `/api/chat` không build được**, kể cả
   khi bảng DB còn nguyên.
2. `src/lib/chat/handlers.ts:7-13` import `BATCH_STATUS_LABEL`, `ORDER_STATUS_LABEL`,
   `PAYMENT_STATUS_LABEL` từ `src/lib/labels.ts:75,84,92` — ba hằng này là
   `Record<Enums["batch_status" | "order_status" | "payment_status"], string>`. Xoá ba
   enum khỏi `src/types/database.ts` ⇒ lỗi kiểu ở `labels.ts` ⇒ kéo theo `handlers.ts`.
3. `src/lib/labels.ts:5-10` là `Record<Enums["user_role"], string>`. **Thêm** giá trị
   `project_owner`/`project_developer` vào enum ⇒ TypeScript báo thiếu khoá ⇒ đỏ.
   `prompt.ts:88` dùng `ROLE_LABEL[ctx.role]`, `app-nav.tsx:55` cũng vậy.

**B. Gãy lúc chạy (route vẫn dựng, công cụ ném lỗi):**

4. Bốn công cụ trỏ vào bảng chợ — `liet_ke_lo_tin_chi`, `chia_doanh_thu`,
   `lo_dang_chao_ban`, `don_hang_cua_toi` — sẽ trả lỗi PostgREST. `handlers.ts:66-68`
   (`fail()`) ném, `api/chat/route.ts:118-120` bắt lại và trả `{ loi: ... }` cho model.
   Nghĩa là **không sập route**, nhưng trợ lý trả lời "không tra được" cho mọi câu hỏi
   liên quan — hỏng âm thầm.
5. Sáu công cụ còn lại trỏ vào `emission_factors`, `seasons`, `field_seasons`,
   `farmers`, `fields`, `straw_management`, `water_events`,
   `fertilizer_applications`, `emission_calculations` — cùng cơ chế hỏng âm thầm.
6. `0010_chat.sql:15` có `cooperative_id uuid references cooperatives (id)`. **Không
   `drop table cooperatives` được** khi `chat_conversations` còn tồn tại (phải
   `cascade`, và như thế là mất cột). `user_id → profiles` (`0010:12,26`) cũng vậy —
   **`profiles` bắt buộc phải sống sót**.

**C. Gãy về mặt nội dung (không có lỗi nào, nhưng trả lời sai):**

7. `src/lib/chat/knowledge.ts:10-40` nhét thẳng vào system prompt mô tả sản phẩm cũ:
   4 vai trò, 9 đường dẫn màn hình `/htx/...`, `/cho`, `/quan-tri`. Không sửa ⇒ trợ lý
   tự tin chỉ người dùng tới màn hình không còn tồn tại.
8. `src/lib/chat/prompt.ts:16-32` (`PAGE_HINTS`) khớp toàn route cũ ⇒ mọi màn hình mới
   đều thành "không nhận diện được".
9. `src/components/chat/chat-panel.tsx:13-24` (`TOOL_LABEL`) và `:26-42`
   (`SUGGESTIONS_BY_ROLE` với ba khoá `coop`/`buyer`/`admin`) gắn cứng vào bộ công cụ và
   vai trò cũ.
10. `src/lib/chat/tools.ts:25-26,146,158,165,173` liệt kê vai trò được phép theo tên.
    Vai trò `project_owner`/`project_developer` mới sẽ **không thấy công cụ nào**
    (`toolsForRole` ở `tools.ts:179-181` lọc rỗng) ⇒ `prompt.ts:100` in ra "(không có
    công cụ nào khả dụng cho vai trò này)".

**D. Gãy kiểm thử:**

11. `tests/chat.test.ts:283-291` bắt buộc `FIXTURE_RESULTS` phủ **đúng** tập `TOOLS` —
    không thiếu, không thừa. Sửa `TOOLS` mà quên `src/lib/chat/eval/fixture.ts` ⇒ đỏ.
    Ngược lại, sửa `handlers.ts` mà giữ nguyên `TOOLS` thì test **không** bắt được.
12. `tests/e2e/flow.test.ts` chạy trên DB thật.

**E. Gãy về hiện diện giao diện — dễ bị bỏ sót nhất:**

13. Bốn điểm gắn widget và trang `/htx/tro-ly` đều nằm trong module bị xoá. Xoá `/htx`,
    `/cho`, `/don-hang`, `/quan-tri` ⇒ **mã chatbot còn nguyên nhưng biến mất khỏi giao
    diện**. Phải gắn lại vào layout của module dự án mới.
14. Màn hình cấu hình trợ lý nằm ở `/quan-tri/tro-ly` — cũng trong vùng bị xoá. Mất nó
    thì không còn đường nhập khoá API qua giao diện, chỉ còn biến môi trường.

### Phần chatbot KHÔNG phụ thuộc gì vào nghiệp vụ cũ

`guards.ts`, `run.ts`, `provider.ts`, `providers/gemini.ts`, `providers/registry.ts`,
`settings.ts`, `eval/trajectory.ts`, và `chat-widget.tsx` — tái dùng nguyên vẹn.
`config.ts` là lớp nền cũ, chỉ còn `readChatConfig` dùng trong test.

---

## 3. Auth & user/role hiện tại

### Cơ chế

**Supabase Auth**, email + mật khẩu, phiên lưu trong cookie qua `@supabase/ssr`.

- Đăng nhập: `src/app/auth-actions.ts:12-33` (`signInWithPassword`).
- Đăng ký: `src/app/auth-actions.ts:35-70` (`signUp`, gửi role trong `options.data`).
- Đăng xuất: `src/app/auth-actions.ts:72-80`.
- Làm mới phiên + chặn route: `src/middleware.ts:41-50`; danh sách nhánh cần đăng nhập ở
  `src/middleware.ts:6`; chưa đăng nhập thì chuyển `/dang-nhap?tiep-tuc=<path>`.
- Ba client Supabase: `src/lib/supabase/server.ts` (SSR), `client.ts` (trình duyệt),
  `admin.ts` (service role — cố ý **chỉ** dùng cho một việc: đọc `chat_settings.api_key`,
  `admin.ts:5-18`).
- Giao diện: `src/app/dang-nhap/`, `src/app/dang-ky/`, `src/components/auth-layout.tsx`,
  `src/components/app-nav.tsx`.

### Role lưu ở đâu

**Trong bảng `public.profiles`, cột `role`, kiểu enum `user_role`** — *không* ở
`app_metadata`, *không* ở JWT claim.

- Enum: `0001_core_schema.sql:6` — `platform_admin | coop_manager | coop_staff | buyer`.
- Bảng: `0001_core_schema.sql:40-48`; `profiles.id` tham chiếu `auth.users(id)`.
- Trigger tạo hồ sơ: `on_auth_user_created` (`0001:68-70`), hàm `handle_new_user`, bản
  hiện hành ở `0012_signup_role_guard.sql:27-50` — **danh sách trắng** chỉ nhận
  `coop_manager`, `coop_staff`, `buyer`; giá trị khác **âm thầm hạ về `coop_staff`**
  (`0012:33-38`). `platform_admin` chỉ cấp được bằng truy cập DB trực tiếp.
- Chống tự nâng quyền khi UPDATE: `guard_profile_escalation`, bản hiện hành ở
  `0005_business_rpc.sql:8-20` — chặn đổi `role`/`cooperative_id`, trừ khi là admin hoặc
  đang trong hàm `security definer` có đặt `app.bypass_profile_guard`
  (`0005:47`, `:68`, `0009_coop_two_tier.sql:29`).
- TypeScript: `src/types/database.ts:2075`, `src/lib/auth.ts:6-7`.

### RLS gắn vào role thế nào

Ba hàm trợ giúp `security definer` đọc `profiles` theo `auth.uid()` —
`0003_rls.sql:6-19`: `app_user_role()`, `app_coop_id()`, `app_is_admin()`.
Quyền `execute` được siết ở `0007_harden.sql:39-41,63-65,76-78` (chỉ `authenticated`).

Ba khuôn policy:

1. **Theo hợp tác xã** — 9 bảng dữ liệu đồng ruộng, sinh bằng vòng lặp
   `0003_rls.sql:88-108`: `using (cooperative_id = app_coop_id() or app_is_admin())`.
   Đây là biên đa-tenant duy nhất của hệ thống.
2. **Theo vai trò** — `0003:80` (`coop_manager` mới tạo được HTX), `0003:83-84`,
   `0003:120-126` (chỉ `coop_manager` ghi lô tín chỉ; `buyer` xem lô đang chào bán),
   `0003:148-153` (chỉ `buyer` đặt hàng).
3. **Theo chủ sở hữu** — `0003:59-64` (`profiles`), `0003:140-145` (`orders`),
   `0010_chat.sql:41-47` (hội thoại: **chỉ chính chủ**, đồng nghiệp cùng HTX và cả
   `platform_admin` đều không đọc được), `0011_chat_settings.sql:41-46` + quyền theo cột
   `0011:60-66` (cột `api_key` không cấp đọc cho vai trò ứng dụng nào).

Kiểm tra role ở tầng ứng dụng (lớp thứ hai, không phải lớp chặn thật):
`src/lib/auth.ts:28-34` (`requireCoopProfile`), `:42-46` (`homePathFor`),
`src/components/app-nav.tsx:27-32`, `src/app/quan-tri/tro-ly/page.tsx:21` và
`actions.ts:23-27`, `src/lib/chat/tools.ts:179-185`,
`src/app/api/chat/route.ts:107,111`.

### KẾT LUẬN: auth hiện tại **TÁI SỬ DỤNG ĐƯỢC** — mở rộng, không viết lại

**Lý do kỹ thuật giữ lại:**

- Lớp định danh (Supabase Auth + `profiles` + trigger + middleware + ba client SSR) hoàn
  toàn trung tính với nghiệp vụ. Không có gì trong đó riêng cho lúa nước.
- Mô hình bảo mật đã đặt đúng chỗ: RLS ở tầng Postgres, ứng dụng chỉ là lớp thứ hai. Viết
  lại đồng nghĩa dựng lại toàn bộ tài sản này từ đầu và mất các bản vá đã có
  (`0007_harden.sql`, `0012_signup_role_guard.sql` — bản vá cho một lỗi nâng quyền có
  thật, mô tả ở `0012:1-25`).
- Bản thân khoá phân vùng cũng không phải sửa: `cooperatives` + `profiles.cooperative_id`
  vẫn dùng được làm "tổ chức" cấp dưới, và spec dự án đã có sẵn cách nới policy chỉ bằng
  một vế `or` (`docs/superpowers/specs/2026-09-05-project-layer-design.md:139-168`).

**Lý do kỹ thuật vì sao KHÔNG đủ nếu để nguyên:**

- `user_role` là **một vai trò toàn cục cho mỗi người**. `PLAN.md` §2 đòi `Member[]` với
  `role: owner | developer | viewer` **theo từng dự án**: cùng một người có thể là
  Project Owner của dự án A và Developer của dự án B. Một cột enum không diễn đạt được.
- Vì vậy: **giữ `user_role` làm trục "người này là ai trên nền tảng", thêm trục thứ hai
  `project_members(project_id, user_id, role)` cho "người này làm gì trong dự án này"** —
  đúng thiết kế đã được ghi ở `2026-09-05-project-layer-design.md:100-105` và `:112-118`.

**Việc cần làm nếu tái sử dụng (danh sách đầy đủ):**

| # | Việc | Vị trí |
|---|---|---|
| 1 | Migration mới: bảng `project_members` + enum `project_role` (`project_owner`, `project_developer`, `viewer`) | migration mới ≥ `0013` |
| 2 | Hàm trợ giúp RLS mới, kiểu `app_project_ids()` / `app_project_role(project_id)`, `security definer`, `set search_path = public` | cùng migration |
| 3 | Cấp `execute` cho `authenticated`, thu hồi từ `public` và `anon` | theo khuôn `0007_harden.sql:63-78` |
| 4 | Policy cho mọi bảng mới của Module A/B; bảng bật RLS mà không có policy là **vô hình**, không phải là mở | migration mới |
| 5 | Nếu vẫn muốn thêm giá trị vào `user_role`: `alter type ... add value`. **Trên PG, giá trị enum mới không dùng được trong cùng transaction đã thêm nó** ⇒ phải tách làm hai migration | migration mới |
| 6 | Cập nhật danh sách trắng trong `handle_new_user`, nếu không mọi tài khoản mới **âm thầm** thành `coop_staff` | `0012_signup_role_guard.sql:33-38` |
| 7 | Cập nhật `ROLE_LABEL` (bắt buộc, nếu không TS đỏ) | `src/lib/labels.ts:5-10` |
| 8 | Viết lại `homePathFor` — đang trỏ `/cho`, `/quan-tri`, `/htx`, `/thiet-lap` | `src/lib/auth.ts:42-46` |
| 9 | Thay `requireCoopProfile` bằng `requireProjectMember(projectId)` | `src/lib/auth.ts:28-34` |
| 10 | Đổi ô chọn vai trò lúc đăng ký và kiểm tra tương ứng ở server action | `src/app/dang-ky/form.tsx:14-16`, `src/app/auth-actions.ts:42-47` |
| 11 | Đổi `PROTECTED` sang nhánh route mới | `src/middleware.ts:6` |
| 12 | Đổi menu điều hướng | `src/components/app-nav.tsx:6-24` |
| 13 | Đổi `roles` của công cụ trợ lý | `src/lib/chat/tools.ts:25-26,146,158,165,173` |

Không việc nào trong 13 mục đòi bỏ Supabase Auth, bỏ `profiles`, hay dựng lại phiên đăng
nhập. Đây là công việc mở rộng, không phải viết lại.

---

## 4. Trả lời câu hỏi mở `PLAN.md` §7

### DB hiện tại là gì, phiên bản nào

**PostgreSQL 17.6.1.166** (engine 17, kênh GA) trên **Supabase** — project
`agri-carbon-pass`, ref `uyzswphovqzmautoipfz`, vùng `ap-southeast-1`, trạng thái
`ACTIVE_HEALTHY`, tạo ngày 30/8/2026. PostgREST 14.5 (`src/types/database.ts:13`).

Extension **đã cài**: `postgis 3.3.7` (trong schema `public`), `pgcrypto`, `uuid-ossp`,
`pg_stat_statements`, `supabase_vault`, `plpgsql`.
Extension **chưa cài** đáng chú ý: `vector` (pgvector) — nếu sau này chatbot cần RAG cho
tài liệu methodology thì phải bật thêm; hiện `knowledge.ts:1-8` cố ý không dùng RAG.

Migration đã áp lên DB: 14 bản, khớp 12 tệp trong `supabase/migrations/`
(`0004` và `0007` mỗi tệp tách thành hai bản ghi từ xa). Bản cuối cùng là
`20260901075002 signup_role_guard` = `0012`. **Chưa có migration nào cho lớp dự án.**

### Ràng buộc tương thích

1. **RLS bật trên mọi bảng nghiệp vụ** (`0003_rls.sql:40-56`, `0010:38-39`,
   `0011:36`). Bảng mới bật RLS mà thiếu policy thì **không ai đọc được** — kể cả chủ
   dữ liệu. Đây là chế độ mặc định fail-closed, phải viết policy cho từng bảng mới.
2. **PostGIS cài trong schema `public`** — `0007_harden.sql:88-96` ghi rõ đây là điểm
   không sửa được từ migration; sửa triệt để phải cài lại vào schema riêng, tức làm lại
   DB từ đầu, vì mọi cột `geometry` đang tham chiếu kiểu trong `public`.
3. **`auth.users` gắn trigger** `on_auth_user_created` (`0001:68-70`). Mọi thay đổi lên
   đường tạo tài khoản phải đi qua `handle_new_user`.
4. **Thêm giá trị enum không dùng được ngay trong cùng transaction** — migration của
   Supabase chạy trong transaction, nên `alter type ... add value` và chỗ dùng giá trị
   mới phải nằm ở **hai tệp migration khác nhau**.
5. **Không sửa migration đã áp**. `0007_harden.sql:45-52,66-72` cấp/thu quyền theo đúng
   chữ ký hàm; đổi chữ ký một hàm cũ sẽ làm việc dựng lại DB từ đầu thất bại.
6. **Dữ liệu đang có trên DB phát triển**: 1 HTX, 19 nông hộ, 27 thửa ruộng, 10 mùa vụ,
   27 thửa-vụ, 19 bản tính (theo `2026-09-05-project-layer-design.md:219-221`). Không
   nhiều, nhưng đủ để `on delete cascade` sai chỗ gây mất dấu vết.
7. `SUPABASE_SERVICE_ROLE_KEY` **chưa đặt** trong `.env.local` — chỉ có
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EVAL_API_TOKEN`,
   `GEMINI_API_KEY`, `GEMINI_MODEL`. Nghĩa là khoá trợ lý hiện lấy từ biến môi trường
   (`src/lib/chat/settings.ts:61-63,86-100`), và khoá lưu trong DB (nếu có) hiện không
   đọc lại được.

### Có sẵn multi-tenancy chưa

**Có một phần — đủ cho một tầng, thiếu cho mô hình dự án.**

Đang có:
- Thực thể tổ chức: `cooperatives` (`0001:28-38`), có `code` duy nhất.
- Khoá phân vùng `cooperative_id` trên **mọi** bảng dữ liệu đồng ruộng, cưỡng chế bằng
  RLS (`0003:88-108`).
- Gia nhập bằng mã: `join_cooperative_by_code` (`0005:54-72`),
  `create_cooperative_and_join` (`0009:5-33`).

Chưa có:
- **Không có tầng "tổ chức" trên hợp tác xã.** Không có `organizations`, không có khái
  niệm đơn vị phát triển dự án.
- **Một người thuộc tối đa một HTX** — `profiles.cooperative_id` là cột đơn trị
  (`0001:45`), và cả hai hàm onboarding đều từ chối nếu đã có HTX (`0005:61-63`,
  `0009:16-18`). Project Developer làm việc cho nhiều dự án/nhiều HTX là **không diễn
  đạt được** với cấu trúc hiện tại.
- **Không có quan hệ M:N nào** giữa người/tổ chức và dự án.
- Tên gọi gắn cứng vào "hợp tác xã" ở khắp nơi: cột, hàm, nhãn, đường dẫn.

⇒ Multi-tenancy cho nền tảng mới **phải bổ sung**, nhưng là bổ sung chứ không phải thay
thế: giữ `cooperatives` làm đơn vị sản xuất, thêm `organizations`/`projects` +
`project_members` phía trên, và nới policy hiện có bằng một vế `or` thay vì viết lại
(khuôn có sẵn ở `2026-09-05-project-layer-design.md:145-160`).

---

## 5. Rủi ro & cảnh báo

**R1 — Hai thiết kế đang cạnh tranh nhau trong repo.** `PLAN.md` (Jira, `Standard` →
`Methodology` → `Project` → `Stage` → `Task`, vai trò `project_owner`/`project_developer`,
Module A/B) và `docs/superpowers/specs/2026-09-05-project-layer-design.md`
(`organizations` → `projects` → `monitoring_periods`, vai trò
`project_developer`/`mrv_officer`/`htx_manager`, HTX M:N) — bản sau vừa được commit
(`5c2e495`) nhưng **chưa có dòng mã hay migration nào**. Hai mô hình chồng lấn nhưng
không trùng. **Phải chốt một cái trước bước 2 của `PLAN.md`**, nếu không sẽ có hai lược
đồ dự án song song.

**R2 — Xoá `src/lib/mrv/**` làm `/api/chat` không build được.** `handlers.ts:4-6`. Đây là
phụ thuộc chéo giữa hai vùng đang được audit song song ⇒ **phải phối hợp**, không bên nào
xoá đơn phương.

**R3 — Xoá enum `batch_status`/`order_status`/`payment_status` làm `src/lib/labels.ts`
đỏ**, kéo theo `handlers.ts`. Sửa `labels.ts` trước, rồi mới drop enum.

**R4 — Thêm giá trị vào `user_role` làm `ROLE_LABEL` đỏ ngay** (`labels.ts:5-10`). Lỗi
nhìn thấy được — chấp nhận được. Nguy hiểm hơn là **R5**.

**R5 — `handle_new_user` âm thầm hạ vai trò lạ về `coop_staff`** (`0012:33-38`), cố ý
không báo lỗi. Thêm `project_owner` vào enum mà quên sửa danh sách trắng ⇒ **mọi tài
khoản đăng ký mới đều thành `coop_staff`, không một thông báo nào**. Đây là điểm gãy khó
phát hiện nhất trong toàn bộ phần auth.

**R6 — Vai trò mới sẽ không thấy dữ liệu nào.** Mọi policy đang lọc theo
`cooperative_id = app_coop_id()` hoặc so tên vai trò cũ. Người dùng `project_owner` chưa
gắn HTX ⇒ `app_coop_id()` trả `null` ⇒ không đọc được gì. Fail-closed nên an toàn, nhưng
sẽ trông như "hệ thống hỏng" nếu không nới policy cùng lúc.

**R7 — Xoá module = xoá chatbot khỏi giao diện.** Bốn điểm gắn widget đều nằm trong
`/htx`, `/cho`, `/don-hang`, `/quan-tri`. Mã sống nhưng không ai chạm tới được. Kèm theo:
mất `/quan-tri/tro-ly` là mất đường cấu hình khoá API.

**R8 — `profiles` và `cooperatives` không xoá được khi bảng chat còn.** Khoá ngoại ở
`0010_chat.sql:12,15,25-26`. Dùng `cascade` để lách sẽ mất luôn cột/bảng chat.

**R9 — Landing page dựng động vì đọc phiên đăng nhập** (`page.tsx:3`). Sửa `@/lib/auth`
mà không sửa `page.tsx` cùng lúc ⇒ **trang chủ công khai sập**. Giảm nhẹ có sẵn:
`getProfile` trả `null` khi thiếu cấu hình (`src/lib/auth.ts:10-12`).

**R10 — `tests/e2e/flow.test.ts` chạy trên DB thật** (`vitest.e2e.config.ts:5-12`).
Không chạy `npm run test:e2e` trong lúc đang di trú lược đồ.

**R11 — `tests/chat.test.ts:283-291` chỉ canh `TOOLS` ↔ `FIXTURE_RESULTS`, không canh
`HANDLERS`.** Sửa `handlers.ts` cho hỏng mà giữ nguyên `TOOLS` thì bộ test vẫn **xanh**.
Đừng tin màu xanh ở đây khi đụng vào handler.

**R12 — `app.bypass_profile_guard` mở đường vượt trigger chống nâng quyền**
(`0005:11`). Hiện chỉ ba hàm `security definer` đặt nó và có phạm vi trong transaction.
Mọi RPC mới cần cẩn thận: đặt cờ này rồi update `profiles` là con đường tự cấp
`platform_admin`.

**R13 — Đổi giá trị hằng số vùng miền.** `src/lib/region.ts:13-29` gắn cứng `ACTIVE_REGION
= "north"` và hai loại vụ; landing page in trực tiếp số ở `page.tsx:7`. Nền tảng mới có
`country`/`province` theo dự án ⇒ hai nguồn sự thật, cần gỡ.

---

## Tóm tắt ba điểm

1. **Auth tái sử dụng được** — giữ Supabase Auth + `profiles` + RLS, thêm trục vai trò
   thứ hai theo dự án (`project_members`), nới policy bằng một vế `or`. 13 việc cụ thể ở §3.
2. **Chatbot không "giữ nguyên" được** — 10/10 công cụ đọc bảng của module sắp bị thay, và
   `handlers.ts:4-6` khiến việc xoá `src/lib/mrv/**` làm cả `/api/chat` **không build
   được**. Phần lõi (`run`, `provider`, `guards`, `settings`) thì tái dùng nguyên vẹn.
3. **DB là PostgreSQL 17 trên Supabase, đã có multi-tenancy một tầng theo hợp tác xã,
   chưa có tầng tổ chức/dự án** và một người chỉ thuộc được một HTX.
