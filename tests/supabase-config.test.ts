import { describe, expect, it } from "vitest";
import { missingSupabaseEnv, readSupabaseConfig } from "@/lib/supabase/config";

const FULL = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xxx",
};

describe("đọc cấu hình Supabase", () => {
  it("đủ hai biến thì trả về cấu hình", () => {
    expect(readSupabaseConfig(FULL)).toEqual({
      url: "https://abc.supabase.co",
      anonKey: "sb_publishable_xxx",
    });
    expect(missingSupabaseEnv(FULL)).toEqual([]);
  });

  it("thiếu URL thì trả về null và nêu đích danh biến còn trống", () => {
    const env = { ...FULL, NEXT_PUBLIC_SUPABASE_URL: undefined };
    expect(readSupabaseConfig(env)).toBeNull();
    expect(missingSupabaseEnv(env)).toEqual(["NEXT_PUBLIC_SUPABASE_URL"]);
  });

  it("thiếu khoá thì trả về null", () => {
    const env = { ...FULL, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined };
    expect(readSupabaseConfig(env)).toBeNull();
    expect(missingSupabaseEnv(env)).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  });

  it("chuỗi rỗng cũng coi như thiếu — biến đặt nhầm thành rỗng là lỗi thường gặp", () => {
    expect(readSupabaseConfig({ ...FULL, NEXT_PUBLIC_SUPABASE_URL: "" })).toBeNull();
    expect(readSupabaseConfig({ ...FULL, NEXT_PUBLIC_SUPABASE_URL: "   " })).toBeNull();
  });

  it("thiếu cả hai thì liệt kê cả hai", () => {
    expect(missingSupabaseEnv({})).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]);
  });

  it("cắt khoảng trắng thừa hai đầu", () => {
    const cfg = readSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "  https://abc.supabase.co  ",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: " key ",
    });
    expect(cfg?.url).toBe("https://abc.supabase.co");
    expect(cfg?.anonKey).toBe("key");
  });
});
