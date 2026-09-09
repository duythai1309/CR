# Thiết kế: bảy mục là HỒ SƠ, kanban là TIẾN ĐỘ CÔNG VIỆC

Ngày 07/09/2026. Sửa một sai lầm về mô hình khái niệm, không phải sửa giao diện.

## 1. Sai ở đâu

Bảy mục — Project Idea, Feasibility Assessment, Standard, Methodology, Baseline,
Additionality, PDD — là **thông tin nền mà đơn vị phát triển dự án phải xây dựng**, xuyên
suốt vòng đời dự án. Chúng **không phải đầu việc**.

Bản hiện tại làm sai hai chỗ:

1. **Kanban lấy bảy mục làm cột.** `groupTasksByStage` gom task theo `stage_id`, nên bảng
   công việc đang hiển thị "tiến độ hồ sơ" chứ không phải tiến độ công việc. Người dùng tự
   thêm task, và họ cần thấy task của mình đang ở đâu.
2. **Màn Thiết kế bày bảy mục thành một chuỗi tuần tự** với nhãn "Chưa tới lượt", làm người
   dùng tưởng phải điền theo thứ tự.

## 2. Sự thật về ràng buộc — phải giữ đúng, không được bịa

Đã kiểm từng đường ghi. Trong bảy mục:

| Mục | Chặn điền? | Nguồn |
|---|---|---|
| Project Idea, Feasibility, Additionality, PDD | **Không** | ghi vào `setup` jsonb / tài liệu, không có điều kiện |
| Standard | **Không** | `chooseStandard` không có tiền đề |
| Methodology | **Có** — cần Standard đã khoá | `chooseMethodology` (`quy-trinh/actions.ts:71`) |
| Baseline | **Có** — cần Methodology | form sinh từ `metric_schema`; chưa có thì không có field nào |

Hai ràng buộc còn lại là **phụ thuộc dữ liệu thật**, không phải thứ tự tuỳ tiện. Giữ nguyên
và giải thích bằng lý do, không dùng nhãn "chưa tới lượt".

`approve_project_stage` (`0013:703-705`) vẫn cưỡng chế duyệt tuần tự ở DB. **Duyệt khác
điền.** Yêu cầu là điền được bất kỳ lúc nào; không ai yêu cầu bỏ duyệt tuần tự. **Không
viết migration, không đụng guard này.**

## 3. Ranh giới file

| Gói | Sở hữu độc quyền | Người làm |
|---|---|---|
| WP-K | `src/components/project/rules.ts` (chỉ THÊM hàm mới), `src/app/du-an/[id]/page.tsx`, `src/app/du-an/[id]/board.tsx`, `src/components/project/board/**` | Codex `coder` |
| WP-H | `src/app/du-an/[id]/quy-trinh/page.tsx`, `src/app/du-an/[id]/quy-trinh/setup-blocks.tsx`, `src/components/project/journey-rail.tsx` | Codex `coder2` |

Chỉ đọc với cả hai: `supabase/**`, `src/lib/**`, `src/types/**`, `src/components/ui.tsx`,
`src/app/du-an/[id]/layout.tsx`, `src/app/du-an/[id]/quy-trinh/actions.ts`.

## 4. WP-K — kanban theo tiến độ công việc

Cột của bảng công việc chuyển từ bảy stage sang **bốn trạng thái task đã có sẵn** trong
`rules.ts:14-29`: `todo` Chưa làm · `in_progress` Đang làm · `done` Xong · `blocked` Vướng.

- **Thêm** `groupTasksByStatus` vào `rules.ts`. **Không xoá, không sửa** `groupTasksByStage`
  — `tests/project-rules.test.ts:167-180` đang chốt vào nó, và test cũ không được đỏ.
- Kéo-thả giữa các cột nay **đổi `status`**, không đổi `stage_id`. Đường ghi đã có sẵn:
  task đã có ô chọn trạng thái riêng trên card.
- **Stage trở thành nhãn trên card**, không còn là cột. Giữ bộ lọc theo stage đang có để
  người dùng vẫn xem được task của một mục hồ sơ.
- `stage_id` là `not null` ở DB (`0013:116`) nên form thêm task vẫn phải chọn stage. Không
  đổi schema.
- `groupTasksByStatus` là logic thuần ⇒ **bắt buộc có test**: task rơi đúng cột theo status,
  cột rỗng vẫn xuất hiện đủ bốn, và thứ tự trong cột theo `position` rồi tới `title`.

## 5. WP-H — bảy mục là hồ sơ, điền lúc nào cũng được

Màn Thiết kế đổi từ "chuỗi bảy bước" thành **danh mục bảy hồ sơ cần xây dựng**.

- Bỏ nhãn **"Chưa tới lượt"**. Mỗi mục chỉ có hai trạng thái nội dung: **đã có** hoặc
  **còn thiếu**. Mục nào cũng mở được và điền được bất kỳ lúc nào.
- Hai mục có phụ thuộc thật (Methodology, Baseline) hiện lý do cụ thể thay vì nhãn thứ tự:
  "Cần khoá Standard trước vì Methodology phải thuộc một Standard" và "Form baseline sinh
  từ metric_schema của Methodology, chưa chọn thì chưa có field nào". Dùng `Locked` với
  `reason` nói đúng nguyên nhân đó.
- **Mọi khối mở sẵn**, không còn đóng theo trạng thái duyệt. Người dùng vào là thấy toàn
  cảnh hồ sơ của mình.
- Nút duyệt và checklist điều kiện **giữ nguyên** trong từng khối. Duyệt vẫn tuần tự vì DB
  cưỡng chế, nhưng nó là việc riêng của chủ dự án, không phải cổng chặn người khác điền.
  Trình bày nó như một hành động phụ, không phải trạng thái chính của khối.
- `journey-rail.tsx`: đổi cách đếm sang **số hồ sơ đã có**, không phải số bước đã duyệt.
  `tests/journey-rail.test.ts` sẽ phải đổi theo — đây là trường hợp test cũ phản ánh mô
  hình cũ, nên **được phép sửa test**, nhưng phải sửa cho đúng mô hình mới chứ không xoá ca.

## 6. Kiểm chứng

- `npm run types` và `npm run test` xanh.
- **Không được xoá ca test nào.** `tests/project-rules.test.ts` giữ nguyên. Ca của
  `journey-rail` được sửa theo mô hình mới, không được bỏ.
- Gói nào thêm logic thuần thì thêm test cho nó.

---

## 7. WP-C — trợ lý mô tả đúng mô hình mới

Đổi mô hình khái niệm mà không sửa tri thức của trợ lý là tạo ra một lỗi **đã từng xảy ra
trong chính dự án này**: khi gộp màn Khởi tạo vào Thiết kế, ngữ cảnh của trợ lý vẫn mô tả
màn cũ, nên người dùng đứng ngay trên màn có nút "Nhờ trợ lý rà soát" lại được trả lời như
thể chức năng đó ở chỗ khác. Lần này biết trước thì làm luôn.

| Gói | Sở hữu độc quyền | Người làm |
|---|---|---|
| WP-C | `src/lib/chat/knowledge.ts`, `src/lib/chat/prompt.ts` | Claude `scribe` |

**Chỉ đọc:** `src/lib/chat/tools.ts`, `src/lib/chat/handlers.ts`, `src/lib/chat/eval/**`,
và mọi file của WP-K, WP-H. Mô tả công cụ và handler là thứ quyết định hành vi gọi tool,
đổi chúng sẽ kéo theo eval fixture; nằm ngoài phạm vi đợt này.

### Nội dung cần đổi

1. **Bảy mục là hồ sơ, không phải chuỗi bước.** Mô tả phải nói rõ người dùng điền được mục
   nào vào lúc nào cũng được, trừ hai phụ thuộc dữ liệu thật ở §2.
2. **Kanban là tiến độ công việc**, cột theo trạng thái task, không phải bảy cột stage.
   `prompt.ts` hiện mô tả `/du-an/[id]` là "bảng công việc kanban bảy cột" — sai sau WP-K.
3. Giữ nguyên sự thật rằng duyệt stage vẫn tuần tự ở DB. Trợ lý không được nói người dùng
   "phải làm xong bước trước mới điền được bước sau" — đó là chỗ sai cần sửa.

### Bẫy đã biết, phải tránh

Hai test đang chốt vào chuỗi ký tự trong hai file này. Chúng đã bắt lỗi một lần rồi:

- `tests/chat.test.ts` yêu cầu ngữ cảnh màn Thiết kế chứa **`BẢY BƯỚC`** (chữ hoa).
- `tests/project-setup.test.ts` yêu cầu chứa **`không phán quyết khả thi`** (chữ thường).

Cả hai đều đáng giữ. **Sửa câu chữ cho thoả cả hai, không sửa test.**
