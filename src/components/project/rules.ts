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

/* ------------------------------------------------------------------------ quyền ghi */

/**
 * Quyền trong một dự án.
 *
 * **Chính sách (09/09/2026): không còn vai trò dự án.** Ai là thành viên thì toàn quyền
 * xem, thêm, sửa, xoá bên trong dự án đó — kể cả duyệt bước và nhận việc.
 *
 * **Lớp kiểm THÀNH VIÊN vẫn còn nguyên và là thứ giữ an toàn.** Người không phải thành
 * viên vẫn không đọc và không ghi được gì: `requireProjectMember` trả 404, còn RLS đòi
 * `app_project_role(...) is not null`. Cái được gỡ là phân biệt GIỮA các vai trò, không
 * phải hàng rào quanh dự án.
 *
 * Tương ứng ở tầng cơ sở dữ liệu là 0022 (`app_project_can_write`, `approve_project_stage`,
 * `set_project_member`, `create_mrv_report`) và 0025 (khoá ngoại người nhận việc). Cột
 * `project_members.role` vẫn còn vì chốt "không xoá owner cuối cùng" (`0013:564`) đọc nó,
 * nhưng không màn hình nào hỏi hay hiện nó nữa.
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

export function abilitiesFor(projectDeleted = false): ProjectAbilities {
  // Ràng buộc CÒN LẠI DUY NHẤT: dự án đã xoá mềm thì đọc lịch sử vẫn được, mọi đường ghi
  // đóng lại. Đây là điều kiện `p.deleted_at is null` bên trong `app_project_can_write`
  // — 0022 giữ nguyên nó — chứ không phải phân quyền, nên nó không bị gỡ cùng.
  const allowed = !projectDeleted;
  return {
    canWriteTasks: allowed,
    canComment: allowed,
    canUploadFiles: allowed,
    canManageMembers: allowed,
    canApproveStage: allowed,
    canChooseStandard: allowed,
    canEditBaseline: allowed,
    canDeleteProject: allowed,
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

/** Gom task theo tiến độ công việc, luôn trả đủ bốn trạng thái theo thứ tự chuẩn. */
export function groupTasksByStatus(
  tasks: TaskCard[],
): Array<{ status: TaskStatus; tasks: TaskCard[] }> {
  const byStatus = new Map<TaskStatus, TaskCard[]>(TASK_STATUSES.map((status) => [status, []]));
  for (const task of tasks) byStatus.get(task.status)?.push(task);

  return TASK_STATUSES.map((status) => ({
    status,
    tasks: (byStatus.get(status) ?? []).sort(
      (a, b) => a.position - b.position || a.title.localeCompare(b.title, "vi"),
    ),
  }));
}

/** `position` cho card thả vào cuối một cột. Bậc thang 1000 để chèn giữa mà không cần đánh số lại. */
export function nextPosition(tasksInStage: TaskCard[]): number {
  return tasksInStage.reduce((max, t) => Math.max(max, t.position), 0) + 1000;
}

/**
 * Ai nhận được việc: MỌI thành viên của dự án.
 *
 * Trước 0025 đây là một bộ lọc thật — cột hằng `assignee_role = 'developer'` cộng khoá
 * ngoại ba cột (`0013:121-132`) khiến chủ dự án không tự giao việc cho mình được.
 * `0025_flat_task_assignee.sql` thay bằng khoá ngoại hai cột tới
 * `project_members(project_id, user_id)`, nên điều kiện còn lại đúng bằng "là thành
 * viên", và hàm này chỉ còn là chỗ ghi lại điều đó cho tám nơi gọi.
 */
export function assignableMembers<T>(members: T[]): T[] {
  return members;
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
  standard: string;
  /** `""` | `"planning"` (chưa duyệt hết) | `"designed"` (đủ 7/7). */
  progress: string;
  onlyAttention: boolean;
  includeDeleted: boolean;
}

export const EMPTY_PORTFOLIO_FILTER: PortfolioFilter = {
  text: "",
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

/* --------------------------------------------------- cột kanban do người dùng tự tạo */

/**
 * Cột của bảng Kanban, đọc từ `project_board_columns` (migration 0021).
 *
 * Khác `TASK_STATUSES` ở một điểm quyết định: đây là DỮ LIỆU của từng dự án, không phải
 * hằng số của hệ thống. Người dùng thêm, đổi tên, xoá và sắp xếp lại tuỳ ý, nên không mã
 * nào được giả định số cột, tên cột hay ý nghĩa của cột.
 */
export interface BoardColumnView {
  id: string;
  name: string;
  position: number;
}

/**
 * Card kèm cột kanban đang chứa nó. `columnId` null nghĩa là chưa xếp cột.
 *
 * `description` để panel sửa nhanh trên bảng không phải đi mạng thêm một vòng chỉ để lấy
 * mô tả; nó không tham gia vào việc gom cột hay tính thứ tự.
 */
export interface BoardTaskCard extends TaskCard {
  columnId: string | null;
  description?: string;
}

/** Giới hạn khớp `check (length(trim(name)) between 1 and 60)` của 0021. */
export const COLUMN_NAME_MAX = 60;

/**
 * Status ứng với một tên cột MẶC ĐỊNH, hoặc null nếu cột do người dùng tự đặt.
 *
 * **Chỉ được dùng làm cầu ghi `status` khi thả card** (§5.5 của thiết kế). Bốn cột mặc
 * định do migration 0021 seed ra trùng tên với `TASK_STATUS_LABEL`, nên thả vào chúng còn
 * suy được status cũ để năm chỗ đang đọc `status` chưa hỏng ngay.
 *
 * TUYỆT ĐỐI KHÔNG dùng hàm này để tính tiến độ, đếm "việc đã xong", hay đoán ý nghĩa của
 * một cột người dùng tự tạo. Cột tự do nghĩa là hệ thống KHÔNG còn biết thế nào là xong;
 * đoán sai một con số tiến độ tệ hơn hẳn việc không có con số.
 */
export function statusForColumnName(name: unknown): TaskStatus | null {
  if (typeof name !== "string") return null;
  const key = name.trim().toLocaleLowerCase("vi");
  return (
    TASK_STATUSES.find((status) => TASK_STATUS_LABEL[status].toLocaleLowerCase("vi") === key) ??
    null
  );
}

const byPositionThenTitle = (a: TaskCard, b: TaskCard) =>
  a.position - b.position || a.title.localeCompare(b.title, "vi");

/**
 * Gom card về đúng cột kanban, giữ thứ tự `position` rồi tới tiêu đề.
 *
 * Card trỏ vào một cột không có trong danh sách — hoặc chưa có cột nào — KHÔNG bị bỏ đi
 * mà rơi vào `orphans`. Giấu một card là mất việc của người dùng; bảng phải hiện nó ra và
 * để họ kéo về đúng chỗ.
 */
export function groupTasksByColumn(
  columns: BoardColumnView[],
  tasks: BoardTaskCard[],
): {
  columns: Array<{ column: BoardColumnView; tasks: BoardTaskCard[] }>;
  orphans: BoardTaskCard[];
} {
  const ordered = sortColumns(columns);
  const byColumn = new Map<string, BoardTaskCard[]>(ordered.map((c) => [c.id, []]));
  const orphans: BoardTaskCard[] = [];

  for (const task of tasks) {
    const bucket = task.columnId === null ? undefined : byColumn.get(task.columnId);
    if (bucket) bucket.push(task);
    else orphans.push(task);
  }

  return {
    columns: ordered.map((column) => ({
      column,
      tasks: (byColumn.get(column.id) ?? []).sort(byPositionThenTitle),
    })),
    orphans: orphans.sort(byPositionThenTitle),
  };
}

/** Thứ tự cột: `position` tăng dần, hoà thì theo tên để hai lần render không đảo nhau. */
export function sortColumns(columns: BoardColumnView[]): BoardColumnView[] {
  return [...columns].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name, "vi"),
  );
}

/** `position` cho cột mới thêm vào cuối bảng. Cùng bậc thang 1000 với `nextPosition`. */
export function nextColumnPosition(columns: BoardColumnView[]): number {
  return columns.reduce((max, c) => Math.max(max, c.position), 0) + 1000;
}

/**
 * Chèn giữa hai `position`, giữ nguyên bậc thang 1000 của `nextPosition`.
 *
 * `position` là `numeric` (`0013:124`) nên điểm giữa của hai số nguyên liền nhau vẫn ghi
 * được. Hai đầu để trống thì lùi/tiến đúng một bậc.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000;
  if (before === null) return (after as number) - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}

/** Đánh số lại cả một cột theo bậc thang 1000 — chỉ dùng khi hết chỗ chèn giữa. */
function ladder<T extends { id: string }>(items: T[]): Array<{ id: string; position: number }> {
  return items.map((item, index) => ({ id: item.id, position: (index + 1) * 1000 }));
}

/**
 * Những dòng `position` cần GHI sau khi kéo một phần tử tới vị trí `index`.
 *
 * `index` đếm trên danh sách ĐÃ BỎ phần tử đang kéo ra — đúng thứ mà giao diện tính được
 * từ chỗ thả. Nhờ vậy "thả lại chỗ cũ" là `index === vị trí hiện tại`, không phải lệch một.
 *
 * Thường chỉ trả một dòng: điểm giữa hai hàng xóm. Chỉ khi bậc thang hết chỗ — hai hàng
 * xóm trùng `position`, hoặc số thực đã cạn khoảng cách — mới đánh số lại cả cột. Mảng
 * rỗng nghĩa là không có gì đổi, khỏi đi mạng.
 */
function reorderInto<T extends { id: string; position: number }>(
  ordered: T[],
  movingId: string,
  index: number,
): Array<{ id: string; position: number }> {
  const currentIndex = ordered.findIndex((item) => item.id === movingId);
  if (currentIndex < 0) return [];

  const rest = ordered.filter((item) => item.id !== movingId);
  const target = Math.max(0, Math.min(index, rest.length));
  if (target === currentIndex) return [];

  return placeInto(rest, ordered[currentIndex], target);
}

/**
 * Đặt một phần tử CHƯA có trong danh sách vào vị trí `index`.
 *
 * Đây là phần chung của "kéo trong cùng cột" và "thả sang cột khác": cả hai đều quy về
 * việc tìm chỗ giữa hai hàng xóm trong một danh sách không chứa phần tử đang kéo.
 */
function placeInto<T extends { id: string; position: number }>(
  ordered: T[],
  moving: T,
  index: number,
): Array<{ id: string; position: number }> {
  const target = Math.max(0, Math.min(index, ordered.length));
  const before = target > 0 ? ordered[target - 1] : null;
  const after = target < ordered.length ? ordered[target] : null;
  const candidate = positionBetween(before?.position ?? null, after?.position ?? null);

  const tooTight =
    (before !== null && candidate <= before.position) ||
    (after !== null && candidate >= after.position);

  if (tooTight) {
    const final = [...ordered];
    final.splice(target, 0, moving);
    return ladder(final);
  }

  return [{ id: moving.id, position: candidate }];
}

/**
 * Kéo sắp xếp card trong CÙNG một cột.
 *
 * `ordered` phải là danh sách card của đúng cột đó, đã xếp theo thứ tự đang hiển thị.
 */
export function reorderWithinColumn(
  ordered: BoardTaskCard[],
  movingId: string,
  index: number,
): Array<{ id: string; position: number }> {
  return reorderInto(ordered, movingId, index);
}

/**
 * Thả một card SANG CỘT KHÁC, vào vị trí `index` của cột đích.
 *
 * `ordered` là card của cột đích, chưa chứa card đang kéo — nên `index` đếm thẳng trên
 * danh sách đó, không phải lệch một như khi kéo trong cùng cột.
 */
export function placeIntoColumn(
  ordered: BoardTaskCard[],
  moving: BoardTaskCard,
  index: number,
): Array<{ id: string; position: number }> {
  return placeInto(ordered, moving, index);
}

/**
 * Chỗ chèn trong danh sách ĐÃ BỎ card đang kéo ra.
 *
 * Nhận `shownIndex` — chỗ chèn tính trên danh sách ĐANG HIỆN — rồi tìm card đầu tiên từ
 * đó trở đi mà vẫn còn trong danh sách đầy đủ. Phải đi vòng như vậy vì bộ lọc có thể đang
 * ẩn bớt card: thả "ngay trên card X" phải nghĩa là ngay trên X trong DỮ LIỆU THẬT, chứ
 * không phải ô thứ `shownIndex` của một danh sách đã bị cắt bớt — nếu không, kéo trong
 * lúc đang lọc sẽ đặt card vào chỗ hoàn toàn khác với chỗ người dùng nhìn thấy.
 */
export function insertIndexFor(
  full: BoardTaskCard[],
  shown: BoardTaskCard[],
  shownIndex: number,
  movingId: string,
): number {
  const rest = full.filter((task) => task.id !== movingId);
  for (let k = shownIndex; k < shown.length; k += 1) {
    const candidate = shown[k];
    if (candidate.id === movingId) continue;
    const index = rest.findIndex((task) => task.id === candidate.id);
    if (index >= 0) return index;
  }
  return rest.length;
}

/** Kéo đổi thứ tự cột. Cùng thuật toán chèn giữa với card. */
export function reorderColumns(
  ordered: BoardColumnView[],
  movingId: string,
  index: number,
): Array<{ id: string; position: number }> {
  return reorderInto(sortColumns(ordered), movingId, index);
}

/**
 * Tên cột hợp lệ: khớp `check (length(trim(name)) between 1 and 60)` và `unique
 * (project_id, name)` của 0021.
 *
 * `taken` là tên các cột đang có; khi đổi tên thì truyền vào danh sách đã bỏ chính nó ra.
 */
export function validateColumnName(raw: unknown, taken: Iterable<string> = []): Validation {
  const value = String(raw ?? "").trim();
  if (value.length === 0) return { ok: false, error: "Tên cột không được để trống." };
  if (value.length > COLUMN_NAME_MAX)
    return { ok: false, error: `Tên cột tối đa ${COLUMN_NAME_MAX} ký tự.` };

  const key = value.toLocaleLowerCase("vi");
  for (const other of taken)
    if (other.trim().toLocaleLowerCase("vi") === key)
      return { ok: false, error: `Đã có cột tên "${other.trim()}" trong bảng này.` };

  return { ok: true, value };
}

/**
 * Vì sao chưa xoá được một cột — null nghĩa là xoá được.
 *
 * `column_id` là `on delete restrict` nên Postgres sẽ từ chối; câu này để người dùng biết
 * TRƯỚC, và biết còn bao nhiêu việc phải chuyển đi, thay vì nhận một lỗi khoá ngoại thô.
 */
export function columnDeleteBlocker(
  columnId: string,
  tasks: BoardTaskCard[],
  columnCount: number,
): string | null {
  const remaining = tasks.filter((task) => task.columnId === columnId).length;
  if (remaining > 0)
    return `Cột này còn ${remaining} công việc. Kéo chúng sang cột khác rồi mới xoá được.`;
  if (columnCount <= 1) return "Bảng phải còn ít nhất một cột.";
  return null;
}
