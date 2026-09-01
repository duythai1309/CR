"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { missingConfigMessage, readSupabaseConfig } from "./config";

export function createClient() {
  const config = readSupabaseConfig();
  if (!config) throw new Error(missingConfigMessage());
  return createBrowserClient<Database>(config.url, config.anonKey);
}
