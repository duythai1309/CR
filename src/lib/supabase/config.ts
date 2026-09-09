export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

type Env = Record<string, string | undefined>;

const KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

/**
 * Hai giá trị đọc bằng biểu thức TĨNH `process.env.NEXT_PUBLIC_...`.
 *
 * Đây là điều kiện bắt buộc, không phải sở thích viết mã. Next thay biến công khai bằng
 * cách khớp ĐÚNG dạng văn bản `process.env.NEXT_PUBLIC_TÊN` lúc build. Nó KHÔNG thay
 * được `env[k]` (khoá động) hay `env.NEXT_PUBLIC_X` khi `env` là tham số — mà trước đây
 * tệp này dùng cả hai dạng đó.
 *
 * Hậu quả đã đo được trên bundle thật: chunk trình duyệt chứa tên biến
 * (`"NEXT_PUBLIC_SUPABASE_URL"` — chuỗi trong mảng `KEYS`) nhưng KHÔNG chứa giá trị. Ở
 * trình duyệt `process.env` gần như rỗng, nên `readSupabaseConfig()` luôn trả null và
 * `createClient()` của phía client luôn ném "Thiếu biến môi trường" — kể cả khi biến đã
 * được khai báo đầy đủ. Máy chủ không dính vì ở đó `process.env` là thật.
 *
 * Vì vậy: mọi hàm dưới đây mặc định đọc qua hàm này, KHÔNG đọc thẳng `process.env`. Tham
 * số `env` vẫn giữ để kiểm thử tiêm giá trị.
 *
 * Là HÀM chứ không phải hằng ở tầm module, có chủ đích. Trên máy chủ nó đọc `process.env`
 * sống ở mỗi lần gọi, nên đổi biến trong tiến trình vẫn có hiệu lực ngay — chụp một lần
 * lúc nạp module sẽ làm hỏng đúng điều đó. Trên trình duyệt hai biểu thức đã bị thay bằng
 * chuỗi hằng lúc build, nên gọi bao nhiêu lần cũng ra cùng giá trị.
 */
function inlinedPublicEnv(): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/**
 * Các biến môi trường còn trống. Chuỗi rỗng cũng tính là trống vì đặt nhầm biến
 * thành rỗng trên bảng điều khiển là lỗi thường gặp hơn cả việc quên đặt.
 */
export function missingSupabaseEnv(env: Env = inlinedPublicEnv()): string[] {
  return KEYS.filter((k) => !env[k]?.trim());
}

export function readSupabaseConfig(env: Env = inlinedPublicEnv()): SupabaseConfig | null {
  if (missingSupabaseEnv(env).length > 0) return null;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  };
}

/** Thông báo nêu rõ thiếu gì và đặt ở đâu, thay cho lỗi khó hiểu của thư viện. */
export function missingConfigMessage(env: Env = inlinedPublicEnv()): string {
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
export function formConfigError(env: Env = inlinedPublicEnv()): string | null {
  if (missingSupabaseEnv(env).length === 0) return null;
  console.error(`[cấu hình] ${missingConfigMessage(env)}`);
  return (
    "Hệ thống chưa được cấu hình để kết nối cơ sở dữ liệu, nên chưa xử lý được " +
    "yêu cầu này. Đây là lỗi phía máy chủ, không phải do thông tin bạn vừa nhập — " +
    "vui lòng báo quản trị viên."
  );
}
