import { describe, expect, it } from "vitest";
import { formConfigError, missingSupabaseEnv, readSupabaseConfig } from "@/lib/supabase/config";

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

describe("chắn lỗi cấu hình cho biểu mẫu công khai", () => {
  it("đủ cấu hình thì không có lỗi", () => {
    expect(formConfigError(FULL)).toBeNull();
  });

  it("thiếu cấu hình thì trả về thông báo hiện được trên biểu mẫu", () => {
    const msg = formConfigError({});
    expect(msg).toBeTruthy();
    // Người dùng cuối cần biết đây là lỗi cấu hình phía máy chủ, không phải họ
    // gõ sai mật khẩu — nhưng không cần nhìn thấy tên biến môi trường.
    expect(msg).not.toContain("NEXT_PUBLIC_");
    expect(msg).toMatch(/chưa được cấu hình/i);
  });

  it("biến để rỗng cũng tính là thiếu", () => {
    expect(formConfigError({ ...FULL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "  " })).toBeTruthy();
  });
});
