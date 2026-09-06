import { projectClient } from "@/lib/auth";
import type {
  Methodology,
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

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  role: ProjectRole;
  deletedAt: string | null;
  standardCode: string | null;
  methodologyCode: string | null;
  methodologyVersion: string | null;
  methodologySchemaHash: string | null;
  approvedStages: number;
  updatedAt: string;
}

/** Danh sách dự án của người đang đăng nhập. RLS đã lọc theo membership. */
export async function listMyProjects(): Promise<ProjectSummary[]> {
  const db = await projectClient();

  const [{ data: projects }, { data: members }, { data: stages }] = await Promise.all([
    db.from("projects").select("*").order("updated_at", { ascending: false }),
    db.from("project_members").select("project_id, user_id, role"),
    db.from("project_stages").select("project_id, approved_at"),
  ]);

  const rows = (projects ?? []) as Project[];
  if (rows.length === 0) return [];

  const { data: standards } = await db.from("standards").select("id, code");
  const { data: methodologies } = await db.from("methodologies").select("id, code, version, schema_hash");

  const standardCode = new Map(
    ((standards ?? []) as Pick<Standard, "id" | "code">[]).map((s) => [s.id, s.code]),
  );
  const methodologyCode = new Map(
    ((methodologies ?? []) as Pick<Methodology, "id" | "code" | "version" | "schema_hash">[]).map((m) => [
      m.id,
      `${m.code} · ${m.version}`,
    ]),
  );

  // Chỉ có membership của CHÍNH mình đi qua được policy đọc ở đây khi lọc theo user,
  // nhưng policy cho phép thấy cả đồng đội — nên lọc lại theo dự án là đủ và rẻ.
  const myRole = new Map<string, ProjectRole>();
  for (const m of (members ?? []) as Array<{ project_id: string; user_id: string; role: ProjectRole }>)
    if (!myRole.has(m.project_id)) myRole.set(m.project_id, m.role);

  const approved = new Map<string, number>();
  for (const s of (stages ?? []) as Array<{ project_id: string; approved_at: string | null }>)
    if (s.approved_at) approved.set(s.project_id, (approved.get(s.project_id) ?? 0) + 1);

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    role: myRole.get(p.id) ?? "viewer",
    deletedAt: p.deleted_at,
    standardCode: p.standard_id ? (standardCode.get(p.standard_id) ?? null) : null,
    methodologyCode: p.methodology_id ? (methodologyCode.get(p.methodology_id) ?? null) : null,
    methodologyVersion: p.methodology_id ? ((methodologies ?? []) as Array<Pick<Methodology, "id" | "version">>).find((m) => m.id === p.methodology_id)?.version ?? null : null,
    methodologySchemaHash: p.methodology_id ? ((methodologies ?? []) as Array<Pick<Methodology, "id" | "schema_hash">>).find((m) => m.id === p.methodology_id)?.schema_hash ?? null : null,
    approvedStages: approved.get(p.id) ?? 0,
    updatedAt: p.updated_at,
  }));
}

export async function getStandard(id: string | null): Promise<Standard | null> {
  if (!id) return null;
  const db = await projectClient();
  const { data } = await db.from("standards").select("*").eq("id", id).maybeSingle();
  return (data as Standard | null) ?? null;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = await projectClient();
  const { data } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
  return (data as Project | null) ?? null;
}

export async function getStages(projectId: string): Promise<ProjectStage[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_stages")
    .select("*")
    .eq("project_id", projectId)
    .order("ordinal");
  return (data ?? []) as ProjectStage[];
}

export async function getTasks(projectId: string): Promise<ProjectTask[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("position");
  return (data ?? []) as ProjectTask[];
}

export async function getTask(projectId: string, taskId: string): Promise<ProjectTask | null> {
  const db = await projectClient();
  const { data } = await db
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", taskId)
    .maybeSingle();
  return (data as ProjectTask | null) ?? null;
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const db = await projectClient();
  const { data } = await db
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at");
  return (data ?? []) as TaskComment[];
}

export interface AttachmentView {
  id: string;
  fileId: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
}

export async function getTaskAttachments(taskId: string): Promise<AttachmentView[]> {
  const db = await projectClient();
  const { data } = await db
    .from("task_attachments")
    .select("id, file_id, created_at, project_files ( original_name, size_bytes )")
    .eq("task_id", taskId)
    .order("created_at");

  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row): AttachmentView[] => {
    const file = row.project_files as Pick<ProjectFile, "original_name" | "size_bytes"> | null;
    if (typeof row.id !== "string" || typeof row.file_id !== "string") return [];
    return [
      {
        id: row.id,
        fileId: row.file_id,
        originalName: file?.original_name ?? "(không rõ tên tệp)",
        sizeBytes: file?.size_bytes ?? 0,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
      },
    ];
  });
}

export interface DocumentView extends ProjectDocument {
  originalName: string;
  sizeBytes: number;
}

export async function getDocuments(projectId: string): Promise<DocumentView[]> {
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
}

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ProjectFile[];
}

/** Catalog: chỉ methodology đã `published` đi qua được policy đọc (`0013:869`). */
export async function listStandards(): Promise<Standard[]> {
  const db = await projectClient();
  const { data } = await db.from("standards").select("*").order("code");
  return (data ?? []) as Standard[];
}

export async function listMethodologies(standardId: string | null): Promise<Methodology[]> {
  if (!standardId) return [];
  const db = await projectClient();
  const { data } = await db
    .from("methodologies")
    .select("*")
    .eq("standard_id", standardId)
    .eq("status", "published")
    .order("code");
  return (data ?? []) as Methodology[];
}

export async function getMethodology(id: string | null): Promise<Methodology | null> {
  if (!id) return null;
  const db = await projectClient();
  const { data } = await db.from("methodologies").select("*").eq("id", id).maybeSingle();
  return (data as Methodology | null) ?? null;
}
