import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hồi quy cho sự cố production ngày 01/9/2026: trang /dang-nhap mở được bình
 * thường vì lúc dựng trang nó không chạm Supabase, nhưng vừa bấm nút đăng nhập
 * là server action gọi createClient() rồi ném lỗi thiếu cấu hình. Lỗi không bắt
 * trong server action khiến Next.js thay cả trang bằng màn hình trắng kèm mã
 * Digest, không nói được gì cho người dùng lẫn người vận hành.
 *
 * Test gọi thẳng action nên không phụ thuộc giao thức nội bộ của Next.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("server action khi thiếu cấu hình Supabase", () => {
  it("đăng nhập trả về thông báo thay vì ném lỗi làm trắng trang", async () => {
    const { signIn } = await import("@/app/auth-actions");
    const result = await signIn(null, form({ email: "a@b.co", password: "MatKhau12345" }));

    expect(result).toMatch(/chưa được cấu hình/i);
    // Không rò tên biến môi trường ra trước mặt người dùng cuối.
    expect(result).not.toContain("NEXT_PUBLIC_");
  });

  it("đăng ký cũng trả về thông báo, và chắn trước khi kiểm tra mật khẩu", async () => {
    const { signUp } = await import("@/app/auth-actions");
    // Mật khẩu ngắn: nếu chắn cấu hình nằm sau, ta sẽ nhận thông báo mật khẩu.
    const result = await signUp(null, form({ email: "a@b.co", password: "x", role: "buyer" }));

    expect(result).toMatch(/chưa được cấu hình/i);
  });

  it("đăng xuất đưa về trang chủ thay vì đổ lỗi", async () => {
    const { signOut } = await import("@/app/auth-actions");
    await expect(signOut()).rejects.toThrow("REDIRECT:/");
  });

  it("chi tiết thiếu biến nào vẫn được ghi vào log máy chủ", async () => {
    const { signIn } = await import("@/app/auth-actions");
    await signIn(null, form({ email: "a@b.co", password: "MatKhau12345" }));

    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(logged).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});
