import type { ProjectRole } from "@/types/project-platform";

/**
 * Quy tắc nghiệp vụ thuần của Module A — không import Supabase, không async.
 *
 * Tách riêng để kiểm thử được bằng `npm run test` mà không cần cơ sở dữ liệu. Đây là
 * lớp cho GIAO DIỆN biết nên ẩn/khoá cái gì; **không phải lớp bảo vệ**. Lớp chặn thật là
 * RLS và các RPC `security definer` trong `0013_project_platform.sql` — mọi hàm ở đây có
 * bị bỏ qua thì Postgres vẫn từ chối.
 */

/* ------------------------------------------------------------------ trạng thái task */

export const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  done: "Xong",
  blocked: "Vướng",
};

export const TASK_STATUS_TONE: Record<TaskStatus, "soil" | "carbon" | "leaf" | "red"> = {
  todo: "soil",
  in_progress: "carbon",
  done: "leaf",
  blocked: "red",
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ bảy bước cố định */

/**
 * Bảy bước theo `PLAN.md` §3. Tiêu đề do trigger `project_bootstrap`
 * (`0013_project_platform.sql:582-586`) sinh ra và **không sửa được**
 * (`project_guard_stage` chặn mọi UPDATE), nên danh sách này chỉ để mô tả thêm cho
 * người dùng, không phải nguồn sự thật của tiêu đề.
 */
export const STAGE_HINT: Record<number, string> = {
  1: "Project concept — mô tả phạm vi, địa điểm và ranh giới dự án.",
  2: "Feasibility assessment — checklist khả thi và hồ sơ nền tảng.",
  3: "Standard selection — chọn và khoá Standard dùng để trích dẫn trong PDD.",
  4: "Methodology selection — chọn mã Methodology và version thuộc Standard đã khoá.",
  5: "Baseline scenario — nhập baseline theo metric schema và lưu bằng chứng.",
  6: "Additionality — lập hồ sơ additionality theo yêu cầu Standard.",
  7: "PDD — Project Design Document, quản lý từng phiên bản tài liệu.",
};

export const DOCUMENT_KINDS = [
  "feasibility",
  "baseline",
  "additionality",
  "pdd",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  feasibility: "Feasibility assessment — hồ sơ khả thi",
  baseline: "Baseline scenario — tài liệu cơ sở",
  additionality: "Additionality — hồ sơ chứng minh",
  pdd: "PDD — Project Design Document",
  other: "Tài liệu khác",
};

/** Bước mà mỗi loại tài liệu thuộc về, dùng để gợi ý đúng chỗ tải lên. */
export const DOCUMENT_KIND_STAGE: Record<DocumentKind, number> = {
  feasibility: 2,
  baseline: 5,
  additionality: 6,
  pdd: 7,
  other: 1,
};

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === "string" && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ quyền theo vai trò */

const RANK: Record<ProjectRole, number> = { viewer: 0, developer: 1, owner: 2 };

export function isProjectRole(value: unknown): value is ProjectRole {
  return value === "owner" || value === "developer" || value === "viewer";
}

export function atLeast(role: ProjectRole, minimum: ProjectRole): boolean {
  return RANK[role] >= RANK[minimum];
}

/**
 * Quyền theo `PLAN.md` §5. Ánh xạ đúng vào những gì cơ sở dữ liệu cho phép:
 * `canWriteTasks` khớp `app_project_can_write` (`0013:331-336`), còn các quyền còn lại
 * khớp điều kiện `app_project_role(...)='owner'` trong policy và RPC.
 */
export interface ProjectAbilities {
  canWriteTasks: boolean;
  canComment: boolean;
  canUploadFiles: boolean;
  canManageMembers: boolean;
  canApproveStage: boolean;
  canChooseStandard: boolean;
  canEditBaseline: boolean;
  canDeleteProject: boolean;
}

export function abilitiesFor(role: ProjectRole, projectDeleted = false): ProjectAbilities {
  // Dự án đã xoá mềm: đọc lịch sử vẫn được, mọi đường ghi đóng lại. Đây là điều kiện
  // `p.deleted_at is null` bên trong `app_project_can_write`, chép lại cho giao diện.
  const write = !projectDeleted && atLeast(role, "developer");
  const own = !projectDeleted && role === "owner";
  return {
    canWriteTasks: write,
    canComment: write,
    canUploadFiles: write,
    canManageMembers: own,
    canApproveStage: own,
    canChooseStandard: own,
    canEditBaseline: own,
    canDeleteProject: own,
  };
}

/* ------------------------------------------------------------------ duyệt bước */

export interface StageView {
  id: string;
  ordinal: number;
  title: string;
  approvedAt: string | null;
}

export interface ProjectGate {
  standardId: string | null;
  methodologyId: string | null;
  standardLockedAt: string | null;
  methodologyLockedAt: string | null;
}

/**
 * Vì sao chưa duyệt được một bước — trả về danh sách rỗng nghĩa là duyệt được.
 *
 * Chép đúng thứ tự kiểm tra của RPC `approve_project_stage`
 * (`0013_project_platform.sql:696-715`): bước trước phải xong, bước ≥3 cần Standard đã
 * khoá, bước ≥4 cần Methodology đã khoá. Mục đích là NÓI TRƯỚC lý do thay vì để người
 * dùng bấm rồi nhận một thông báo lỗi từ cơ sở dữ liệu.
 */
export function approvalBlockers(
  stages: StageView[],
  ordinal: number,
  project: ProjectGate,
): string[] {
  const blockers: string[] = [];
  const target = stages.find((s) => s.ordinal === ordinal);

  if (!target) return ["Không tìm thấy bước này."];
  if (target.approvedAt) return ["Bước này đã được duyệt."];

  const pending = stages
    .filter((s) => s.ordinal < ordinal && !s.approvedAt)
    .map((s) => s.ordinal);
  if (pending.length > 0) blockers.push(`Cần duyệt bước ${pending.join(", ")} trước.`);

  if (ordinal >= 3 && !project.standardLockedAt) blockers.push("Chưa khoá Standard (bước 3).");
  if (ordinal >= 4 && !project.methodologyLockedAt)
    blockers.push("Chưa khoá Methodology (bước 4).");

  return blockers;
}

/** Bước kế tiếp cần duyệt, hoặc null nếu đã duyệt hết. */
export function nextStageToApprove(stages: StageView[]): StageView | null {
  return [...stages].sort((a, b) => a.ordinal - b.ordinal).find((s) => !s.approvedAt) ?? null;
}

export function approvedCount(stages: StageView[]): number {
  return stages.filter((s) => s.approvedAt).length;
}

/* ------------------------------------------------------------------ hợp lệ hoá đầu vào */

export type Validation = { ok: true; value: string } | { ok: false; error: string };

/** Giới hạn khớp `check (length(trim(title)) between 1 and 300)` (`0013:117`). */
export function validateTaskTitle(raw: unknown): Validation {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false, error: "Tên công việc không được để trống." };
  if (value.length > 300) return { ok: false, error: "Tên công việc dài quá 300 ký tự." };
  return { ok: true, value };
}

/** Giới hạn khớp `check (length(trim(name)) between 1 and 200)` (`0013:75`). */
export function validateProjectName(raw: unknown): Validation {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false, error: "Tên dự án không được để trống." };
  if (value.length > 200) return { ok: false, error: "Tên dự án dài quá 200 ký tự." };
  return { ok: true, value };
}

/** Giới hạn khớp `check (length(trim(body)) between 1 and 20000)` (`0013:157`). */
export function validateCommentBody(raw: unknown): Validation {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false, error: "Bình luận không được để trống." };
  if (value.length > 20000) return { ok: false, error: "Bình luận dài quá 20.000 ký tự." };
  return { ok: true, value };
}

/**
 * Hạn hoàn thành: nhận `yyyy-mm-dd` từ `<input type="date">`, trả ISO hoặc null.
 * Chuỗi rỗng là hợp lệ và nghĩa là "bỏ hạn".
 */
export function parseDueDate(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: "Hạn không đúng định dạng ngày." };
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return { ok: false, error: "Hạn không phải một ngày có thật." };
  return { ok: true, value: parsed.toISOString() };
}

/* ------------------------------------------------------------------ sắp xếp bảng kanban */

export interface TaskCard {
  id: string;
  stageId: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  dueAt: string | null;
  position: number;
}

/**
 * Gom task về đúng cột stage, giữ thứ tự `position` rồi tới tiêu đề.
 *
 * Task trỏ vào một stage không có trong danh sách (về lý thuyết không xảy ra vì FK kép
 * `(stage_id, project_id)` ở `0013:130`) sẽ bị bỏ qua chứ không làm hỏng cả bảng.
 */
export function groupTasksByStage(
  stages: StageView[],
  tasks: TaskCard[],
): Array<{ stage: StageView; tasks: TaskCard[] }> {
  const byStage = new Map<string, TaskCard[]>(stages.map((s) => [s.id, []]));
  for (const task of tasks) byStage.get(task.stageId)?.push(task);

  return [...stages]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((stage) => ({
      stage,
      tasks: (byStage.get(stage.id) ?? []).sort(
        (a, b) => a.position - b.position || a.title.localeCompare(b.title, "vi"),
      ),
    }));
}

/** `position` cho card thả vào cuối một cột. Bậc thang 1000 để chèn giữa mà không cần đánh số lại. */
export function nextPosition(tasksInStage: TaskCard[]): number {
  return tasksInStage.reduce((max, t) => Math.max(max, t.position), 0) + 1000;
}

/**
 * Chỉ những người có vai trò `developer` mới được giao việc.
 *
 * Không phải lựa chọn giao diện mà là ràng buộc cơ sở dữ liệu: cột hằng
 * `assignee_role = 'developer'` cộng khoá ngoại ba cột tới `project_members`
 * (`0013:121-132`). Lọc ở đây để người dùng không chọn được thứ chắc chắn bị từ chối.
 */
export function assignableMembers<T extends { role: ProjectRole }>(members: T[]): T[] {
  return members.filter((m) => m.role === "developer");
}

/* ------------------------------------------------------------------ chuyển đổi hàng DB */

/**
 * Đổi hàng cơ sở dữ liệu (snake_case) sang hình dạng dùng trong giao diện.
 *
 * Có hai lý do tách ra thay vì dùng thẳng hàng DB: các hàm thuần phía trên kiểm thử được
 * mà không cần biết tên cột, và khi `src/types/database.ts` được sinh lại (mục C9) thì
 * chỗ phải sửa gói gọn ở đây.
 */
export function toStageView(row: {
  id: string;
  ordinal: number;
  title: string;
  approved_at: string | null;
}): StageView {
  return { id: row.id, ordinal: row.ordinal, title: row.title, approvedAt: row.approved_at };
}

export function toTaskCard(row: {
  id: string;
  stage_id: string;
  title: string;
  status: string;
  assignee_id: string | null;
  due_at: string | null;
  position: number;
}): TaskCard {
  return {
    id: row.id,
    stageId: row.stage_id,
    title: row.title,
    status: isTaskStatus(row.status) ? row.status : "todo",
    assigneeId: row.assignee_id,
    dueAt: row.due_at,
    position: row.position,
  };
}
