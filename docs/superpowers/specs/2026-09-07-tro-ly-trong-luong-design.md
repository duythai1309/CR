# Thiết kế: đưa trợ lý vào sâu trong từng luồng người dùng

Ngày 07/09/2026. Đợt 1: **Baseline · Giám sát · Báo cáo MRV**.

## 1. Điểm xuất phát

Trợ lý đã có **14 công cụ** đọc được dữ liệu thật (`src/lib/chat/tools.ts`), nhưng chỉ
dùng được nếu người dùng tự mở khung chat và tự nghĩ ra câu hỏi. Tại chỗ trong luồng, mới
có hai điểm cắm: `runFeasibilityAssist` (bước 2) và `runSelectionAdvice` (bước 3–4).

Ba điểm dưới đây đã có sẵn dữ liệu và handler, chỉ thiếu một nút ở đúng nơi người dùng
đang bí.

## 2. Khuôn bắt buộc — sao chép, không phát minh lại

Đọc `src/app/du-an/[id]/thiet-lap/actions.ts:166-212` trước khi viết dòng nào. Mọi assist
mới phải đi đúng chuỗi này:

```
requireProjectMember(projectId, "developer")   ← quyền thật, không tự kiểm bằng tay
→ đọc trạng thái thật từ DB
→ loadChatConfig(supabase)                     ← thiếu khoá thì trả missingKeyMessage()
→ HANDLERS.<tên_công_cụ>(...)                  ← DỮ LIỆU CHỈ ĐẾN TỪ HANDLER CÓ SẴN
→ runSetupJsonTurn(client, SYSTEM, payload)    ← model chỉ diễn giải trên payload đó
→ parse<X>(answer, ...ràng buộc)               ← parser cưỡng chế, model không bịa thêm được
→ ghi có khoá lạc quan theo updatedAt
```

Điểm cốt tử: **model không bao giờ tự truy vấn dữ liệu.** Nó chỉ nhận payload do handler
dựng sẵn. Parser phải loại bỏ mọi trường model bịa ra ngoài allowlist.

## 3. Ranh giới nội dung — quyết định của chủ sản phẩm

Trợ lý **được phép soạn bản nháp** để người dùng sửa. Kèm ba ràng buộc bắt buộc:

1. **Bản nháp không bao giờ ghi thẳng vào dữ liệu thật.** Nó vào một ô nháp riêng, người
   dùng phải bấm chấp nhận thì mới thành dữ liệu. Baseline không phải văn xuôi — nó là số
   liệu nuôi phép tính MRV, nên máy ghi thẳng vào `projects.baseline` là không chấp nhận
   được.
2. **Mọi bản nháp phải mang provenance**: thời điểm sinh, ai bấm sinh, và một câu nói rõ
   đây là nội dung do máy sinh chưa được thẩm định.
3. **Không lật bất kỳ cờ thẩm định nào.** `professionally_validated` và điều kiện chặn
   báo cáo `final` ở DB giữ nguyên, không đụng tới.

## 4. Ranh giới file

| Gói | Sở hữu độc quyền | Người làm |
|---|---|---|
| WP-A | `src/types/project-setup.ts`, `src/app/du-an/[id]/quy-trinh/actions.ts`, `src/app/du-an/[id]/quy-trinh/forms.tsx`, `src/app/du-an/[id]/quy-trinh/page.tsx` | Codex |
| WP-B | `src/app/du-an/[id]/giam-sat/[periodId]/**`, `src/app/du-an/[id]/bao-cao/[reportId]/**` | Codex |

**Chỉ đọc, không sửa:** `src/lib/chat/**` (handler và công cụ đã có, dùng lại nguyên trạng),
`src/components/ui.tsx`, `src/components/project/rules.ts`, `supabase/**`,
`src/types/database.ts`, mọi file test hiện có.

## 5. Ba điểm cần dựng

### 5.1 Baseline (bước 5) — WP-A

Nút **"Nhờ trợ lý soạn nháp baseline"** trong khối bước 5, cạnh `BaselineForm`.

- Dữ liệu: `HANDLERS.kiem_tra_baseline` (đang thiếu field nào, sai gì) và
  `HANDLERS.field_giam_sat_cua_methodology` (định nghĩa từng field, đơn vị, phạm vi).
- Model đề xuất **giá trị nháp cho từng field baseline còn trống**, kèm một câu lý do và
  nguồn suy ra. Không đề xuất field ngoài schema.
- Parser bắt buộc: loại mọi field không có trong `metric_schema`; loại mọi giá trị không
  parse được thành số theo `decimal_encoding`; giữ nguyên field người dùng đã tự điền.
- Lưu vào `ProjectSetup.baseline_draft` (khoá mới, phải bổ sung type). **Không** chạm
  `projects.baseline`.
- Giao diện hiện bảng nháp cạnh form thật, mỗi dòng có nút chép sang ô nhập tương ứng.
  Người dùng vẫn phải bấm "Lưu baseline" như cũ — đường ghi thật không đổi.

### 5.2 Giám sát (một kỳ) — WP-B

Nút **"Nhờ trợ lý rà soát kỳ này"** trong `giam-sat/[periodId]`.

- Dữ liệu: `HANDLERS.tom_tat_du_lieu_giam_sat`.
- Trợ lý chỉ ra: record nào thiếu field, field nào lỗi và lỗi gì, cảnh báo chất lượng dữ
  liệu, và vì sao kỳ chưa khoá được. Đây là chẩn đoán, **không sinh số liệu**.
- **Đính chính so với bản đầu:** bản đầu yêu cầu cả "giá trị lệch bất thường so với
  baseline". Yêu cầu đó sai vì `tom_tat_du_lieu_giam_sat` (`handlers.ts:994`) không trả về
  dữ liệu đối chiếu baseline. Đáp ứng nó sẽ buộc phải sửa handler hoặc cho model nhìn dữ
  liệu ngoài payload — cả hai đều phá khuôn ở §2. Yêu cầu đã được thu hẹp về đúng những gì
  handler thật sự cung cấp.
- Không cần lưu; hiện kết quả tại chỗ trong phiên.

### 5.3 Báo cáo MRV — WP-B

Nút **"Giải thích con số này"** trong `bao-cao/[reportId]`.

- Dữ liệu: `HANDLERS.doc_vet_tinh_bao_cao`.
- Trợ lý diễn giải vết tính thành lời: giá trị nào nhân với hệ số nào, đơn vị triệt tiêu
  ra sao, kết quả đến từ record nào. **Không tính lại và không đưa ra con số mới** — mọi
  số phải trích từ vết tính do handler trả về.
- Không lưu; hiện tại chỗ.

## 6. Yêu cầu chung cho cả ba

- Thiếu `GEMINI_API_KEY` thì nút tự tắt kèm lời nhắc, phần còn lại của trang vẫn chạy.
  Bắt chước cách `FeasibilityPanel` đang xử lý.
- Trạng thái đang chạy phải nhìn thấy được; không để người dùng bấm hai lần.
- Lỗi từ model hoặc parser trả về câu tiếng Việt đọc được, không phải stack trace.
- Dùng `SectionHeader`, `Empty` (có `action`), `Locked`, `Alert` đã có trong `ui.tsx`.
  Không thêm màu ngoài token `soil`/`forest`/`mint`/`leaf`/`carbon`.
- Mỗi khối kết quả phải hiện rõ dòng: nội dung do máy sinh, chưa được thẩm định.

## 7. Kiểm chứng

- `npm run types` và `npm run test` xanh, **354 test hiện có không được đỏ dòng nào**.
- Parser của baseline draft là logic thuần ⇒ **bắt buộc có test** trong `tests/`: ít nhất
  ca model trả field ngoài schema, ca trả giá trị không phải số, ca trả rỗng, và ca ghi đè
  nhầm field người dùng đã điền.
- Không sửa test cũ để nó xanh. Test cũ đỏ nghĩa là code sai, không phải test sai.

---

## 8. Phụ lục — migration 0020 cho `baseline_draft`

`coder` dừng WP-A và báo đúng: `project_validate_setup()` ở
`supabase/migrations/0017_project_setup.sql:41-45` chỉ cho phép bốn khoá
`('idea','description','feasibility','selection_advice')`, nên `baseline_draft` bị DB từ
chối. Đây là lỗi của bản thiết kế này, không phải của người thực thi.

Chủ sản phẩm đã chọn: **viết migration 0020 mở whitelist, nhưng siết ngay tại DB.**

### 8.1 Tinh thần phải giữ

Trigger 0017 dòng 51–58 cố ý cấm mọi khoá phán quyết máy đọc trong `feasibility`, kèm câu
giải thích rằng kết luận là việc của chuyên gia. 0020 **mở rộng chỗ chứa, không nới lỏng
nguyên tắc đó.** Nếu 0020 làm cho nội dung máy sinh dễ trở thành hồ sơ chính thức hơn thì
nó viết sai.

### 8.2 Điều 0020 phải cưỡng chế

Sửa `project_validate_setup()` bằng `create or replace`, thêm `'baseline_draft'` vào
whitelist, và thêm khối kiểm riêng cho nó:

1. `baseline_draft` phải là object.
2. **Bắt buộc có provenance**: `generated_at` kiểu string và `generated_by` kiểu string.
   Thiếu một trong hai thì `raise exception`. Không có provenance thì bản nháp trở thành
   nội dung vô chủ trong hồ sơ.
3. **Bắt buộc có `disclaimer`** kiểu string, không rỗng sau khi trim.
4. `values` nếu có phải là object.
5. **Cấm mọi khoá phán quyết**, đúng danh sách của `feasibility` cộng thêm:
   `('verdict','feasible','is_feasible','score','rating','conclusion','decision',
   'approved','validated','final')`. Thông báo lỗi phải nói rõ vì sao, theo đúng giọng
   thông báo hiện có ở dòng 54–57.
6. Giới hạn kích thước riêng cho `baseline_draft`: không quá 20000 ký tự khi ép về text.

Không đụng bất kỳ phần nào khác của hàm. Không đổi `projects.baseline`. Không đổi
`professionally_validated`. Không đổi bất kỳ policy nào.

### 8.3 Đường lui

Kèm `supabase/rollback/0020_down.sql` khôi phục **nguyên văn** `project_validate_setup()`
từ `0017_project_setup.sql`, chép từ file chứ không viết lại từ trí nhớ, và ghi comment
nêu rõ nguồn dòng. Nêu thẳng trong comment: rollback không xoá dữ liệu `baseline_draft` đã
ghi, nên phải dọn trước khi hạ cấp nếu không muốn dữ liệu đó chặn trigger cũ.

### 8.4 Ai áp migration

Codex **chỉ viết file**, không áp. Việc áp lên Supabase do Claude làm sau khi review, theo
đúng quy trình đã dùng cho 0018 và 0019: viết đường lui trước, review, rồi mới áp.

### 8.5 Ranh giới file bổ sung cho WP-A

Thêm vào quyền sửa của WP-A: `supabase/migrations/0020_baseline_draft.sql` và
`supabase/rollback/0020_down.sql`. **Không** được sửa 0001–0019.
