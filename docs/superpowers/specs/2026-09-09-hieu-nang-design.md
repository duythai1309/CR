# Thiết kế: giảm độ trễ trang và làm mượt thao tác

Ngày 09/09/2026. Hai triệu chứng, hai nguyên nhân khác nhau. Đã đo trước khi sửa.

## 1. Nguyên nhân đã xác định

### 1.1 Truy vấn trùng mỗi lần render

`src/lib/auth.ts` có 10 hàm đọc dữ liệu, `src/app/du-an/data.ts` có 13, **không hàm nào
được bọc `cache()` của React**. Layout và page mỗi bên tự truy vấn, nên một lần mở
`/du-an/[id]` chạy trùng bốn truy vấn:

```
layout:  getProfile · app_project_role · getProject · getStages · support
page:    getProfile · app_project_role · getProject · getStages · tasks · members · boardColumns
```

Client Supabase **không** được Next gộp tự động như `fetch`. Trên Vercel mỗi vòng đi qua
mạng thật, nên bốn vòng thừa cộng thẳng vào thời gian mở trang.

### 1.2 Không có cập nhật lạc quan

`src/app/du-an/[id]/actions.ts:33-36` gọi `revalidatePath` hai lần sau mỗi thao tác. Kéo
một card sẽ: server action → ghi Supabase → revalidate → render lại toàn trang → tải lại
cả 11 truy vấn → mới thấy card di chuyển. `useTransition` có nhưng chỉ giữ giao diện
không đơ, **không** làm card nhúc nhích sớm hơn.

Không có `useOptimistic` ở bất kỳ đâu.

## 2. Ranh giới file

| Gói | Sở hữu độc quyền | Người làm |
|---|---|---|
| WP-PERF-SSR | `src/lib/auth.ts`, `src/app/du-an/data.ts`, `src/app/du-an/[id]/data.ts` | Codex `coder` |
| WP-PERF-UX | `src/components/project/board/use-board-actions.ts`, `src/components/project/board/drag-drop.tsx`, `src/app/du-an/[id]/board.tsx`, `src/app/du-an/[id]/actions.ts` | Claude `scribe` |

Chỉ đọc với cả hai: `supabase/**`, `src/lib/chat/**`, `src/components/ui.tsx`,
`src/components/project/rules.ts`, mọi test hiện có.

## 3. WP-PERF-SSR — gộp truy vấn trùng

Bọc `cache()` từ `react` cho các hàm đọc **không tham số hoặc tham số ổn định trong một
lần render**: `getProfile`, `getProjectRole`, `getProject`, `getStages`, `getStandard`,
`getMethodology`, và các hàm đọc tương tự.

Ràng buộc:

1. **Chỉ bọc hàm ĐỌC.** Tuyệt đối không bọc hàm ghi, không bọc hàm có tác dụng phụ.
   `cache()` gộp theo tham số trong phạm vi một lần render — bọc nhầm hàm ghi sẽ nuốt mất
   lệnh ghi thứ hai.
2. `cache()` của React **chỉ gộp trong một lần render**, không phải cache qua các request.
   Không dùng nó thay cho `unstable_cache`, và không đặt thời gian sống.
3. Không đổi chữ ký hàm, không đổi kiểu trả về, không đổi hành vi khi thiếu cấu hình.
4. `requireProfile` gọi `redirect` và `requireProjectMember` gọi `notFound` — **không bọc
   hai hàm này**, chỉ bọc các hàm đọc thuần bên dưới chúng.

Sau khi sửa, **đếm lại** số truy vấn trùng và báo con số trước/sau.

## 4. WP-PERF-UX — làm mượt thao tác

1. **`useOptimistic` cho thao tác card**: đổi cột, đổi trạng thái, sắp xếp lại. Giao diện
   phản hồi ngay, server action chạy nền, lỗi thì trả về trạng thái cũ kèm thông báo đọc
   được. Không được nuốt lỗi.
2. **Thu hẹp `revalidatePath`.** Hiện gọi hai lần, một trong đó dùng `"layout"` nên kéo
   theo toàn bộ cây layout. Rà lại xem thao tác nào thật sự cần revalidate cái gì.
3. Không đổi đường ghi thật, không đổi RLS, không nới quyền.

## 5. Kiểm chứng

- `npm run types` và `npm run test` xanh, **không xoá ca test nào**.
- Logic thuần mới thêm phải có test.
- WP-PERF-UX phải chứng minh: khi server action lỗi, giao diện quay về đúng trạng thái cũ.
  Đây là chỗ cập nhật lạc quan hay hỏng nhất, nên bắt buộc có test cho nó.
