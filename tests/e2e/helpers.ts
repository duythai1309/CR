import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Vitest không tự nạp .env.local, nên đọc trực tiếp. */
function env(): { url: string; key: string } {
  const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const vars = Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
  return { url: vars.NEXT_PUBLIC_SUPABASE_URL, key: vars.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}

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
