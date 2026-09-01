import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { readSupabaseConfig } from "./config";

/**
 * Client chạy bằng service role — BỎ QUA TOÀN BỘ RLS.
 *
 * Toàn bộ phần còn lại của nền tảng cố tình không dùng đến nó: mọi truy vấn đi bằng
 * phiên đăng nhập của người dùng để Postgres tự chặn phần ngoài phạm vi. Client này
 * tồn tại cho ĐÚNG MỘT việc: đọc cột `chat_settings.api_key`, cột duy nhất không cấp
 * quyền đọc cho vai trò ứng dụng nào.
 *
 * Không dùng nó ở bất kỳ chỗ nào khác. Mỗi lần dùng thêm là một chỗ mà lỗi lập trình
 * biến thành lỗ rò dữ liệu, vì không còn lớp nào đỡ phía dưới.
 *
 * Thiếu khoá thì trả về null chứ không ném lỗi — hệ thống vẫn chạy, chỉ là cấu hình
 * trợ lý rơi về lớp biến môi trường.
 */
export function createServiceClient(): SupabaseClient<Database> | null {
  const config = readSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceKey) return null;

  return createSupabaseClient<Database>(config.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
