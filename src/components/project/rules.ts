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
 * Danh sách kiểm điều kiện duyệt — CHÉP TỪ `approve_project_stage`, không thêm gì.
 *
 * RPC ở `0013_project_platform.sql:696-714` kiểm đúng bảy điều và không kiểm gì khác.
 * Đặc biệt: tài liệu đã tải lên và công việc đã xong KHÔNG phải điều kiện duyệt. Màn
 * hình bảy bước hiện nguyên danh sách này để người dùng biết chính xác cái gì chặn mình,
 * thay vì bấm rồi nhận một thông báo lỗi thô từ Postgres.
 */
export type CheckState = "pass" | "fail" | "unknown" | "not_applicable";

export interface ApprovalCheck {
  id: string;
  /** Điều kiện, diễn đạt đúng như RPC cưỡng chế. */
  requirement: string;
  /** Dòng trong `0013_project_platform.sql` để đối chiếu. */
  source: string;
  state: CheckState;
  /** Cụ thể đang thiếu gì, hoặc vì sao không áp dụng. */
  detail?: string;
}

export interface ApprovalContext extends ProjectGate {
  /** `app_project_role(project) = 'owner'` — vế thứ hai của dòng 701. */
  isOwner?: boolean;
  /** `deleted_at is null` — vế `for update` ở dòng 700. */
  projectDeleted?: boolean;
  /**
   * Lỗi baseline, đã lọc về đúng những phép kiểm mà `project_validate_values` thực hiện.
   * Dùng `baselineGateErrors()` để lọc. Bỏ trống nghĩa là chưa kiểm được → `unknown`.
   */
  baselineErrors?: Array<{ field: string; message: string }>;
}

export function approvalChecklist(
  stages: StageView[],
  ordinal: number,
  ctx: ApprovalContext,
): ApprovalCheck[] {
  const pendingBefore = stages
    .filter((s) => s.ordinal < ordinal && !s.approvedAt)
    .map((s) => s.ordinal);

  const checks: ApprovalCheck[] = [
    {
      id: "project_active",
      requirement: "Dự án còn hoạt động (`deleted_at is null`)",
      source: "0013:700",
      state: ctx.projectDeleted ? "fail" : "pass",
      detail: ctx.projectDeleted ? "Dự án đã bị xoá mềm; mọi đường ghi đóng lại." : undefined,
    },
    {
      id: "owner",
      requirement: "Người bấm duyệt là chủ dự án (`app_project_role = 'owner'`)",
      source: "0013:701",
      state: ctx.isOwner === undefined ? "unknown" : ctx.isOwner ? "pass" : "fail",
      detail:
        ctx.isOwner === false ? "Vai trò của bạn trong dự án này không phải chủ dự án." : undefined,
    },
    {
      id: "ordinal_range",
      requirement: "Bước nằm trong 1..7",
      source: "0013:702",
      state: ordinal >= 1 && ordinal <= 7 ? "pass" : "fail",
    },
    {
      id: "sequence",
      requirement: "Mọi bước trước đã được duyệt",
      source: "0013:703-705",
      state: pendingBefore.length === 0 ? "pass" : "fail",
      detail:
        pendingBefore.length > 0 ? `Bước ${pendingBefore.join(", ")} chưa duyệt.` : undefined,
    },
    {
      id: "standard_locked",
      requirement: "Standard đã khoá",
      source: "0013:706",
      state: ordinal < 3 ? "not_applicable" : ctx.standardLockedAt ? "pass" : "fail",
      detail:
        ordinal < 3
          ? "Chỉ áp dụng từ bước 3 trở đi."
          : ctx.standardLockedAt
            ? undefined
            : ctx.standardId
              ? "Đã chọn Standard nhưng chưa bấm khoá ở bước 3."
              : "Chưa chọn Standard ở bước 3.",
    },
    {
      id: "methodology_locked",
      requirement: "Methodology đã khoá",
      source: "0013:707",
      state: ordinal < 4 ? "not_applicable" : ctx.methodologyLockedAt ? "pass" : "fail",
      detail:
        ordinal < 4
          ? "Chỉ áp dụng từ bước 4 trở đi."
          : ctx.methodologyLockedAt
            ? undefined
            : ctx.methodologyId
              ? "Đã chọn Methodology nhưng chưa bấm khoá ở bước 4."
              : "Chưa chọn Methodology ở bước 4.",
    },
    {
      id: "baseline_valid",
      requirement: "Baseline qua được `project_validate_values(metric_schema, baseline, 'baseline')`",
      source: "0013:708-710",
      state:
        ordinal < 5
          ? "not_applicable"
          : ctx.baselineErrors === undefined
            ? "unknown"
            : ctx.baselineErrors.length === 0
              ? "pass"
              : "fail",
      detail:
        ordinal < 5
          ? "Chỉ áp dụng từ bước 5 trở đi."
          : ctx.baselineErrors === undefined
            ? "Chưa đọc được metric schema để kiểm trước."
            : ctx.baselineErrors.length > 0
              ? ctx.baselineErrors.map((e) => `${e.field || "(giá trị)"}: ${e.message}`).join("; ")
              : undefined,
    },
  ];

  return checks;
}

/**
 * Lọc lỗi của `validateValues` (TypeScript) về đúng tập mà SQL thực sự cưỡng chế.
 *
 * `project_validate_values` chỉ đọc `required`; nó KHÔNG cưỡng chế `required_if`, còn bộ
 * kiểm TypeScript thì có. Giữ nguyên sẽ khoá nút Duyệt ở những trường hợp cơ sở dữ liệu
 * chấp nhận — sai theo hướng nguy hiểm hơn, vì người dùng không có cách nào đi tiếp.
 */
export function baselineGateErrors(
  errors: Array<{ field: string; message: string }>,
  fields: Array<{ id: string; required: boolean }>,
): Array<{ field: string; message: string }> {
  const conditional = new Set(fields.filter((f) => !f.required).map((f) => f.id));
  return errors.filter((e) => !(e.message === "Required field" && conditional.has(e.field)));
}

/**
 * Vì sao chưa duyệt được một bước — trả về danh sách rỗng nghĩa là duyệt được.
 *
 * Dạng rút gọn của `approvalChecklist` cho những chỗ chỉ cần một dòng lý do. Chỉ tính
 * những điều kiện đã kết luận được (`fail`); `unknown` không bị coi là rào.
 */
export function approvalBlockers(
  stages: StageView[],
  ordinal: number,
  project: ApprovalContext,
): string[] {
  const target = stages.find((s) => s.ordinal === ordinal);
  if (!target) return ["Không tìm thấy bước này."];
  if (target.approvedAt) return ["Bước này đã được duyệt."];

  const failed = approvalChecklist(stages, ordinal, project).filter((c) => c.state === "fail");
  const label: Record<string, string> = {
    project_active: "Dự án đã bị xoá.",
    owner: "Chỉ chủ dự án được duyệt bước.",
    ordinal_range: "Bước không hợp lệ.",
    standard_locked: "Chưa khoá Standard (bước 3).",
    methodology_locked: "Chưa khoá Methodology (bước 4).",
    baseline_valid: "Baseline chưa hợp lệ theo metric schema (bước 5).",
  };

  return failed.map((c) =>
    c.id === "sequence"
      ? `Cần duyệt bước ${stages
          .filter((s) => s.ordinal < ordinal && !s.approvedAt)
          .map((s) => s.ordinal)
          .join(", ")} trước.`
      : (label[c.id] ?? c.requirement),
  );
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

/* ------------------------------------------------------------ cờ và bộ lọc công việc */

/**
 * Cờ suy ra từ một card, không đọc gì ngoài chính card và mốc thời gian truyền vào.
 *
 * `now` là tham số chứ không phải `Date.now()` bên trong: hàm phải thuần để kiểm thử
 * được, và server/client phải tính ra cùng một kết quả cho cùng một lần render.
 */
export interface TaskFlags {
  overdue: boolean;
  overdueDays: number;
  dueSoon: boolean;
  unassigned: boolean;
  blocked: boolean;
  /** Việc đang cản tiến độ: `blocked`, hoặc quá hạn mà chưa xong. */
  blocking: boolean;
}

const DAY = 86_400_000;

/** Nửa đêm UTC của ngày chứa `at` — `due_at` được lưu đúng ở mốc đó (xem `parseDueDate`). */
function startOfUtcDay(at: Date): number {
  return Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
}

export function taskFlags(task: TaskCard, now: Date): TaskFlags {
  const today = startOfUtcDay(now);
  const due = task.dueAt ? startOfUtcDay(new Date(task.dueAt)) : null;
  const open = task.status !== "done";
  const overdue = open && due !== null && due < today;
  const blocked = task.status === "blocked";
  return {
    overdue,
    overdueDays: overdue && due !== null ? Math.round((today - due) / DAY) : 0,
    dueSoon: open && !overdue && due !== null && due - today <= 7 * DAY,
    unassigned: task.assigneeId === null,
    blocked,
    blocking: blocked || overdue,
  };
}

export interface TaskFilter {
  text: string;
  /** `""` là không lọc. */
  assigneeId: string;
  status: string;
  stageId: string;
  onlyMine: boolean;
  onlyBlocking: boolean;
}

export const EMPTY_TASK_FILTER: TaskFilter = {
  text: "",
  assigneeId: "",
  status: "",
  stageId: "",
  onlyMine: false,
  onlyBlocking: false,
};

export function isFilterActive(filter: TaskFilter): boolean {
  return (
    filter.text.trim() !== "" ||
    filter.assigneeId !== "" ||
    filter.status !== "" ||
    filter.stageId !== "" ||
    filter.onlyMine ||
    filter.onlyBlocking
  );
}

/** Khớp không phân biệt hoa thường và dấu tổ hợp, để gõ "bang" tìm được "bằng". */
function normalize(value: string): string {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\u0111/gu, "d");
}

export function filterTasks(
  tasks: TaskCard[],
  filter: TaskFilter,
  context: { viewerId: string | null; now: Date },
): TaskCard[] {
  const needle = normalize(filter.text.trim());
  return tasks.filter((task) => {
    if (needle && !normalize(task.title).includes(needle)) return false;
    if (filter.assigneeId && task.assigneeId !== filter.assigneeId) return false;
    if (filter.status && task.status !== filter.status) return false;
    if (filter.stageId && task.stageId !== filter.stageId) return false;
    if (filter.onlyMine && task.assigneeId !== context.viewerId) return false;
    if (filter.onlyBlocking && !taskFlags(task, context.now).blocking) return false;
    return true;
  });
}

export const TASK_SORTS = ["stage", "status", "due", "assignee", "title"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export const TASK_SORT_LABEL: Record<TaskSort, string> = {
  stage: "Bước",
  status: "Trạng thái",
  due: "Hạn",
  assignee: "Người nhận",
  title: "Tên việc",
};

const STATUS_ORDER: Record<TaskStatus, number> = {
  blocked: 0,
  in_progress: 1,
  todo: 2,
  done: 3,
};

/**
 * Sắp xếp cho chế độ danh sách. Việc không có hạn luôn xuống cuối khi sắp theo hạn —
 * "chưa đặt hạn" không phải "hạn xa vô cùng", nhưng đẩy nó lên đầu thì che mất việc trễ.
 */
export function sortTasks(
  tasks: TaskCard[],
  sort: TaskSort,
  context: { stageOrdinal: (stageId: string) => number; memberName: (id: string | null) => string },
): TaskCard[] {
  const byTitle = (a: TaskCard, b: TaskCard) => a.title.localeCompare(b.title, "vi");
  const copy = [...tasks];
  switch (sort) {
    case "status":
      return copy.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byTitle(a, b));
    case "due":
      return copy.sort((a, b) => {
        if (a.dueAt === b.dueAt) return byTitle(a, b);
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return a.dueAt.localeCompare(b.dueAt);
      });
    case "assignee":
      return copy.sort(
        (a, b) =>
          context.memberName(a.assigneeId).localeCompare(context.memberName(b.assigneeId), "vi") ||
          byTitle(a, b),
      );
    case "title":
      return copy.sort(byTitle);
    default:
      return copy.sort(
        (a, b) =>
          context.stageOrdinal(a.stageId) - context.stageOrdinal(b.stageId) ||
          a.position - b.position ||
          byTitle(a, b),
      );
  }
}

/* ------------------------------------------------------------ danh mục nhiều dự án */

/**
 * Một dòng của `/du-an`. Mọi trường ở đây đọc được từ những bảng `0013` đã có; không có
 * trường nào cần schema mới.
 */
export interface PortfolioRow {
  id: string;
  name: string;
  description: string;
  role: ProjectRole;
  deletedAt: string | null;
  standardCode: string | null;
  methodologyCode: string | null;
  methodologyVersion: string | null;
  methodologySchemaHash: string | null;
  methodologyIsSample: boolean;
  standardLockedAt: string | null;
  methodologyLockedAt: string | null;
  approvedStages: number;
  /** Bước đang chờ duyệt — `ordinal` nhỏ nhất chưa có `approved_at`. */
  currentStage: { ordinal: number; title: string } | null;
  lastApprovedAt: string | null;
  openTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  myOpenTasks: number;
  latestPeriod: {
    name: string;
    startDate: string;
    endDate: string;
    version: number;
    status: "open" | "locked";
  } | null;
  updatedAt: string;
}

/**
 * Vì sao dự án này cần chú ý — gộp ba nguồn CÓ THẬT trong cơ sở dữ liệu: việc `blocked`,
 * việc quá hạn, và điều kiện khoá còn thiếu của bước đang chờ. Không suy đoán thêm.
 */
export function projectAttention(row: PortfolioRow): string[] {
  if (row.deletedAt) return [];
  const reasons: string[] = [];
  if (row.blockedTasks > 0) reasons.push(`${row.blockedTasks} việc đang vướng`);
  if (row.overdueTasks > 0) reasons.push(`${row.overdueTasks} việc quá hạn`);

  const ordinal = row.currentStage?.ordinal ?? null;
  if (ordinal !== null) {
    if (ordinal >= 3 && !row.standardLockedAt) reasons.push("Chưa khoá Standard");
    else if (ordinal >= 4 && !row.methodologyLockedAt) reasons.push("Chưa khoá Methodology");
  }
  return reasons;
}

export const PORTFOLIO_SORTS = ["updated", "name", "progress", "attention", "period"] as const;
export type PortfolioSort = (typeof PORTFOLIO_SORTS)[number];

export const PORTFOLIO_SORT_LABEL: Record<PortfolioSort, string> = {
  updated: "Cập nhật gần nhất",
  name: "Tên dự án",
  progress: "Tiến độ bảy bước",
  attention: "Việc đang chặn",
  period: "Kỳ giám sát gần nhất",
};

export interface PortfolioFilter {
  text: string;
  /** `""` là không lọc. */
  role: string;
  standard: string;
  /** `""` | `"planning"` (chưa duyệt hết) | `"designed"` (đủ 7/7). */
  progress: string;
  onlyAttention: boolean;
  includeDeleted: boolean;
}

export const EMPTY_PORTFOLIO_FILTER: PortfolioFilter = {
  text: "",
  role: "",
  standard: "",
  progress: "",
  onlyAttention: false,
  includeDeleted: false,
};

export function filterProjects(rows: PortfolioRow[], filter: PortfolioFilter): PortfolioRow[] {
  const needle = normalize(filter.text.trim());
  return rows.filter((row) => {
    if (!filter.includeDeleted && row.deletedAt) return false;
    if (needle && !normalize(`${row.name} ${row.description}`).includes(needle)) return false;
    if (filter.role && row.role !== filter.role) return false;
    if (filter.standard && (row.standardCode ?? "") !== filter.standard) return false;
    if (filter.progress === "planning" && row.approvedStages >= 7) return false;
    if (filter.progress === "designed" && row.approvedStages < 7) return false;
    if (filter.onlyAttention && projectAttention(row).length === 0) return false;
    return true;
  });
}

export function sortProjects(rows: PortfolioRow[], sort: PortfolioSort): PortfolioRow[] {
  const copy = [...rows];
  const byName = (a: PortfolioRow, b: PortfolioRow) => a.name.localeCompare(b.name, "vi");
  switch (sort) {
    case "name":
      return copy.sort(byName);
    case "progress":
      return copy.sort((a, b) => b.approvedStages - a.approvedStages || byName(a, b));
    case "attention":
      return copy.sort(
        (a, b) =>
          b.blockedTasks + b.overdueTasks - (a.blockedTasks + a.overdueTasks) ||
          projectAttention(b).length - projectAttention(a).length ||
          byName(a, b),
      );
    case "period":
      return copy.sort((a, b) => {
        const av = a.latestPeriod?.endDate ?? "";
        const bv = b.latestPeriod?.endDate ?? "";
        if (av === bv) return byName(a, b);
        if (!av) return 1;
        if (!bv) return -1;
        return bv.localeCompare(av);
      });
    default:
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b));
  }
}

/* ------------------------------------------------------------ khối lượng theo người */

export interface MemberWorkload {
  todo: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  done: number;
  open: number;
}

/** Việc đang giữ của từng `assignee_id`, kể cả người đã rời dự án (khoá là `assignee_id`). */
export function workloadByAssignee(
  tasks: TaskCard[],
  now: Date,
): Map<string, MemberWorkload> {
  const result = new Map<string, MemberWorkload>();
  for (const task of tasks) {
    if (!task.assigneeId) continue;
    const entry =
      result.get(task.assigneeId) ??
      { todo: 0, inProgress: 0, blocked: 0, overdue: 0, done: 0, open: 0 };
    if (task.status === "todo") entry.todo += 1;
    if (task.status === "in_progress") entry.inProgress += 1;
    if (task.status === "blocked") entry.blocked += 1;
    if (task.status === "done") entry.done += 1;
    else entry.open += 1;
    if (taskFlags(task, now).overdue) entry.overdue += 1;
    result.set(task.assigneeId, entry);
  }
  return result;
}

/**
 * Việc còn giao cho người KHÔNG còn trong `project_members`.
 *
 * Xảy ra được vì `set_project_member` gỡ thành viên mà không đụng `project_tasks`; khoá
 * ngoại ba cột chỉ chặn lúc GHI. Những việc này không ai nhận, nên phải nói ra.
 */
export function orphanedAssignments(
  tasks: TaskCard[],
  memberIds: Iterable<string>,
): TaskCard[] {
  const known = new Set(memberIds);
  return tasks.filter((t) => t.assigneeId !== null && !known.has(t.assigneeId));
}
