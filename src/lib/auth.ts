import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";
import type { ProjectRole } from "@/types/project-platform";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRole = Database["public"]["Enums"]["user_role"];
export type { ProjectRole };

export async function getProfile(): Promise<Profile | null> {
  // Thiếu cấu hình thì coi như khách chưa đăng nhập, để trang giới thiệu vẫn dựng
  // được. Các trang cần đăng nhập đã bị middleware chặn từ trước đó.
  if (!readSupabaseConfig()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data ?? null;
}

/**
 * Dùng trong trang của hợp tác xã. Người dùng chưa gắn với HTX nào sẽ được đưa
 * sang bước thiết lập thay vì thấy trang trống không rõ vì sao.
 */
export async function requireCoopProfile(): Promise<Profile & { cooperative_id: string }> {
  const profile = await getProfile();
  if (!profile) redirect("/dang-nhap");
  if (profile.role === "buyer") redirect("/cho");
  if (!profile.cooperative_id) redirect("/thiet-lap");
  return profile as Profile & { cooperative_id: string };
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/dang-nhap");
  return profile;
}

/**
 * Đích sau khi đăng nhập.
 *
 * Chữ ký giữ nguyên có chủ đích: `src/app/page.tsx:101` (trang chủ CÔNG KHAI) gọi hàm
 * này, và đổi chữ ký ở đây mà quên sửa ở đó là đúng rủi ro R9 trong
 * `docs/audit/audit-keep.md`. Chỉ đích trả về thay đổi, nên không caller nào phải sửa.
 *
 * Điều hướng theo TRẠNG THÁI chứ không theo vai trò toàn cục, vì `user_role` cố ý không
 * có giá trị riêng cho nền tảng dự án (xem `docs/design/auth-role-design.md` §1):
 *
 *   - `coop_staff` CÓ hợp tác xã  → cán bộ HTX thật, vào module cũ.
 *   - `coop_staff` KHÔNG có HTX   → tài khoản nền tảng dự án, vào /du-an.
 *
 * Luồng của module cũ giữ nguyên từng đích một: buyer → /cho, platform_admin →
 * /quan-tri, coop_manager chưa có HTX → /thiet-lap.
 */
export function homePathFor(role: UserRole, cooperativeId: string | null): string {
  if (role === "platform_admin") return "/quan-tri";
  if (role === "buyer") return "/cho";
  if (cooperativeId) return "/htx";
  // Người tạo hợp tác xã đi tiếp vào luồng cũ; còn lại là tài khoản nền tảng dự án.
  return role === "coop_manager" ? "/thiet-lap" : "/du-an";
}

/* ------------------------------------------------------------------ nền tảng dự án */

/**
 * `src/types/database.ts` được sinh từ cơ sở dữ liệu thật và CHƯA thể sinh lại ở bước
 * này — mục C9 trong `docs/design/schema-review-findings.md`: phải áp 0013–0015 lên DB
 * rồi mới chạy `supabase gen types`, mà bước 3 không được chạm Supabase thật.
 *
 * Cho tới lúc đó, mọi truy vấn tới bảng/hàm mới đi qua ĐÚNG MỘT cửa ép kiểu ở đây thay
 * vì rải `as any` khắp nơi. Khi types được sinh lại, xoá hàm này và dùng client đã có
 * kiểu; TypeScript sẽ chỉ ra từng chỗ phải sửa.
 *
 * Được xuất ra để Module A dùng chung đúng một cửa này (`src/app/du-an/data.ts`), thay
 * vì mỗi nơi tự ép kiểu một kiểu.
 */
export async function projectClient(): Promise<SupabaseClient> {
  const supabase = await createClient();
  return supabase as unknown as SupabaseClient;
}

const PROJECT_ROLE_RANK: Record<ProjectRole, number> = { viewer: 0, developer: 1, owner: 2 };

function asProjectRole(value: unknown): ProjectRole | null {
  return value === "owner" || value === "developer" || value === "viewer" ? value : null;
}

/**
 * Vai trò của người đang đăng nhập trong một dự án, hoặc null nếu không phải thành viên.
 *
 * Gọi thẳng `app_project_role` (`0013_project_platform.sql:323-326`) thay vì tự truy vấn
 * `project_members`: đó chính là hàm mà mọi policy RLS dùng để quyết định, nên tầng ứng
 * dụng và cơ sở dữ liệu không thể lệch nhau.
 */
export async function getProjectRole(projectId: string): Promise<ProjectRole | null> {
  if (!readSupabaseConfig()) return null;
  const db = await projectClient();
  const { data, error } = await db.rpc("app_project_role", { p_project_id: projectId });
  if (error) return null;
  return asProjectRole(data);
}

/**
 * Chặn trang/hành động của một dự án theo vai trò dự án.
 *
 * Người không phải thành viên nhận 404 chứ không phải 403: 403 xác nhận dự án có tồn
 * tại. Cơ sở dữ liệu cũng hành xử đúng như vậy — người ngoài truy vấn được nhưng nhận về
 * tập rỗng (ca D03 trong `tests/db/cases.py`).
 *
 * Đây là lớp phòng thủ THỨ HAI cho trải nghiệm người dùng. Lớp chặn thật là RLS: kể cả
 * hàm này bị quên gọi, Postgres vẫn từ chối dữ liệu ngoài phạm vi.
 */
export async function requireProjectMember(
  projectId: string,
  minimum: ProjectRole = "viewer",
): Promise<{ profile: Profile; role: ProjectRole }> {
  const profile = await requireProfile();
  const role = await getProjectRole(projectId);
  if (!role) notFound();
  if (PROJECT_ROLE_RANK[role] < PROJECT_ROLE_RANK[minimum]) notFound();
  return { profile, role };
}

export interface ProjectMemberEntry {
  userId: string;
  fullName: string;
  role: ProjectRole;
  /** Chỉ có giá trị khi người gọi là owner; xem `0015_project_identity.sql`. */
  email: string | null;
}

/**
 * Danh bạ thành viên của một dự án. Đi qua `project_member_directory`
 * (`0015_project_identity.sql`) vì policy `profiles_select` (`0003_rls.sql:59-60`) chỉ
 * cho đọc hồ sơ người cùng hợp tác xã — mà nền tảng dự án cố ý không gắn hợp tác xã.
 */
export async function getProjectMembers(projectId: string): Promise<ProjectMemberEntry[]> {
  if (!readSupabaseConfig()) return [];
  const db = await projectClient();
  const { data, error } = await db.rpc("project_member_directory", { p_project_id: projectId });
  if (error || !Array.isArray(data)) return [];

  return data.flatMap((row: Record<string, unknown>): ProjectMemberEntry[] => {
    const role = asProjectRole(row.role);
    if (!role || typeof row.user_id !== "string") return [];
    return [
      {
        userId: row.user_id,
        fullName: typeof row.full_name === "string" ? row.full_name : "",
        role,
        email: typeof row.email === "string" ? row.email : null,
      },
    ];
  });
}

export type InviteeLookup =
  | { found: true; userId: string; fullName: string; alreadyMember: boolean }
  | { found: false; message: string };

/**
 * Tra một người theo email để owner mời vào dự án.
 *
 * Khớp email TUYỆT ĐỐI và chỉ owner gọi được — cưỡng chế trong
 * `0015_project_identity.sql`, không phải ở đây. Không tìm thấy thì trả thông báo trung
 * tính, không nói "email này chưa có tài khoản": đó là câu trả lời biến màn hình mời
 * thành công cụ dò xem ai có tài khoản trên hệ thống.
 */
export async function lookupInvitee(projectId: string, email: string): Promise<InviteeLookup> {
  const notFoundResult: InviteeLookup = {
    found: false,
    message: "Không mời được địa chỉ này. Người được mời cần có tài khoản trước.",
  };
  if (!readSupabaseConfig()) return notFoundResult;

  const db = await projectClient();
  const { data, error } = await db.rpc("project_lookup_invitee", {
    p_project_id: projectId,
    p_email: email,
  });
  if (error || !Array.isArray(data) || data.length === 0) return notFoundResult;

  const row = data[0] as Record<string, unknown>;
  if (typeof row.user_id !== "string") return notFoundResult;
  return {
    found: true,
    userId: row.user_id,
    fullName: typeof row.full_name === "string" ? row.full_name : "",
    alreadyMember: row.already_member === true,
  };
}
