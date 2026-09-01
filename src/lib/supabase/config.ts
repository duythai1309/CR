export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

type Env = Record<string, string | undefined>;

const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

/**
 * Các biến môi trường còn trống. Chuỗi rỗng cũng tính là trống vì đặt nhầm biến
 * thành rỗng trên bảng điều khiển là lỗi thường gặp hơn cả việc quên đặt.
 */
export function missingSupabaseEnv(env: Env = process.env): string[] {
  return KEYS.filter((k) => !env[k]?.trim());
}

export function readSupabaseConfig(env: Env = process.env): SupabaseConfig | null {
  if (missingSupabaseEnv(env).length > 0) return null;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  };
}

/** Thông báo nêu rõ thiếu gì và đặt ở đâu, thay cho lỗi khó hiểu của thư viện. */
export function missingConfigMessage(env: Env = process.env): string {
  const missing = missingSupabaseEnv(env);
  return (
    `Thiếu biến môi trường: ${missing.join(", ")}. ` +
    `Khi chạy máy cá nhân thì đặt trong .env.local; khi chạy trên Vercel thì đặt ở ` +
    `Project Settings → Environment Variables, rồi deploy lại để giá trị mới có hiệu lực.`
  );
}

/**
 * Lỗi cấu hình ở dạng hiển thị được ngay trên biểu mẫu công khai, hoặc null nếu
 * cấu hình đã đủ.
 *
 * Trang đăng nhập và đăng ký không chạm tới Supabase lúc dựng trang, nên chúng
 * vẫn mở được bình thường khi thiếu biến môi trường — chỉ tới lúc bấm nút thì
 * server action mới gọi createClient() và ném lỗi, và một lỗi không bắt trong
 * server action làm Next.js thay cả trang bằng màn hình trắng kèm mã Digest.
 * Người dùng không hiểu chuyện gì xảy ra, còn người vận hành thì phải đi mò log.
 *
 * Thông báo này cố ý không nêu tên biến môi trường: người đang đứng trước biểu
 * mẫu không sửa được chúng. Chi tiết đầy đủ ghi vào log máy chủ.
 */
export function formConfigError(env: Env = process.env): string | null {
  if (missingSupabaseEnv(env).length === 0) return null;
  console.error(`[cấu hình] ${missingConfigMessage(env)}`);
  return (
    "Hệ thống chưa được cấu hình để kết nối cơ sở dữ liệu, nên chưa xử lý được " +
    "yêu cầu này. Đây là lỗi phía máy chủ, không phải do thông tin bạn vừa nhập — " +
    "vui lòng báo quản trị viên."
  );
}
