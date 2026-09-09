"use server";

import { revalidatePath } from "next/cache";
import { lookupInvitee, projectClient, requireProjectMember } from "@/lib/auth";
import { formConfigError } from "@/lib/supabase/config";

/**
 * Quản lý thành viên.
 *
 * `project_members` KHÔNG có quyền ghi trực tiếp (`0013_project_platform.sql:918-925`
 * thu hết rồi chỉ cấp lại SELECT), nên mọi thay đổi phải đi qua RPC `set_project_member`
 * (`0013:680-693`). Sau 0022 RPC kiểm `app_project_role(...) is not null` — tức "là
 * thành viên" — nên không có đường nào tự thêm mình vào dự án người khác.
 *
 * Vai trò không còn là lựa chọn của người dùng. Cột `project_members.role` vẫn tồn tại
 * vì chốt chặn "dự án phải luôn còn ít nhất một owner" (`0013:564`) đọc nó, nhưng giao
 * diện không hỏi và không hiện: mọi người được mời vào đều nhận `developer`, và
 * `developer` sau 0022/0025 có đúng cùng quyền với `owner` bên trong dự án.
 */

/** Vai trò duy nhất mà giao diện còn ghi. Xem chú thích đầu tệp. */
const MEMBER_ROLE = "developer";

type Result = { ok: boolean; message: string } | null;

export async function inviteMember(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return { ok: false, message: configError };

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { ok: false, message: "Thiếu mã dự án." };
  await requireProjectMember(projectId);

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Nhập email của người bạn muốn mời." };

  // Tra người bằng RPC hẹp của 0015: khớp email tuyệt đối, chỉ owner gọi được.
  const found = await lookupInvitee(projectId, email);
  if (!found.found) return { ok: false, message: found.message };

  if (found.alreadyMember)
    return { ok: false, message: `${found.fullName} đã là thành viên của dự án.` };

  const db = await projectClient();
  const { error } = await db.rpc("set_project_member", {
    p_project_id: projectId,
    p_user_id: found.userId,
    p_role: MEMBER_ROLE,
  });
  if (error) return { ok: false, message: memberError(error.message) };

  revalidatePath(`/du-an/${projectId}/thanh-vien`);
  revalidatePath(`/du-an/${projectId}`);
  return { ok: true, message: `Đã thêm ${found.fullName} vào dự án.` };
}

export async function removeMember(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return { ok: false, message: configError };

  const projectId = String(formData.get("project_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!projectId || !userId) return { ok: false, message: "Thiếu thông tin thành viên." };
  await requireProjectMember(projectId);

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
    return "Không gỡ được người đã tạo dự án. Dự án phải luôn còn ít nhất một người chịu trách nhiệm.";
  if (message.includes("project_tasks_assignee_member_fkey"))
    return "Người này còn được giao công việc trong dự án. Chuyển việc cho người khác trước khi gỡ họ ra.";
  if (message.includes("Chỉ thành viên")) return "Bạn không còn là thành viên của dự án này.";
  return `Không lưu được: ${message}`;
}
