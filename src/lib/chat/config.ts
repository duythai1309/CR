export interface ChatConfig {
  apiKey: string;
  model: string;
}

type Env = Record<string, string | undefined>;

/**
 * Model mặc định. Đặt ở biến môi trường được để đổi sang bản mới hoặc hạ xuống bản
 * rẻ hơn mà không phải build lại mã.
 */
export const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Thiếu khoá thì trợ lý tự tắt chứ không làm sập trang. Toàn bộ phần còn lại của
 * nền tảng không phụ thuộc vào chatbot, nên một biến môi trường quên đặt không được
 * phép kéo theo màn hình trắng ở chỗ khác.
 */
export function readChatConfig(env: Env = process.env): ChatConfig | null {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, model: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL };
}

export function missingChatConfigMessage(): string {
  return (
    "Trợ lý chưa hoạt động vì thiếu GEMINI_API_KEY. " +
    "Khi chạy máy cá nhân thì đặt trong .env.local; khi chạy trên Vercel thì đặt ở " +
    "Project Settings → Environment Variables, rồi deploy lại."
  );
}
