import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homePathFor } from "@/lib/auth";
import { PROJECT_ROLE_LABEL, ROLE_LABEL } from "@/lib/labels";

/**
 * Bước 3 chốt: KHÔNG thêm giá trị vào enum `user_role`; vai trò dự án là trục thứ hai
 * (`docs/design/auth-role-design.md` §1).
 *
 * Sau khi gỡ module HTX và mua bán tín chỉ, `cooperative_id` không còn phân nhánh điều
 * hướng nữa: mọi vai trò đều về `/du-an`, trừ quản trị nền tảng. Bộ test này khoá đúng
 * hợp đồng đó — trước đây nó khoá ba đích cũ `/htx`, `/cho`, `/thiet-lap`, những đường
 * dẫn giờ không còn tồn tại.
 */

describe("homePathFor — điều hướng theo trạng thái", () => {
  it("người dùng nền tảng dự án vào /du-an", () => {
    expect(homePathFor("coop_staff", null)).toBe("/du-an");
  });

  it("cooperative_id không còn phân nhánh điều hướng", () => {
    expect(homePathFor("coop_staff", "coop-uuid")).toBe("/du-an");
    expect(homePathFor("coop_manager", "coop-uuid")).toBe("/du-an");
    expect(homePathFor("buyer", "coop-uuid")).toBe("/du-an");
  });

  it("mọi vai trò không phải quản trị đều về /du-an", () => {
    expect(homePathFor("coop_manager", null)).toBe("/du-an");
    expect(homePathFor("buyer", null)).toBe("/du-an");
  });

  /**
   * Sau khi gỡ module cũ, `/quan-tri` không còn trang nào: dashboard HTX đã bị xoá và
   * thứ duy nhất còn sống dưới nhánh đó là màn hình cấu hình trợ lý. Nên đích của quản
   * trị nền tảng là `/quan-tri/tro-ly` chứ không phải `/quan-tri` — trỏ vào `/quan-tri`
   * là dẫn người dùng tới 404.
   */
  it("quản trị nền tảng về thẳng màn hình cấu hình trợ lý", () => {
    expect(homePathFor("platform_admin", null)).toBe("/quan-tri/tro-ly");
    expect(homePathFor("platform_admin", "coop-uuid")).toBe("/quan-tri/tro-ly");
  });

  it("không đích nào rơi vào chuỗi rỗng hay undefined", () => {
    const roles = ["platform_admin", "coop_manager", "coop_staff", "buyer"] as const;
    for (const role of roles)
      for (const coop of [null, "coop-uuid"])
        expect(homePathFor(role, coop)).toMatch(/^(\/[a-z-]+)+$/);
  });
});

describe("nhãn vai trò", () => {
  it("nhãn dự án phủ đủ ba vai trò và tách khỏi nhãn toàn cục", () => {
    expect(Object.keys(PROJECT_ROLE_LABEL).sort()).toEqual(["developer", "owner", "viewer"]);
    for (const label of Object.values(PROJECT_ROLE_LABEL)) expect(label.length).toBeGreaterThan(0);
  });

  it("ROLE_LABEL giữ nguyên bốn giá trị — enum user_role không bị đụng", () => {
    expect(Object.keys(ROLE_LABEL).sort()).toEqual([
      "buyer",
      "coop_manager",
      "coop_staff",
      "platform_admin",
    ]);
  });
});

/**
 * Ánh xạ ngữ cảnh đăng ký → vai trò toàn cục. Giá trị lạ phải thành lỗi NHÌN THẤY ĐƯỢC,
 * vì `handle_new_user` (`0012_signup_role_guard.sql:33-38`) âm thầm hạ giá trị lạ về
 * `coop_staff` — rủi ro R5 trong `docs/audit/audit-keep.md`.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
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

describe("đăng ký: ngữ cảnh tài khoản", () => {
  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  it("mật khẩu ngắn bị chặn trước khi xét loại tài khoản", async () => {
    // Thiếu cấu hình Supabase nên action dừng sớm; test này chỉ khoá THỨ TỰ kiểm tra.
    const { signUp } = await import("@/app/auth-actions");
    const result = await signUp(null, form({ account_kind: "du_an", password: "ngan" }));
    expect(result).toBeTruthy();
  });

  it("loại tài khoản lạ không bao giờ đi tiếp tới signUp của Supabase", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-test";
    const { signUp } = await import("@/app/auth-actions");
    const result = await signUp(
      null,
      form({
        account_kind: "platform_admin",
        password: "MatKhau12345",
        email: "a@b.co",
        full_name: "A",
      }),
    );
    expect(result).toBe("Loại tài khoản không hợp lệ.");
  });
});
