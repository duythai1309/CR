import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";
import type { ProjectRole } from "@/types/project-platform";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRole = Database["public"]["Enums"]["user_role"];
export type { ProjectRole };

export const getProfile = cache(async function getProfile(): Promise<Profile | null> {
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
});

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
 * Mọi tài khoản sản phẩm đi vào danh sách dự án. Quản trị viên là ngoại lệ duy
 * nhất vì còn cần màn hình cấu hình trợ lý.
 *
 * Đích của quản trị viên trỏ THẲNG tới `/quan-tri/tro-ly`: `/quan-tri` từng là bảng
 * điều khiển hợp tác xã / lô tín chỉ / doanh thu và đã bị xoá cùng module cũ, nên trả
 * về `/quan-tri` bây giờ là đưa quản trị viên vào một trang 404.
 *
 * `cooperativeId` được giữ trong chữ ký để các caller cũ tiếp tục build trong
 * lượt chuyển tiếp; giá trị này không còn quyết định đích điều hướng.
 */
export function homePathFor(role: UserRole, cooperativeId: string | null): string {
  void cooperativeId;
  if (role === "platform_admin") return "/quan-tri/tro-ly";
  return "/du-an";
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
export const getProjectRole = cache(async function getProjectRole(
  projectId: string,
): Promise<ProjectRole | null> {
  if (!readSupabaseConfig()) return null;
  const db = await projectClient();
  const { data, error } = await db.rpc("app_project_role", { p_project_id: projectId });
  if (error) return null;
  return asProjectRole(data);
});

/**
 * Chặn trang/hành động của một dự án: người gọi phải là THÀNH VIÊN của dự án đó.
 *
 * Không còn tham số vai trò tối thiểu. Sau 0022 và 0025 mọi thành viên có cùng quyền
 * bên trong dự án, nên điều kiện duy nhất còn lại là có mặt trong `project_members` —
 * đúng cái mà `app_project_role(...) is not null` trả lời.
 *
 * Người không phải thành viên nhận 404 chứ không phải 403: 403 xác nhận dự án có tồn
 * tại. Cơ sở dữ liệu cũng hành xử đúng như vậy — người ngoài truy vấn được nhưng nhận về
 * tập rỗng (ca D03 trong `tests/db/cases.py`).
 *
 * Đây là lớp phòng thủ THỨ HAI cho trải nghiệm người dùng. Lớp chặn thật là RLS: kể cả
 * hàm này bị quên gọi, Postgres vẫn từ chối dữ liệu ngoài phạm vi.
 */
export async function requireProjectMember(projectId: string): Promise<{ profile: Profile }> {
  const profile = await requireProfile();
  const isMember = (await getProjectRole(projectId)) !== null;
  if (!isMember) notFound();
  return { profile };
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
export const getProjectMembers = cache(async function getProjectMembers(
  projectId: string,
): Promise<ProjectMemberEntry[]> {
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
});

export interface ProjectSupportSession {
  id: string;
  projectId: string;
  adminId: string;
  reason: string;
  openedAt: string;
  expiresAt: string;
}

/** Phiên hỗ trợ đang có hiệu lực của admin hiện tại, dùng để hiện cảnh báo chỉ đọc. */
export const getActiveProjectSupport = cache(async function getActiveProjectSupport(
  projectId: string,
  adminId: string,
): Promise<ProjectSupportSession | null> {
  if (!readSupabaseConfig()) return null;
  const db = await projectClient();
  const { data, error } = await db
    .from("project_support_sessions")
    .select("id, project_id, admin_id, reason, opened_at, expires_at")
    .eq("project_id", projectId)
    .eq("admin_id", adminId)
    .gt("expires_at", new Date().toISOString())
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.project_id !== "string" ||
    typeof row.admin_id !== "string" ||
    typeof row.reason !== "string" ||
    typeof row.opened_at !== "string" ||
    typeof row.expires_at !== "string"
  )
    return null;

  return {
    id: row.id,
    projectId: row.project_id,
    adminId: row.admin_id,
    reason: row.reason,
    openedAt: row.opened_at,
    expiresAt: row.expires_at,
  };
});

export type BeginProjectSupportResult =
  | { ok: true; sessionId: string; expiresAt: string }
  | { ok: false; message: string };

/**
 * Mở phiên xem hộ. Kiểm tra ở đây chỉ để trả lỗi dễ hiểu; quyền thật, thời hạn và audit
 * đều do `begin_project_support` trong migration 0018 cưỡng chế.
 */
export async function beginProjectSupport(
  projectId: string,
  reason: string,
  durationMinutes: number,
): Promise<BeginProjectSupportResult> {
  const profile = await requireProfile();
  if (profile.role !== "platform_admin")
    return { ok: false, message: "Chỉ quản trị nền tảng được mở phiên hỗ trợ." };

  const db = await projectClient();
  const { data, error } = await db.rpc("begin_project_support", {
    p_project_id: projectId,
    p_reason: reason,
    p_duration_minutes: durationMinutes,
  });
  if (error || !Array.isArray(data) || data.length === 0)
    return { ok: false, message: "Không mở được phiên. Kiểm tra UUID dự án và lý do hỗ trợ." };

  const row = data[0] as Record<string, unknown>;
  if (typeof row.support_session_id !== "string" || typeof row.expires_at !== "string")
    return { ok: false, message: "Cơ sở dữ liệu trả về phiên hỗ trợ không hợp lệ." };

  return { ok: true, sessionId: row.support_session_id, expiresAt: row.expires_at };
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
export const lookupInvitee = cache(async function lookupInvitee(
  projectId: string,
  email: string,
): Promise<InviteeLookup> {
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
});
