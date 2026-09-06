# Bước 6 — tích hợp nền tảng dự án với chatbot và landing page

`PLAN.md` §6 bước 6. Nguyên tắc quyết định: **THÊM, KHÔNG GỠ**.

## Vì sao không gỡ module cũ trong đợt này

Audit của chính dự án đã chứng minh việc gỡ bây giờ sẽ làm gãy chatbot
(`docs/audit/audit-keep.md` R2, R3, R7, R8):

- 10/10 công cụ trợ lý cũ đọc bảng nghiệp vụ của module cũ.
- `src/lib/chat/handlers.ts:4-6` import `@/lib/mrv/{factors,collect,types}` — xoá thư mục
  đó là **`/api/chat` không build được**, không phải lỗi lúc chạy.
- `src/lib/labels.ts:75,84,92` là `Record` trên ba enum `batch_status`/`order_status`/
  `payment_status`; drop enum là `npm run types` đỏ.
- `chat_conversations.cooperative_id` có khoá ngoại tới `cooperatives`
  (`0010_chat.sql:15`), nên `drop table cooperatives` cần `cascade` — và `cascade` sẽ cắt
  mất cột của chính bảng chatbot.

Vì vậy đợt này **không xoá** route, bảng, hay tệp nào của module cũ. Điều kiện để mở đợt
gỡ riêng nằm ở cuối tài liệu.

## Đã làm

### 1. Trợ lý có mặt trong nền tảng dự án

`ChatWidget` được gắn vào `src/app/du-an/layout.tsx`. Bốn điểm gắn cũ
(`htx/layout.tsx:19`, `cho/layout.tsx:17`, `don-hang/layout.tsx:11`,
`quan-tri/page.tsx:94`) **giữ nguyên** — nay có 5 điểm gắn, không phải 4.

Trước bước này, cả bốn điểm gắn đều nằm trong module cũ, nên người dùng nền tảng dự án
không gặp trợ lý ở đâu cả. Đó đúng là rủi ro **R7** đã ghi trong audit.

### 2. Trợ lý biết về sản phẩm mới

| Tệp | Thay đổi |
|---|---|
| `src/lib/chat/knowledge.ts` | Mô tả lại nền tảng là **hai phần** dùng chung tài khoản; thêm phần khái niệm dự án (Standard → Methodology → Dự án, ba vai trò dự án, bảy bước), 6 nhóm đường dẫn `/du-an/**`, và bốn quy tắc hay bị hỏi. Phần lúa nước giữ nguyên, chỉ đổi tiêu đề mục cho rõ nó nói về phần nào. |
| `src/lib/chat/prompt.ts` | Thêm 10 `PAGE_HINTS` cho `/du-an/**`, đặt **trước** các hint cũ. Hint cũ không đổi. |
| `src/components/chat/chat-panel.tsx` | Thêm nhãn cho hai công cụ mới và bộ gợi ý `du_an`. |

**Gợi ý chọn theo đường dẫn, không theo prop.** `ChatWidget` không nằm trong danh sách tệp
được ghi ở bước này, nên không mở rộng được kiểu prop `audience` của nó. Thay vào đó
`ChatPanel` tự suy ngữ cảnh từ `usePathname()` — thứ nó vốn đã đọc để gửi kèm màn hình
hiện tại cho máy chủ. Cách này còn đúng hơn: cùng một người mở trợ lý ở `/du-an` và ở
`/htx` sẽ nhận gợi ý khác nhau, đúng như mong đợi.

### 3. Vấn đề công cụ — không phải "rỗng" mà là "sai công cụ"

Brief đặt giả thiết người dùng nền tảng dự án có thể **không thấy công cụ nào**. Kiểm tra
thực tế cho thấy ngược lại: họ mang vai trò toàn cục `coop_staff`, mà
`tools.ts:25` xếp `coop_staff` vào nhóm `COOP`, nên họ thấy **7 công cụ của hợp tác xã**.
Cả 7 đều lọc theo `app_coop_id()`, vốn là `null` với họ, nên **luôn trả rỗng**.

Không rò rỉ dữ liệu — RLS làm đúng việc của nó. Nhưng trợ lý sẽ mời người ta tra mùa vụ,
nông hộ, lô tín chỉ rồi lần nào cũng trả lời "chưa có dữ liệu". Đó là hỏng im lặng.

Cách chữa: thêm cờ `needsCooperative` vào `ToolSpec` và hàm `toolsForContext(role, {hasCooperative})`.

- `toolsForRole` **giữ nguyên chữ ký** vì `src/app/api/chat/route.ts` (không nằm trong
  danh sách được ghi) dùng nó làm lớp chặn khi thực thi công cụ.
- `buildSystemPrompt` chuyển sang `toolsForContext`, suy `hasCooperative` từ `coopName`
  mà route đã truyền sẵn.

Đây **không phải thay đổi về quyền**: tập giới thiệu luôn là tập con của tập được phép,
và có test khoá lại điều đó. Nó chỉ thôi mời người ta tra thứ chắc chắn không có.

### 4. Hai công cụ mới cho dự án — có làm, và vì sao

| Công cụ | Trả về |
|---|---|
| `liet_ke_du_an` | Dự án người hỏi là thành viên: tên, vai trò **của chính họ**, tiến độ `n/7`, Standard, Methodology, cờ dữ liệu mẫu |
| `tien_do_du_an` | Một dự án: bảy bước đã duyệt tới đâu, công việc theo trạng thái, kỳ giám sát, báo cáo gần nhất |

Lý do làm: không có chúng thì trợ lý vô dụng trong chính sản phẩm mới, và tệ hơn — nó vẫn
mời tra cứu dữ liệu HTX. Rủi ro thấp vì hai handler đọc **qua phiên người dùng**, đúng
khuôn 10 handler sẵn có; RLS `projects_read` (`0013:887`) chỉ trả dự án người đó là thành
viên. **Không dùng service role ở bất kỳ đâu.**

Ba điều kiện bắt buộc của brief đều đã làm:
- `FIXTURE_RESULTS` bổ sung đúng hai mục. Test chẵn lẻ đã **đỏ thật** khi thiếu và xanh
  lại sau khi thêm — nó hoạt động đúng như thiết kế.
- **Tự viết test cho handler**: `tests/project-chat-tools.test.ts` gọi thẳng `HANDLERS`
  trên một client giả. Đây là chỗ trám bẫy **R11** — test chẵn lẻ chỉ canh
  `TOOLS` ↔ `FIXTURE_RESULTS`, sửa handler cho hỏng mà giữ nguyên `TOOLS` thì nó vẫn xanh.
- Đọc qua RLS bằng phiên người dùng.

Cả hai công cụ luôn kèm `ghi_chu` nói rõ con số là **ước tính chưa thẩm định**, và
`liet_ke_du_an` trả cờ `methodology_la_du_lieu_mau` để trợ lý nói được điều đó.

### 5. Landing page — không sửa một ký tự

`src/app/page.tsx` **không thay đổi**. Nó vốn gọi `homePathFor(profile.role,
profile.cooperative_id)`, và từ bước 3 hàm đó đã trả `/du-an` cho tài khoản nền tảng dự
án. Nút chính của trang chủ vì thế tự trỏ đúng chỗ mà không cần đụng vào thiết kế, nội
dung, ảnh hay video — đúng `PLAN.md` §1.

### 6. Đường vào cũ vẫn nguyên, thêm lối sang mới

`src/components/app-nav.tsx` thêm một mục `Dự án carbon → /du-an` vào **cả ba** menu cũ
(HTX, doanh nghiệp mua, quản trị). Không mục nào bị bỏ; `/quan-tri/tro-ly` — màn hình nhập
khoá API của trợ lý — vẫn ở nguyên vị trí.

## Kiểm chứng

```
npm run types  → sạch
npm run test   → 262/262 (245 trước đó + 17 ca mới ở tests/project-chat-tools.test.ts)
npm run build  → Compiled successfully
```

Không `npm install`; không chạm Supabase thật; không xoá route, bảng hay tệp nào.

## Điều còn chưa chắc

1. **Hai handler mới chưa chạy trên cơ sở dữ liệu thật.** Chúng được kiểm bằng client
   giả dựng lại chuỗi gọi PostgREST, nên bắt được lỗi logic nhưng **không** bắt được sai
   tên cột hay sai hình dạng trả về. Cùng một điều chưa chắc đã ghi ở bước 4 và 5.

2. **Trợ lý chưa được đánh giá lại bằng eval.** Bộ ca eval hiện có viết cho sản phẩm cũ;
   thêm hai công cụ và sửa `knowledge.ts` là đủ để đổi hành vi model. Nên chạy lại
   `/api/eval/chat` với bộ ca có thêm ca về dự án trước khi coi là xong.

3. **`toolsForContext` chỉ ảnh hưởng system prompt, không phải lớp chặn.** Nếu model tự
   gọi một công cụ HTX cho người dùng không thuộc HTX, `route.ts` vẫn cho chạy và kết quả
   sẽ rỗng. Muốn chặn thật thì phải sửa `src/app/api/chat/route.ts` — tệp không nằm trong
   phạm vi ghi của bước này. Hiện không có hại, chỉ là một lượt gọi thừa.

4. **Người dùng nền tảng dự án vẫn mang nhãn vai trò `coop_staff`** trong prompt
   (`ROLE_LABEL[coop_staff]` = "Cán bộ hợp tác xã"). Trợ lý có thể gọi sai vai người dùng.
   Sửa triệt để thuộc về đợt phẫu thuật `user_role` ở mục dưới.

## Điều kiện để mở đợt gỡ module cũ

Đợt gỡ là một nhiệm vụ riêng, và **chỉ được bắt đầu khi cả bốn điều sau đã xong**:

1. Trợ lý không còn công cụ nào đọc bảng của module cũ — nghĩa là bộ công cụ dự án đủ
   thay thế, và 8 công cụ cũ bị gỡ khỏi `TOOLS`, `HANDLERS`, `FIXTURE_RESULTS` cùng lúc.
2. `src/lib/chat/handlers.ts` không còn import `@/lib/mrv/**`, và `src/lib/labels.ts`
   không còn `Record` trên ba enum của chợ tín chỉ.
3. Có migration được review riêng để gỡ khoá ngoại `chat_conversations.cooperative_id`
   trước khi đụng tới bảng `cooperatives`.
4. `user_role` được thiết kế lại trọn vẹn — đây là thời điểm đúng cho việc đó, như đã ghi
   trong `docs/design/auth-role-design.md` §1.

Trước khi đủ bốn điều kiện, mọi thao tác gỡ đều làm gãy chatbot theo một trong bốn đường
đã liệt kê ở đầu tài liệu.
