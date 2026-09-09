import { cache } from "react";
import { projectClient, requireProfile } from "@/lib/auth";
import { taskFlags, toTaskCard, type PortfolioRow } from "@/components/project/rules";
import type {
  Methodology,
  MonitoringPeriod,
  Project,
  ProjectDocument,
  ProjectFile,
  ProjectRole,
  ProjectStage,
  ProjectTask,
  Standard,
  TaskComment,
} from "@/types/project-platform";

/**
 * Đọc dữ liệu của nền tảng dự án.
 *
 * Mọi truy vấn ở đây chạy bằng PHIÊN CỦA NGƯỜI DÙNG, nên RLS trong
 * `0013_project_platform.sql` là thứ quyết định thấy được gì. Không hàm nào ở đây tự
 * kiểm quyền: người ngoài dự án nhận về mảng rỗng vì Postgres trả rỗng, không phải vì
 * mã ứng dụng lọc.
 *
 * Ghi thì ngược lại — xem các `actions.ts`: bảng chỉ-ghi-qua-RPC (`project_members`,
 * `project_stages`) không có quyền ghi trực tiếp nào.
 *
 * Tệp này chỉ chạy phía máy chủ. Không đánh dấu bằng gói `server-only` vì gói đó không
 * có trong `package.json` và bước 4 không được `npm install`; thay vào đó nó chỉ được
 * import từ Server Component và server action, không từ tệp nào có `"use client"`.
 */

/**
 * Danh mục dự án của người đang đăng nhập — một dòng cho mỗi dự án, đủ để trả lời bốn
 * câu mà người làm nhiều dự án hỏi trước tiên: đang ở bước mấy, Standard/Methodology
 * nào, kỳ giám sát gần nhất ra sao, cái gì đang chặn.
 *
 * Sáu truy vấn, không truy vấn nào theo từng dự án: PostgREST trả về mọi dòng mà RLS cho
 * phép, và việc gom nhóm làm ở đây. Với vài chục dự án thì rẻ hơn hẳn N+1.
 *
 * `assignee_id` được đối chiếu với `profile.id` để đếm "việc của tôi"; vai trò của tôi
 * cũng lọc theo `user_id` chứ không lấy dòng `project_members` đầu tiên — policy cho
 * thấy cả đồng đội, nên "dòng đầu tiên" hoàn toàn có thể là vai trò của người khác.
 */
export const listPortfolio = cache(async function listPortfolio(): Promise<PortfolioRow[]> {
  const profile = await requireProfile();
  const db = await projectClient();
  const now = new Date();

  const [{ data: projects }, { data: members }, { data: stages }, { data: tasks }, { data: periods }] =
    await Promise.all([
      db.from("projects").select("*").order("updated_at", { ascending: false }),
      db.from("project_members").select("project_id, user_id, role").eq("user_id", profile.id),
      db.from("project_stages").select("project_id, id, ordinal, title, approved_at").order("ordinal"),
      db
        .from("project_tasks")
        .select("id, project_id, stage_id, title, status, assignee_id, due_at, position"),
      db
        .from("monitoring_periods")
        .select("project_id, name, start_date, end_date, version, status")
        .order("start_date", { ascending: false })
        .order("version", { ascending: false }),
    ]);

  const rows = (projects ?? []) as Project[];
  if (rows.length === 0) return [];

  const [{ data: standards }, { data: methodologies }] = await Promise.all([
    db.from("standards").select("id, code"),
    db.from("methodologies").select("id, code, version, schema_hash, is_sample"),
  ]);

  const standardById = new Map(
    ((standards ?? []) as Pick<Standard, "id" | "code">[]).map((s) => [s.id, s]),
  );
  const methodologyById = new Map(
    (
      (methodologies ?? []) as Array<
        Pick<Methodology, "id" | "code" | "version" | "schema_hash" | "is_sample">
      >
    ).map((m) => [m.id, m]),
  );

  const myRole = new Map<string, ProjectRole>();
  for (const m of (members ?? []) as Array<{ project_id: string; role: ProjectRole }>)
    myRole.set(m.project_id, m.role);

  const stagesByProject = new Map<string, Array<Pick<ProjectStage, "ordinal" | "title" | "approved_at">>>();
  for (const s of (stages ?? []) as Array<
    Pick<ProjectStage, "project_id" | "ordinal" | "title" | "approved_at">
  >) {
    const list = stagesByProject.get(s.project_id) ?? [];
    list.push(s);
    stagesByProject.set(s.project_id, list);
  }

  const counts = new Map<string, { open: number; blocked: number; overdue: number; mine: number }>();
  for (const row of (tasks ?? []) as ProjectTask[]) {
    const card = toTaskCard(row);
    const flags = taskFlags(card, now);
    const entry = counts.get(row.project_id) ?? { open: 0, blocked: 0, overdue: 0, mine: 0 };
    if (card.status !== "done") {
      entry.open += 1;
      if (card.assigneeId === profile.id) entry.mine += 1;
    }
    if (flags.blocked) entry.blocked += 1;
    if (flags.overdue) entry.overdue += 1;
    counts.set(row.project_id, entry);
  }

  // Kỳ đã sắp xếp giảm dần theo `start_date` rồi `version`, nên dòng đầu tiên gặp được
  // của mỗi dự án là kỳ mới nhất. "Mới nhất" KHÔNG phải "đang có hiệu lực": schema chưa
  // có `supersedes`, xem `docs/design/pages-module-a.md`.
  const latestPeriod = new Map<string, PortfolioRow["latestPeriod"]>();
  for (const p of (periods ?? []) as Array<
    Pick<MonitoringPeriod, "project_id" | "name" | "start_date" | "end_date" | "version" | "status">
  >)
    if (!latestPeriod.has(p.project_id))
      latestPeriod.set(p.project_id, {
        name: p.name,
        startDate: p.start_date,
        endDate: p.end_date,
        version: p.version,
        status: p.status,
      });

  return rows.map((p) => {
    const projectStages = (stagesByProject.get(p.id) ?? []).slice().sort((a, b) => a.ordinal - b.ordinal);
    const approved = projectStages.filter((s) => s.approved_at);
    const pending = projectStages.find((s) => !s.approved_at) ?? null;
    const methodology = p.methodology_id ? methodologyById.get(p.methodology_id) : undefined;
    const count = counts.get(p.id) ?? { open: 0, blocked: 0, overdue: 0, mine: 0 };

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      role: myRole.get(p.id) ?? "viewer",
      deletedAt: p.deleted_at,
      standardCode: p.standard_id ? (standardById.get(p.standard_id)?.code ?? null) : null,
      methodologyCode: methodology ? methodology.code : null,
      methodologyVersion: methodology?.version ?? null,
      methodologySchemaHash: methodology?.schema_hash ?? null,
      methodologyIsSample: methodology?.is_sample ?? false,
      standardLockedAt: p.standard_locked_at,
      methodologyLockedAt: p.methodology_locked_at,
      approvedStages: approved.length,
      currentStage: pending ? { ordinal: pending.ordinal, title: pending.title } : null,
      lastApprovedAt:
        approved.reduce<string | null>(
          (max, s) => (s.approved_at && (!max || s.approved_at > max) ? s.approved_at : max),
          null,
        ) ?? null,
      openTasks: count.open,
      blockedTasks: count.blocked,
      overdueTasks: count.overdue,
      myOpenTasks: count.mine,
      latestPeriod: latestPeriod.get(p.id) ?? null,
      updatedAt: p.updated_at,
    } satisfies PortfolioRow;
  });
});

export const getStandard = cache(async function getStandard(
  id: string | null,
): Promise<Standard | null> {
  if (!id) return null;
  const db = await projectClient();
  const { data } = await db.from("standards").select("*").eq("id", id).maybeSingle();
  return (data as Standard | null) ?? null;
});

export const getProject = cache(async function getProject(
  projectId: string,
): Promise<Project | null> {
  const db = await projectClient();
  const { data } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
  return (data as Project | null) ?? null;
});

export const getStages = cache(async function getStages(projectId: string): Promise<ProjectStage[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_stages")
    .select("*")
    .eq("project_id", projectId)
    .order("ordinal");
  return (data ?? []) as ProjectStage[];
});

export const getTasks = cache(async function getTasks(projectId: string): Promise<ProjectTask[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("position");
  return (data ?? []) as ProjectTask[];
});

export const getTask = cache(async function getTask(
  projectId: string,
  taskId: string,
): Promise<ProjectTask | null> {
  const db = await projectClient();
  const { data } = await db
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", taskId)
    .maybeSingle();
  return (data as ProjectTask | null) ?? null;
});

export const getTaskComments = cache(async function getTaskComments(
  taskId: string,
): Promise<TaskComment[]> {
  const db = await projectClient();
  const { data } = await db
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at");
  return (data ?? []) as TaskComment[];
});

export interface AttachmentView {
  id: string;
  fileId: string;
  originalName: string;
  sizeBytes: number;
  /** SHA-256 do server tính lúc tải lên — thứ cần trích dẫn khi đối chiếu bằng chứng. */
  checksum: string;
  mimeType: string;
  uploadedBy: string | null;
  createdAt: string;
}

export const getTaskAttachments = cache(async function getTaskAttachments(
  taskId: string,
): Promise<AttachmentView[]> {
  const db = await projectClient();
  const { data } = await db
    .from("task_attachments")
    .select(
      "id, file_id, created_at, project_files ( original_name, size_bytes, checksum, mime_type, uploaded_by )",
    )
    .eq("task_id", taskId)
    .order("created_at");

  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row): AttachmentView[] => {
    const file = row.project_files as Pick<
      ProjectFile,
      "original_name" | "size_bytes" | "checksum" | "mime_type" | "uploaded_by"
    > | null;
    if (typeof row.id !== "string" || typeof row.file_id !== "string") return [];
    return [
      {
        id: row.id,
        fileId: row.file_id,
        originalName: file?.original_name ?? "(không rõ tên tệp)",
        sizeBytes: file?.size_bytes ?? 0,
        checksum: file?.checksum ?? "",
        mimeType: file?.mime_type ?? "",
        uploadedBy: file?.uploaded_by ?? null,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
      },
    ];
  });
});

export interface DocumentView extends ProjectDocument {
  originalName: string;
  sizeBytes: number;
}

export const getDocuments = cache(async function getDocuments(
  projectId: string,
): Promise<DocumentView[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_documents")
    .select("*, project_files ( original_name, size_bytes )")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const file = row.project_files as Pick<ProjectFile, "original_name" | "size_bytes"> | null;
    return {
      ...(row as unknown as ProjectDocument),
      originalName: file?.original_name ?? "(không rõ tên tệp)",
      sizeBytes: file?.size_bytes ?? 0,
    };
  });
});

export const getProjectFiles = cache(async function getProjectFiles(
  projectId: string,
): Promise<ProjectFile[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ProjectFile[];
});

/** Catalog: chỉ methodology đã `published` đi qua được policy đọc (`0013:869`). */
export const listStandards = cache(async function listStandards(): Promise<Standard[]> {
  const db = await projectClient();
  const { data } = await db.from("standards").select("*").order("code");
  return (data ?? []) as Standard[];
});

export const listMethodologies = cache(async function listMethodologies(
  standardId: string | null,
): Promise<Methodology[]> {
  if (!standardId) return [];
  const db = await projectClient();
  const { data } = await db
    .from("methodologies")
    .select("*")
    .eq("standard_id", standardId)
    .eq("status", "published")
    .order("code");
  return (data ?? []) as Methodology[];
});

export const getMethodology = cache(async function getMethodology(
  id: string | null,
): Promise<Methodology | null> {
  if (!id) return null;
  const db = await projectClient();
  const { data } = await db.from("methodologies").select("*").eq("id", id).maybeSingle();
  return (data as Methodology | null) ?? null;
});
