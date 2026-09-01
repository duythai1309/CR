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
