import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { missingConfigMessage, readSupabaseConfig } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  const config = readSupabaseConfig();
  if (!config) throw new Error(missingConfigMessage());

  return createServerClient<Database>(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component không ghi được cookie; middleware đã lo việc làm mới phiên.
          }
        },
      },
    },
  );
}
