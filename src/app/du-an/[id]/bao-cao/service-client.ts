import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "@/lib/supabase/config";

/**
 * Client backend cho ĐÚNG MỘT việc: gọi `create_mrv_report`.
 *
 * `0013_project_platform.sql:994-995` cố ý chỉ cấp RPC đó cho `service_role`, không cấp
 * cho `authenticated` — vì nó nhận `p_requested_by` như một tham số, nên bất kỳ ai gọi
 * được cũng ghi được báo cáo dưới tên người khác. Ranh giới an toàn nằm ở chỗ **chỉ máy
 * chủ gọi nó, sau khi đã tự xác thực người dùng**.
 *
 * Vì vậy mọi lời gọi phải theo đúng trình tự này, không được rút gọn:
 *   1. `requireProjectMember(projectId)` bằng PHIÊN của người dùng.
 *   2. Đọc kỳ và dữ liệu bằng client của NGƯỜI DÙNG — để RLS vẫn là thứ quyết định.
 *   3. Tính bằng hàm thuần.
 *   4. Chỉ bước ghi cuối cùng mới dùng client này, và `p_requested_by` lấy từ phiên đã
 *      xác thực ở bước 1, không bao giờ từ dữ liệu người dùng gửi lên.
 *
 * Cố ý KHÔNG tái dùng `src/lib/supabase/admin.ts`: tệp đó ghi rõ nó tồn tại cho đúng một
 * việc khác (đọc `chat_settings.api_key`), và nới phạm vi của nó là cách một client bỏ
 * qua RLS lan ra khắp mã nguồn.
 *
 * Thiếu khoá thì trả null chứ không ném lỗi — phần còn lại của nền tảng vẫn chạy, chỉ
 * riêng việc sinh báo cáo báo là chưa cấu hình.
 */
export function createReportClient(): SupabaseClient | null {
  const config = readSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceKey) return null;

  return createSupabaseClient(config.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function missingServiceKeyMessage(): string {
  return (
    "Chưa sinh được báo cáo vì máy chủ chưa có SUPABASE_SERVICE_ROLE_KEY. " +
    "Việc ghi báo cáo bắt buộc đi qua vai trò máy chủ để không ai ghi được báo cáo dưới " +
    "tên người khác. Người vận hành cần đặt biến môi trường này ở phía máy chủ."
  );
}
