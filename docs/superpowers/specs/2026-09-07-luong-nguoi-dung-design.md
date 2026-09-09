# Thiết kế: tổ chức lại luồng người dùng C-route

Ngày 07/09/2026. Phương án đã duyệt: **A — một trục hành trình, ba giai đoạn**.

Tài liệu này là **hợp đồng chung** cho nhiều agent làm song song. Mọi agent phải đọc hết
phần "Ranh giới file" và "API dùng chung" trước khi sửa dòng nào.

## 1. Vấn đề

App đang tổ chức theo mô hình dữ liệu, không theo công việc người dùng. Sáu tab tương ứng
sáu nhóm bảng; công việc thật là hành trình tuyến tính khởi tạo → thiết kế bảy bước →
giám sát → báo cáo. Ba biểu hiện đo được:

| # | Triệu chứng | Bằng chứng |
|---|---|---|
| 1 | Điền một chỗ, duyệt một chỗ khác | `src/app/du-an/[id]/thiet-lap/page.tsx:16-19` tự ghi rằng khoá và duyệt nằm ở tab Quy trình |
| 2 | Tab tồn tại trước khi dùng được | `giam-sat`/`bao-cao` luôn hiện dù `methodology_locked_at` còn `null` |
| 3 | Một file gánh quá nhiều việc | `src/app/du-an/[id]/board.tsx` 930 dòng, 9 `useState`, kéo-thả + lọc + sắp xếp + chọn nhiều + trợ giúp |

## 2. Nguyên tắc bắt buộc

1. **Không giấu bước.** Tab chưa tới lượt vẫn hiển thị nhưng khoá kèm lý do. Bảy bước là
   chuẩn Verra; giấu đi sẽ phá mô hình nhận thức của người làm nghề.
2. **Không tạo đường tắt qua DB.** Mọi lượt duyệt vẫn đi qua `approve_project_stage`; mọi
   lượt khoá vẫn qua RPC hiện có. Giao diện đổi, luật không đổi.
3. **Không sửa logic nghiệp vụ.** `src/components/project/rules.ts` là **chỉ đọc** với mọi
   agent. Cần hành vi mới thì báo, không tự thêm.
4. **Không đổi bảng màu.** Token `soil`/`forest`/`mint`/`leaf`/`carbon` trong
   `src/app/globals.css` giữ nguyên. Nâng thị giác nghĩa là nhịp khoảng cách, phân cấp chữ
   và trạng thái, không phải màu mới.
5. **Không chạm `supabase/`, `tests/e2e/`, `src/types/database.ts`.**

## 3. API dùng chung (WP0 — làm trước, đã cố định)

Bổ sung vào `src/components/ui.tsx`. Mọi agent code theo đúng chữ ký này, không tự định
nghĩa biến thể riêng.

```ts
// Empty: thêm `action` để trạng thái rỗng luôn có lối đi tiếp.
export function Empty(props: { title: string; hint?: ReactNode; action?: ReactNode }): JSX.Element;

// Locked: màn/khối chưa dùng được, BẮT BUỘC nêu lý do và điều kiện mở.
export function Locked(props: { title: string; reason: string; unlock?: ReactNode }): JSX.Element;

// NextAction: "việc cần làm tiếp theo" thành thành phần hạng nhất.
export function NextAction(props: { label: string; href: string; note?: ReactNode }): JSX.Element;

// SectionHeader: phân cấp chữ thống nhất trong một trang.
export function SectionHeader(props: { title: string; description?: ReactNode; aside?: ReactNode }): JSX.Element;
```

`src/components/project/project-tabs.tsx` mở rộng props:

```ts
tabs: Array<{ slug: string; label: string; locked?: boolean; lockReason?: string }>
```

Tab `locked` render thành `<span>` thay vì `<Link>`, kèm `aria-disabled="true"` và
`title={lockReason}`. Không dùng `pointer-events:none` để vẫn đọc được lý do.

## 4. Ranh giới file — mỗi gói việc sở hữu độc quyền

| Gói | Sở hữu | Người làm |
|---|---|---|
| WP0 | `src/components/ui.tsx`, `src/components/project/project-tabs.tsx` | Claude (xong trước khi thả agent) |
| WP1 | `src/app/du-an/[id]/layout.tsx`, `src/components/project/journey-rail.tsx` (mới) | Claude |
| WP2 | `src/app/du-an/[id]/thiet-lap/**`, `src/app/du-an/[id]/quy-trinh/**` | Claude |
| WP3 | `src/app/du-an/[id]/board.tsx`, `src/components/project/board/**` (mới) | Codex `coder` |
| WP4 | `src/app/du-an/[id]/giam-sat/page.tsx`, `src/app/du-an/[id]/bao-cao/page.tsx` | Claude, sau WP1 |
| WP5 | `src/app/dang-ky/**`, `src/app/dang-nhap/**`, `src/app/du-an/page.tsx` | Codex `coder2` |

Không gói nào được sửa file của gói khác. Cần thay đổi ngoài phạm vi thì **dừng và báo**.

## 5. Nội dung từng gói

### WP1 — Vỏ dự án theo giai đoạn

Sáu tab phẳng thành hai nhóm: ba tab **hành trình** (Thiết kế · Giám sát · Báo cáo) và hai
tab **công cụ** (Bảng công việc · Thành viên). `journey-rail.tsx` hiện dự án đang ở giai
đoạn nào và rào đầu tiên là gì, dùng `approvalBlockers`/`approvedCount`/`nextStageToApprove`
sẵn có trong `rules.ts`. Giám sát khoá khi `methodology_locked_at` null; Báo cáo khoá khi
chưa có kỳ nào `locked`.

### WP2 — Gộp Khởi tạo + Bảy bước thành "Thiết kế"

Một màn duy nhất: điền, khoá, duyệt tại chỗ. Route `thiet-lap` giữ nguyên đường dẫn để
không phá liên kết cũ; `quy-trinh` chuyển hướng sang nó. Mỗi bước là một khối gập được, mở
sẵn ở bước đang làm. Checklist điều kiện duyệt và nút duyệt nằm trong cùng khối với form
của bước đó.

### WP3 — Tách `board.tsx`

Refactor thuần, **không đổi hành vi**. Tách theo trách nhiệm thành `src/components/project/board/`:
lọc/sắp xếp, kéo-thả, chọn nhiều, thanh công cụ, thẻ công việc. `board.tsx` còn lại chỉ
lắp ráp. Không đổi props công khai của `ProjectBoard`. Test hiện có phải xanh nguyên.

### WP4 — Khoá có lý do cho Giám sát và Báo cáo

Thay `Alert` cảnh báo hiện tại bằng `Locked` nêu rõ điều kiện mở và liên kết tới đúng bước
còn thiếu. Chuẩn hoá trạng thái rỗng bằng `Empty` có `action`.

### WP5 — Onboarding

`dang-ky` → `dang-nhap` → danh mục rỗng → dự án đầu tiên. Danh mục rỗng phải nói được ba
điều: đây là gì, tạo dự án đầu tiên ra sao, và điều gì xảy ra sau khi tạo. Dùng `Empty` có
`action`. Không thêm bước mới vào đăng ký.

## 6. Kiểm chứng

Mỗi gói tự chịu trách nhiệm:

- `npm run types` xanh.
- `npm run test` xanh — **348 test hiện có không được đỏ dòng nào**.
- Gói nào đổi logic thuần thì bổ sung test trong `tests/`, không sửa test cũ để nó xanh.

Không gói nào được tuyên bố xong khi chưa chạy hai lệnh trên và dán kết quả.

---

# Phụ lục — vòng 2: hoàn thiện phần còn thiếu

Viết sau khi rà lại kết quả vòng 1. Vòng 1 làm xong bốn gói được giao, nhưng bốn khoảng
trống dưới đây vẫn còn, và một trong số đó là lỗi do chính vòng 1 gây ra.

## Ranh giới file vòng 2

| Gói | Sở hữu độc quyền | Người làm |
|---|---|---|
| WP6 | `src/lib/chat/prompt.ts`, `src/lib/chat/knowledge.ts` | Claude |
| WP7 | `src/app/du-an/[id]/cong-viec/**`, `src/app/du-an/[id]/thanh-vien/**` | Codex `coder` |
| WP8 | `src/app/du-an/[id]/giam-sat/[periodId]/**`, `src/app/du-an/[id]/bao-cao/[reportId]/**` | Codex `coder2` |
| WP9 | không sửa file — đi hết luồng bằng trình duyệt | Claude |

`src/components/ui.tsx`, `src/components/project/rules.ts`, `src/app/du-an/[id]/layout.tsx`
và mọi file của vòng 1 là **chỉ đọc** với WP7 và WP8.

## WP6 — trợ lý mô tả đúng màn Thiết kế đã gộp

Vòng 1 gộp màn Khởi tạo vào `/quy-trinh`, nhưng không cập nhật tri thức của trợ lý:

- `prompt.ts:33` còn khớp `/thiet-lap`, route nay chỉ redirect nên không ai đứng ở đó.
- `prompt.ts:38` mô tả `/quy-trinh` chỉ gồm khoá Standard/Methodology, baseline,
  additionality, tài liệu — **thiếu** ý tưởng, mô tả, đánh giá khả thi và gợi ý
  Standard/Methodology vốn đã chuyển sang màn này.
- `knowledge.ts:75` mô tả thiếu tương tự.

Ràng buộc: `tests/chat.test.ts:62` và `src/lib/chat/eval/fixture.ts` chốt vào đường dẫn
`/du-an/[id]/quy-trinh`. Đường dẫn KHÔNG được đổi; chỉ phần mô tả được sửa.

## WP7, WP8 — bốn màn cấp hai trong luồng dự án

Bốn màn này nằm giữa luồng nhưng vòng 1 không chạm tới, nên trải nghiệm mới đứt quãng
ngay khi người dùng đi sâu hơn một cấp. Yêu cầu chung:

1. Trạng thái rỗng phải có lối đi tiếp — `Empty` với prop `action`. Đã biết một chỗ thiếu:
   `giam-sat/[periodId]/page.tsx:264`.
2. Khối chưa dùng được phải dùng `Locked` nêu lý do và điều kiện mở, không dùng `Alert`.
   Giữ `Alert` cho cảnh báo thật sự là cảnh báo.
3. Mọi liên kết dẫn người dùng đi khắc phục trỏ tới `/du-an/[id]/quy-trinh#buoc-N`.
   KHÔNG trỏ `/thiet-lap` — route đó chỉ còn là redirect.
4. Phân cấp chữ trong trang dùng `SectionHeader`.
5. Không thêm màu mới; token `soil`/`forest`/`mint`/`leaf`/`carbon` là đủ.
6. Không đổi logic nghiệp vụ, không đổi truy vấn, không nới quyền.

## WP9 — đi hết luồng bằng mắt

Đưa một dự án `E2E-TEST-*` qua bước 3 và 4, rồi đi tiếp Giám sát → Báo cáo, chụp lại từng
màn. Chỉ dùng dự án thử nghiệm: khoá Standard và Methodology là **một chiều**, cơ sở dữ
liệu từ chối mọi lượt đổi sau đó.

## Kiểm chứng vòng 2

Không đổi so với §6: `npm run types` và `npm run test` phải xanh, **354 test hiện có không
được đỏ dòng nào**. Gói nào đổi logic thuần thì bổ sung test.

## WP10 — hai trạng thái rỗng còn sót

| Gói | Sở hữu độc quyền | Người làm |
|---|---|---|
| WP10 | `src/components/project/portfolio.tsx`, `src/app/quan-tri/catalog/page.tsx` | Codex `coder` |

Hai chỗ này nằm ngoài phạm vi WP1–WP9 nên vẫn còn `Empty` không có `action`:

- `src/components/project/portfolio.tsx:185` — bảng danh mục dự án khi bộ lọc không khớp
  dòng nào. Khác với danh mục trống thật: ở đây người dùng CÓ dự án, chỉ là bộ lọc đang
  giấu hết. Lối đi tiếp đúng là xoá bộ lọc, không phải tạo dự án mới.
- `src/app/quan-tri/catalog/page.tsx:72` — màn quản trị catalog methodology.

Cùng ràng buộc §2 và §3. Không đổi logic lọc, không đổi truy vấn, không thêm màu.
