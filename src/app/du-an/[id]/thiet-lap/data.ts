import { projectClient, requireProjectMember } from "@/lib/auth";
import type { ProjectSetup } from "@/types/project-setup";

export interface ProjectSetupRecord {
  projectId: string;
  projectName: string;
  setup: ProjectSetup;
  deletedAt: string | null;
  updatedAt: string;
}

function asSetup(value: unknown): ProjectSetup {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (structuredClone(value) as ProjectSetup)
    : {};
}

/** Đọc setup qua phiên người dùng; RLS chỉ trả dự án mà người gọi là thành viên. */
export async function getProjectSetupRecord(projectId: string): Promise<ProjectSetupRecord | null> {
  await requireProjectMember(projectId);
  const db = await projectClient();
  const { data, error } = await db
    .from("projects")
    .select("id, name, setup, deleted_at, updated_at")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(projectSetupDatabaseError(error.message));
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    projectId: String(row.id),
    projectName: String(row.name ?? ""),
    setup: asSetup(row.setup),
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

/** Chữ ký gọn cho Server Component của luồng setup. */
export async function getProjectSetup(projectId: string): Promise<ProjectSetup> {
  return (await getProjectSetupRecord(projectId))?.setup ?? {};
}

export function projectSetupDatabaseError(message: string): string {
  if (message.includes("setup") && (message.includes("column") || message.includes("schema cache")))
    return "Luồng khởi tạo chưa sẵn sàng vì migration 0017_project_setup.sql chưa được áp.";
  if (message.includes("permission denied"))
    return "Bạn không có quyền cập nhật dữ liệu khởi tạo của dự án này.";
  return `Không đọc được dữ liệu khởi tạo: ${message}`;
}
