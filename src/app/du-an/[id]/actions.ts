"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { projectClient, requireProjectMember } from "@/lib/auth";
import { formConfigError } from "@/lib/supabase/config";
import {
  COLUMN_NAME_MAX,
  columnDeleteBlocker,
  isTaskStatus,
  nextColumnPosition,
  parseDueDate,
  statusForColumnName,
  validateColumnName,
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

/**
 * Làm mới đúng thứ đã đổi, không hơn.
 *
 * Bản cũ gọi hai lần cho MỌI thao tác, một lần với `"layout"` — kiểu đó kéo theo cả cây
 * layout của nhánh `cong-viec`, nên kéo một card cũng dựng lại những trang không liên
 * quan. Ba hàm dưới đây tách theo đúng thứ mỗi trang thật sự đọc:
 *
 * - Bảng công việc là nơi DUY NHẤT hiện cột và thứ tự card.
 * - Trang chi tiết công việc hiện `status` và `stage`, KHÔNG hiện `column_id` hay
 *   `position` — nên sắp xếp lại hay đổi cột không cần đụng tới nó.
 * - Bình luận và tệp đính kèm chỉ hiện ở trang chi tiết, không hiện trên bảng.
 */

/** Bảng công việc của dự án. */
const revalidateBoard = (projectId: string) => {
  revalidatePath(`/du-an/${projectId}`);
};

/** Trang chi tiết của ĐÚNG một công việc. */
const revalidateTask = (projectId: string, taskId: string) => {
  revalidatePath(`/du-an/${projectId}/cong-viec/${taskId}`);
};

/**
 * Mọi trang chi tiết công việc, khi không biết `taskId`.
 *
 * Dạng route động kèm type `"page"` chỉ làm mới phần page của route đó; nó KHÔNG dựng lại
 * cây layout như `"layout"` của bản cũ. Chỉ dùng cho hai chỗ mà biểu mẫu không gửi kèm
 * `task_id` (`deleteComment`, `detachFile`) và cho thao tác hàng loạt.
 */
const revalidateAnyTask = (projectId: string) => {
  revalidatePath(`/du-an/${projectId}/cong-viec/[taskId]`, "page");
};

export async function createTask(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;

  const projectId = String(formData.get("project_id") ?? "");
  const stageId = String(formData.get("stage_id") ?? "");
  if (!projectId || !stageId) return "Thiếu thông tin dự án hoặc bước.";
  await requireProjectMember(projectId);

  const title = validateTaskTitle(formData.get("title"));
  if (!title.ok) return title.error;

  const due = parseDueDate(formData.get("due_at"));
  if (!due.ok) return due.error;

  const assignee = String(formData.get("assignee_id") ?? "").trim();
  const position = Number(formData.get("position") ?? 0);

  // Việc mới rơi vào cột ĐẦU TIÊN của bảng — chỗ Jira gọi là backlog. Cố ý không suy cột
  // theo tên: cột là do người dùng đặt, và đoán ý nghĩa của chúng là điều §2 của thiết kế
  // cấm. Bảng chưa có cột nào (migration 0021 chưa áp) thì để trống, card rơi vào nhóm
  // "Chưa xếp cột" và vẫn hiện ra.
  const columns = await readColumns(projectId);
  const firstColumn = columns[0]?.id ?? null;

  const db = await projectClient();
  const { error } = await db.from("project_tasks").insert({
    project_id: projectId,
    stage_id: stageId,
    title: title.value,
    description: String(formData.get("description") ?? "").trim(),
    assignee_id: assignee || null,
    due_at: due.value,
    position: Number.isFinite(position) ? position : 0,
    ...(firstColumn ? { column_id: firstColumn } : {}),
  });

  if (error) return taskError(error.message);
  revalidateBoard(projectId);
  return null;
}

export async function updateTask(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;

  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!projectId || !taskId) return "Thiếu thông tin công việc.";
  await requireProjectMember(projectId);

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
  revalidateBoard(projectId);
  revalidateTask(projectId, taskId);
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
  await requireProjectMember(projectId);

  const db = await projectClient();
  const { error } = await db
    .from("project_tasks")
    .update({ stage_id: stageId, position })
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) return taskError(error.message);
  revalidateBoard(projectId);
  revalidateTask(projectId, taskId);
  return null;
}

export async function setTaskStatus(
  projectId: string,
  taskId: string,
  status: string,
): Promise<Result> {
  if (formConfigError()) return formConfigError();
  if (!isTaskStatus(status)) return "Trạng thái không hợp lệ.";
  await requireProjectMember(projectId);

  const db = await projectClient();
  const { error } = await db
    .from("project_tasks")
    .update({ status })
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) return taskError(error.message);
  revalidateBoard(projectId);
  revalidateTask(projectId, taskId);
  return null;
}

export async function deleteTask(_prev: Result, formData: FormData): Promise<Result> {
  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!projectId || !taskId) return "Thiếu thông tin công việc.";
  await requireProjectMember(projectId);

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

  revalidateBoard(projectId);
  revalidateTask(projectId, taskId);
  return null;
}

export async function addComment(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;

  const projectId = String(formData.get("project_id") ?? "");
  const taskId = String(formData.get("task_id") ?? "");
  if (!projectId || !taskId) return "Thiếu thông tin công việc.";
  await requireProjectMember(projectId);

  const body = validateCommentBody(formData.get("body"));
  if (!body.ok) return body.error;

  const db = await projectClient();
  const { error } = await db
    .from("task_comments")
    .insert({ project_id: projectId, task_id: taskId, body: body.value });

  if (error) return `Không gửi được bình luận: ${error.message}`;
  revalidateTask(projectId, taskId);
  return null;
}

export async function deleteComment(_prev: Result, formData: FormData): Promise<Result> {
  const projectId = String(formData.get("project_id") ?? "");
  const commentId = String(formData.get("comment_id") ?? "");
  if (!projectId || !commentId) return "Thiếu thông tin bình luận.";
  await requireProjectMember(projectId);

  const db = await projectClient();
  // Policy chỉ cho tác giả hoặc owner xoá (`0013:900`); ai khác nhận 0 dòng, không lỗi.
  const { error } = await db
    .from("task_comments")
    .delete()
    .eq("id", commentId)
    .eq("project_id", projectId);

  if (error) return `Không xoá được bình luận: ${error.message}`;
  revalidateAnyTask(projectId);
  return null;
}

export async function detachFile(_prev: Result, formData: FormData): Promise<Result> {
  const projectId = String(formData.get("project_id") ?? "");
  const attachmentId = String(formData.get("attachment_id") ?? "");
  if (!projectId || !attachmentId) return "Thiếu thông tin tệp đính kèm.";
  await requireProjectMember(projectId);

  const db = await projectClient();
  const { error } = await db
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("project_id", projectId);

  if (error) return `Không gỡ được tệp: ${error.message}`;
  revalidateAnyTask(projectId);
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
  const { profile } = await requireProjectMember(projectId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Chưa chọn tệp.";
  if (file.size > 4_194_304) return "Tệp vượt quá 4 MB. Vercel giới hạn cứng thân request ở 4,5 MB nên tệp lớn hơn không đi qua server action được.";

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

  revalidateTask(projectId, taskId);
  return null;
}

/**
 * Thao tác hàng loạt trên nhiều công việc — đổi trạng thái hoặc chuyển bước một lượt.
 *
 * Một câu UPDATE với `in (...)` chứ không phải vòng lặp gọi lại action: một lần kiểm tư
 * cách thành viên, một lần đi mạng, và RLS đánh giá `app_project_can_write` đúng một lần
 * cho cả mẻ. Việc nằm ngoài dự án bị `eq('project_id')` loại, không cần lọc ở đây.
 *
 * `position` cố ý KHÔNG đổi khi chuyển bước: card giữ nguyên thứ tự tương đối trong cột
 * mới, và `groupTasksByStage` đã có `title` làm khoá phụ khi hai card trùng `position`.
 */
export async function bulkUpdateTasks(
  projectId: string,
  taskIds: string[],
  patch: { status?: string; stageId?: string },
): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;

  if (!projectId) return "Thiếu thông tin dự án.";
  const ids = [...new Set(taskIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return "Chưa chọn công việc nào.";
  if (ids.length > 200) return "Mỗi lượt chỉ đổi được tối đa 200 công việc.";

  const update: { status?: string; stage_id?: string } = {};
  if (patch.status !== undefined) {
    if (!isTaskStatus(patch.status)) return "Trạng thái không hợp lệ.";
    update.status = patch.status;
  }
  if (patch.stageId !== undefined) {
    if (!patch.stageId) return "Bước không hợp lệ.";
    update.stage_id = patch.stageId;
  }
  if (Object.keys(update).length === 0) return "Chưa chọn thay đổi nào.";

  await requireProjectMember(projectId);

  const db = await projectClient();
  const { error } = await db
    .from("project_tasks")
    .update(update)
    .eq("project_id", projectId)
    .in("id", ids);

  if (error) return taskError(error.message);
  revalidateBoard(projectId);
  revalidateAnyTask(projectId);
  return null;
}

/* ----------------------------------------------------------- cột kanban tự do (0021) */

/**
 * Cột của bảng Kanban là DỮ LIỆU của dự án, không phải hằng số của hệ thống.
 *
 * Bảng `project_board_columns` và `project_tasks.column_id` đến từ migration 0021. Quyền
 * ghi thật vẫn là RLS `app_project_can_write` như mọi bảng khác của nền tảng; các hàm
 * dưới đây chỉ dựng câu lệnh và dịch lỗi Postgres sang tiếng người.
 *
 * `status` CỐ Ý không bị bỏ. Năm chỗ ngoài bảng Kanban vẫn đang đọc nó (xem §2 của thiết
 * kế), nên khi thả card vào một trong bốn cột MẶC ĐỊNH ta còn ghi kèm `status` tương ứng
 * làm cầu tạm. Cột do người dùng tự tạo thì giữ nguyên `status` cũ — không đoán.
 */

interface ColumnRow {
  id: string;
  name: string;
  position: number;
}

async function readColumns(projectId: string): Promise<ColumnRow[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_board_columns")
    .select("id, name, position")
    .eq("project_id", projectId)
    .order("position");
  return (data ?? []) as ColumnRow[];
}

export async function createBoardColumn(projectId: string, rawName: string): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;
  if (!projectId) return "Thiếu thông tin dự án.";
  await requireProjectMember(projectId);

  const existing = await readColumns(projectId);
  const name = validateColumnName(
    rawName,
    existing.map((column) => column.name),
  );
  if (!name.ok) return name.error;

  const db = await projectClient();
  const { error } = await db.from("project_board_columns").insert({
    project_id: projectId,
    name: name.value,
    position: nextColumnPosition(existing),
  });

  if (error) return columnError(error.message);
  revalidateBoard(projectId);
  return null;
}

export async function renameBoardColumn(
  projectId: string,
  columnId: string,
  rawName: string,
): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;
  if (!projectId || !columnId) return "Thiếu thông tin cột.";
  await requireProjectMember(projectId);

  const existing = await readColumns(projectId);
  const name = validateColumnName(
    rawName,
    existing.filter((column) => column.id !== columnId).map((column) => column.name),
  );
  if (!name.ok) return name.error;

  const db = await projectClient();
  const { error } = await db
    .from("project_board_columns")
    .update({ name: name.value })
    .eq("id", columnId)
    .eq("project_id", projectId);

  if (error) return columnError(error.message);
  revalidateBoard(projectId);
  return null;
}

/**
 * Xoá một cột.
 *
 * Kiểm số việc còn lại TRƯỚC khi xoá để nói được "còn N công việc" thay vì để người dùng
 * nhận một lỗi khoá ngoại thô. `on delete restrict` ở 0021 mới là lớp chặn thật — nếu ai
 * đó thêm việc vào cột giữa hai lần đi mạng thì Postgres vẫn từ chối, và nhánh dưới dịch
 * lỗi đó ra.
 */
export async function deleteBoardColumn(projectId: string, columnId: string): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;
  if (!projectId || !columnId) return "Thiếu thông tin cột.";
  await requireProjectMember(projectId);

  const db = await projectClient();
  const [{ data: tasks }, columns] = await Promise.all([
    db.from("project_tasks").select("id").eq("project_id", projectId).eq("column_id", columnId),
    readColumns(projectId),
  ]);

  const blocker = columnDeleteBlocker(
    columnId,
    ((tasks ?? []) as Array<{ id: string }>).map((row) => ({
      id: row.id,
      stageId: "",
      title: "",
      status: "todo" as const,
      assigneeId: null,
      dueAt: null,
      position: 0,
      columnId,
    })),
    columns.length,
  );
  if (blocker) return blocker;

  const { error } = await db
    .from("project_board_columns")
    .delete()
    .eq("id", columnId)
    .eq("project_id", projectId);

  if (error) return columnError(error.message);
  revalidateBoard(projectId);
  return null;
}

/** Ghi lại thứ tự cột sau khi kéo. `rows` do `reorderColumns` tính ra. */
export async function applyColumnOrder(
  projectId: string,
  rows: Array<{ id: string; position: number }>,
): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;
  if (!projectId) return "Thiếu thông tin dự án.";
  if (rows.length === 0) return null;
  if (rows.length > 100) return "Bảng có quá nhiều cột để sắp xếp một lượt.";
  await requireProjectMember(projectId);

  const db = await projectClient();
  const results = await Promise.all(
    rows.map((row) =>
      db
        .from("project_board_columns")
        .update({ position: row.position })
        .eq("id", row.id)
        .eq("project_id", projectId),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) return columnError(failed.error.message);
  revalidateBoard(projectId);
  return null;
}

/**
 * Thả card: đặt `column_id`, ghi lại `position`, và ghi kèm `status` khi ánh xạ được.
 *
 * `rows` do `reorderWithinColumn` tính — thường đúng một dòng, chỉ khi bậc thang hết chỗ
 * chèn giữa mới là cả cột. `columnName` là tên cột ĐÍCH: trùng một trong bốn nhãn mặc
 * định thì suy ra `status` làm cầu tạm, khác thì để `status` nguyên như cũ.
 */
export async function moveTaskToColumn(
  projectId: string,
  taskId: string,
  columnId: string,
  columnName: string,
  rows: Array<{ id: string; position: number }>,
): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;
  if (!projectId || !taskId || !columnId) return "Thiếu thông tin công việc hoặc cột.";
  if (rows.length > 500) return "Cột có quá nhiều công việc để sắp xếp một lượt.";
  await requireProjectMember(projectId);

  const bridged = statusForColumnName(columnName);
  const db = await projectClient();

  const moved = await db
    .from("project_tasks")
    .update(
      bridged
        ? { column_id: columnId, status: bridged }
        : { column_id: columnId },
    )
    .eq("id", taskId)
    .eq("project_id", projectId);
  if (moved.error) return taskError(moved.error.message);

  const order = await applyTaskOrder(projectId, rows);
  if (order) return order;

  revalidateBoard(projectId);
  revalidateTask(projectId, taskId);
  return null;
}

/** Kéo sắp xếp card trong cùng một cột — chỉ đụng `position`, không đổi cột. */
export async function reorderTasksInColumn(
  projectId: string,
  rows: Array<{ id: string; position: number }>,
): Promise<Result> {
  const configError = formConfigError();
  if (configError) return configError;
  if (!projectId) return "Thiếu thông tin dự án.";
  if (rows.length === 0) return null;
  if (rows.length > 500) return "Cột có quá nhiều công việc để sắp xếp một lượt.";
  await requireProjectMember(projectId);

  const error = await applyTaskOrder(projectId, rows);
  if (error) return error;
  revalidateBoard(projectId);
  return null;
}

async function applyTaskOrder(
  projectId: string,
  rows: Array<{ id: string; position: number }>,
): Promise<Result> {
  if (rows.length === 0) return null;
  const db = await projectClient();
  const results = await Promise.all(
    rows.map((row) =>
      db
        .from("project_tasks")
        .update({ position: row.position })
        .eq("id", row.id)
        .eq("project_id", projectId),
    ),
  );
  const failed = results.find((result) => result.error);
  return failed?.error ? taskError(failed.error.message) : null;
}

/** Đổi lỗi cơ sở dữ liệu về cột thành câu người dùng hiểu được. */
function columnError(message: string): string {
  if (message.includes("project_board_columns_project_id_name_key"))
    return "Đã có cột trùng tên trong bảng này.";
  if (message.includes("violates foreign key"))
    return "Cột này còn công việc. Kéo chúng sang cột khác rồi mới xoá được.";
  if (message.includes("project_board_columns_name_check"))
    return `Tên cột phải từ 1 tới ${COLUMN_NAME_MAX} ký tự.`;
  if (message.includes("row-level security") || message.includes("permission denied"))
    return "Bạn không có quyền sửa cột của bảng này.";
  if (message.includes("does not exist") || message.includes("schema cache"))
    return "Bảng chưa có cột tuỳ biến. Migration 0021 chưa được áp lên cơ sở dữ liệu.";
  return `Không lưu được cột: ${message}`;
}
