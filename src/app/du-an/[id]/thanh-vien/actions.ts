"use server";

import { revalidatePath } from "next/cache";
import { lookupInvitee, projectClient, requireProjectMember } from "@/lib/auth";
import { formConfigError } from "@/lib/supabase/config";
import { isProjectRole } from "@/components/project/rules";

/**
 * Quản lý thành viên.
 *
 * `project_members` KHÔNG có quyền ghi trực tiếp (`0013_project_platform.sql:918-925`
 * thu hết rồi chỉ cấp lại SELECT), nên mọi thay đổi phải đi qua RPC `set_project_member`
 * (`0013:680-693`). RPC tự khoá dòng dự án rồi kiểm `app_project_role(...)='owner'`,
 * nên không có đường nào tự thêm mình vào dự án người khác.
 */

type Result = { ok: boolean; message: string } | null;

export async function inviteMember(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return { ok: false, message: configError };

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { ok: false, message: "Thiếu mã dự án." };
  await requireProjectMember(projectId, "owner");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Nhập email của người bạn muốn mời." };

  const role = String(formData.get("role") ?? "developer");
  if (!isProjectRole(role)) return { ok: false, message: "Vai trò không hợp lệ." };

  // Tra người bằng RPC hẹp của 0015: khớp email tuyệt đối, chỉ owner gọi được.
  const found = await lookupInvitee(projectId, email);
  if (!found.found) return { ok: false, message: found.message };

  if (found.alreadyMember)
    return {
      ok: false,
      message: `${found.fullName} đã là thành viên của dự án. Dùng ô đổi vai trò bên dưới.`,
    };

  const db = await projectClient();
  const { error } = await db.rpc("set_project_member", {
    p_project_id: projectId,
    p_user_id: found.userId,
    p_role: role,
  });
  if (error) return { ok: false, message: memberError(error.message) };

  revalidatePath(`/du-an/${projectId}/thanh-vien`);
  revalidatePath(`/du-an/${projectId}`);
  return { ok: true, message: `Đã thêm ${found.fullName} vào dự án.` };
}

export async function changeMemberRole(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return { ok: false, message: configError };

  const projectId = String(formData.get("project_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!projectId || !userId) return { ok: false, message: "Thiếu thông tin thành viên." };
  await requireProjectMember(projectId, "owner");

  const role = String(formData.get("role") ?? "");
  if (!isProjectRole(role)) return { ok: false, message: "Vai trò không hợp lệ." };

  const db = await projectClient();
  const { error } = await db.rpc("set_project_member", {
    p_project_id: projectId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) return { ok: false, message: memberError(error.message) };

  revalidatePath(`/du-an/${projectId}/thanh-vien`);
  revalidatePath(`/du-an/${projectId}`);
  return { ok: true, message: "Đã đổi vai trò." };
}

export async function removeMember(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return { ok: false, message: configError };

  const projectId = String(formData.get("project_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!projectId || !userId) return { ok: false, message: "Thiếu thông tin thành viên." };
  await requireProjectMember(projectId, "owner");

  const db = await projectClient();
  // `p_role = null` nghĩa là gỡ khỏi dự án (`0013:684-686`).
  const { error } = await db.rpc("set_project_member", {
    p_project_id: projectId,
    p_user_id: userId,
    p_role: null,
  });
  if (error) return { ok: false, message: memberError(error.message) };

  revalidatePath(`/du-an/${projectId}/thanh-vien`);
  revalidatePath(`/du-an/${projectId}`);
  return { ok: true, message: "Đã gỡ khỏi dự án." };
}

/**
 * Cơ sở dữ liệu chặn hai tình huống mà giao diện không đoán trước được; dịch sang câu
 * người dùng hiểu thay vì hiện nguyên thông báo Postgres.
 */
function memberError(message: string): string {
  if (message.includes("owner cuối cùng"))
    return "Dự án phải luôn còn ít nhất một chủ dự án. Chỉ định người khác làm chủ trước đã.";
  if (message.includes("project_tasks_project_id_assignee_id_assignee_role_fkey"))
    return "Người này còn được giao công việc trong dự án. Chuyển việc cho người khác trước khi đổi vai trò hoặc gỡ họ ra.";
  if (message.includes("Chỉ owner")) return "Chỉ chủ dự án mới quản lý được thành viên.";
  return `Không lưu được: ${message}`;
}
