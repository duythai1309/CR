import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Vitest không tự nạp .env.local, nên đọc trực tiếp.
 *
 * Đọc xong thì đổ vào `process.env` cho biến nào chưa có, vì các tệp test quyết định
 * skip ngay lúc import bằng `process.env` (ví dụ `SUPABASE_SERVICE_ROLE_KEY` cho hai ca
 * sinh báo cáo MRV). Trước đây hàm này chỉ trả về hai biến NEXT_PUBLIC_*, nên khoá có
 * trong .env.local mà `skipIf` vẫn bật — ca test bị bỏ qua trong im lặng và trông hệt
 * như "chưa cấu hình". Biến đặt sẵn ở shell được ưu tiên, không ghi đè.
 */
function env(): { url: string; key: string } {
  const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const vars = Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
  for (const [name, value] of Object.entries(vars)) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
  return { url: vars.NEXT_PUBLIC_SUPABASE_URL, key: vars.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}

/** Nạp .env.local ngay lúc import, trước khi tệp test đọc `process.env` ở tầng module. */
env();

/** Client đã đăng nhập, dùng khoá công khai nên chịu đúng ràng buộc RLS như trình duyệt. */
export async function signedIn(email: string, password: string): Promise<SupabaseClient<Database>> {
  const { url, key } = env();
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Không đăng nhập được ${email}: ${error.message}`);
  return sb;
}

/** Ô vuông cạnh `size` độ, góc dưới trái tại (lng, lat). */
export function square(lng: number, lat: number, size: number) {
  return {
    type: "Polygon" as const,
    coordinates: [[
      [lng, lat],
      [lng + size, lat],
      [lng + size, lat + size],
      [lng, lat + size],
      [lng, lat],
    ]],
  };
}
