import { redirect } from "next/navigation";

/**
 * Màn "Khởi tạo" cũ đã được gộp vào màn Thiết kế (`quy-trinh`).
 *
 * Trước đây người dùng điền ý tưởng, mô tả và đánh giá khả thi ở đây, rồi phải tự chuyển
 * sang tab khác mới khoá được — chính trang này từng viết ra câu "Sang tab Quy
 * trình để chọn và khoá Standard rồi Methodology". Hai màn nói về cùng bốn bước đầu là
 * một điểm gãy, không phải một lựa chọn thiết kế.
 *
 * Route được giữ lại thay vì xoá hẳn: liên kết cũ, dấu trang của người dùng và
 * `revalidatePath` trong `./actions.ts` vẫn trỏ tới đây. Form, action và data của thư mục
 * này vẫn được dùng — màn Thiết kế import chúng qua `quy-trinh/setup-blocks.tsx`.
 */
export default async function SetupRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/du-an/${id}/quy-trinh`);
}
