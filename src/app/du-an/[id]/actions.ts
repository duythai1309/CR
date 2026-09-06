"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { projectClient, requireProjectMember } from "@/lib/auth";
import { formConfigError } from "@/lib/supabase/config";
import {
  isTaskStatus,
  parseDueDate,
  validateCommentBody,
  validateTaskTitle,
} from "@/components/project/rules";

/**
 * Hành động trên công việc, bình luận và đính kèm.
 *
 * Ba bảng này được cấp quyền ghi TRỰC TIẾP (`0013_project_platform.sql:929-932`) nên đi
 * thẳng bằng DML dưới phiên người dùng; RLS `app_project_can_write` là lớp chặn thật.
 * Các bảng chỉ-ghi-qua-RPC (`project_members`, `project_stages`) nằm ở tệp khác.
 *
 * `requireProjectMember` ở đầu mỗi hành động là lớp thứ hai cho trải nghiệm: nó biến
 * "người ngoài" thành 404 thay vì một thông báo lỗi cơ sở dữ liệu. Bỏ nó đi thì Postgres
 * vẫn từ chối.
 */

type Result = string | null;

const revalidate = (projectId: string) => {
  revalidatePath(`/du-an/${projectId}`);
  revalidatePath(`/du-an/${projectId}/cong-viec`, "layout");
};

export async function createTask(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;

  const projectId = String(formData.get("project_id") ?? "");
  const stageId = String(formData.get("stage_id") ?? "");
  if (!projectId || !stageId) return "Thiếu thông tin dự án hoặc bước.";
  await requireProjectMember(projectId, "developer");

  const title = validateTaskTitle(formData.get("title"));
  if (!title.ok) return title.error;

  const due = parseDueDate(formData.get("due_at"));
  if (!due.ok) return due.error;

  const assignee = String(formData.get("assignee_id") ?? "").trim();
  const position = Number(formData.get("position") ?? 0);

  const db = await projectClient();
  const { error } = await db.from("project_tasks").insert({
    project_id: projectId,
    stage_id: stageId,
    title: title.value,
    description: String(formData.get("description") ?? "").trim(),
    assignee_id: assignee || null,
    due_at: due.value,
    position: Number.isFinite(position) ? position : 0,
  });

  if (error) return taskError(error.message);
  revalidate(projectId);
  return null;
}

export async function updateTask(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;

  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!projectId || !taskId) return "Thiếu thông tin công việc.";
  await requireProjectMember(projectId, "developer");

  const title = validateTaskTitle(formData.get("title"));
  if (!title.ok) return title.error;

  const due = parseDueDate(formData.get("due_at"));
  if (!due.ok) return due.error;

  const status = formData.get("status");
  if (!isTaskStatus(status)) return "Trạng thái không hợp lệ.";

  const assignee = String(formData.get("assignee_id") ?? "").trim();

  const db = await projectClient();
  const { error } = await db
    .from("project_tasks")
    .update({
      title: title.value,
      description: String(formData.get("description") ?? "").trim(),
      status,
      assignee_id: assignee || null,
      due_at: due.value,
    })
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) return taskError(error.message);
  revalidate(projectId);
  return null;
}

/** Kéo-thả sang cột khác, hoặc đổi bước bằng ô chọn. */
export async function moveTask(
  projectId: string,
  taskId: string,
  stageId: string,
  position: number,
): Promise<Result> {
  if (formConfigError()) return formConfigError();
  await requireProjectMember(projectId, "developer");

  const db = await projectClient();
  const { error } = await db
    .from("project_tasks")
    .update({ stage_id: stageId, position })
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) return taskError(error.message);
  revalidate(projectId);
  return null;
}

export async function setTaskStatus(
  projectId: string,
  taskId: string,
  status: string,
): Promise<Result> {
  if (formConfigError()) return formConfigError();
  if (!isTaskStatus(status)) return "Trạng thái không hợp lệ.";
  await requireProjectMember(projectId, "developer");

  const db = await projectClient();
  const { error } = await db
    .from("project_tasks")
    .update({ status })
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) return taskError(error.message);
  revalidate(projectId);
  return null;
}

export async function deleteTask(_prev: Result, formData: FormData): Promise<Result> {
  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!projectId || !taskId) return "Thiếu thông tin công việc.";
  await requireProjectMember(projectId, "developer");

  const db = await projectClient();
  const { error } = await db
    .from("project_tasks")
    .delete()
    .eq("id", taskId)
    .eq("project_id", projectId);

  // Khoá ngoại từ bình luận/đính kèm là `on delete restrict` (`0013:158`, `0013:166`),
  // nên xoá công việc còn bình luận sẽ bị từ chối. Nói thẳng thay vì hiện mã lỗi.
  if (error)
    return error.message.includes("violates foreign key")
      ? "Công việc này còn bình luận hoặc tệp đính kèm. Gỡ chúng trước khi xoá."
      : `Không xoá được công việc: ${error.message}`;

  revalidate(projectId);
  return null;
}

export async function addComment(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;

  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!projectId || !taskId) return "Thiếu thông tin công việc.";
  await requireProjectMember(projectId, "developer");

  const body = validateCommentBody(formData.get("body"));
  if (!body.ok) return body.error;

  const db = await projectClient();
  const { error } = await db
    .from("task_comments")
    .insert({ project_id: projectId, task_id: taskId, body: body.value });

  if (error) return `Không gửi được bình luận: ${error.message}`;
  revalidate(projectId);
  return null;
}

export async function deleteComment(_prev: Result, formData: FormData): Promise<Result> {
  const projectId = String(formData.get("project_id") ?? "");
  const commentId = String(formData.get("comment_id") ?? "");
  if (!projectId || !commentId) return "Thiếu thông tin bình luận.";
  await requireProjectMember(projectId, "developer");

  const db = await projectClient();
  // Policy chỉ cho tác giả hoặc owner xoá (`0013:900`); ai khác nhận 0 dòng, không lỗi.
  const { error } = await db
    .from("task_comments")
    .delete()
    .eq("id", commentId)
    .eq("project_id", projectId);

  if (error) return `Không xoá được bình luận: ${error.message}`;
  revalidate(projectId);
  return null;
}

export async function detachFile(_prev: Result, formData: FormData): Promise<Result> {
  const projectId = String(formData.get("project_id") ?? "");
  const attachmentId = String(formData.get("attachment_id") ?? "");
  if (!projectId || !attachmentId) return "Thiếu thông tin tệp đính kèm.";
  await requireProjectMember(projectId, "developer");

  const db = await projectClient();
  const { error } = await db
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("project_id", projectId);

  if (error) return `Không gỡ được tệp: ${error.message}`;
  revalidate(projectId);
  return null;
}

/** Đổi lỗi cơ sở dữ liệu thành câu người dùng hiểu được, giữ nguyên phần còn lại. */
function taskError(message: string): string {
  if (message.includes("project_tasks_project_id_assignee_id_assignee_role_fkey"))
    return "Chỉ giao được việc cho thành viên có vai trò Đơn vị phát triển trong dự án này.";
  if (message.includes("project_tasks_stage_id_project_id_fkey"))
    return "Bước được chọn không thuộc dự án này.";
  if (message.includes("row-level security") || message.includes("permission denied"))
    return "Bạn không có quyền thao tác trên công việc của dự án này.";
  return `Không lưu được công việc: ${message}`;
}


/**
 * Đính tệp vào một công việc.
 *
 * Cùng đường với tài liệu của bước (`quy-trinh/actions.ts`): bytes vào bucket, metadata
 * vào `project_files`, rồi liên kết vào `task_attachments`. Tệp là bất biến — trigger
 * `project_files_immutable` (`0013:618`) chặn sửa/xoá, nên "thay tệp" nghĩa là tải bản
 * mới rồi gỡ liên kết cũ.
 */
export async function attachFileToTask(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;

  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!projectId || !taskId) return "Thiếu thông tin công việc.";
  const { profile } = await requireProjectMember(projectId, "developer");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Chưa chọn tệp.";
  if (file.size > 52_428_800) return "Tệp vượt quá 50 MB.";

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120) || "dinh-kem";
  const objectPath = `${projectId}/${profile.id}/${randomUUID()}/${safeName}`;

  const db = await projectClient();

  const upload = await db.storage
    .from("project-documents")
    .upload(objectPath, bytes, { contentType: file.type || "application/octet-stream" });
  if (upload.error) return `Không tải được tệp lên: ${upload.error.message}`;

  const inserted = await db
    .from("project_files")
    .insert({
      project_id: projectId,
      object_path: objectPath,
      original_name: file.name.slice(0, 200),
      mime_type: file.type || "application/octet-stream",
      size_bytes: bytes.byteLength,
      checksum,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data)
    return `Tệp đã lên kho nhưng chưa ghi nhận được: ${inserted.error?.message ?? "không rõ lý do"}`;

  const linked = await db.from("task_attachments").insert({
    project_id: projectId,
    task_id: taskId,
    file_id: (inserted.data as { id: string }).id,
  });
  if (linked.error) return `Không gắn được tệp vào công việc: ${linked.error.message}`;

  revalidate(projectId);
  return null;
}
