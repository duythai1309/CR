import { projectClient } from "@/lib/auth";
import type {
  MonitoringData,
  MonitoringImport,
  MonitoringPeriod,
  MrvReport,
} from "@/types/project-platform";

/**
 * Đọc dữ liệu giám sát và báo cáo.
 *
 * Chạy bằng phiên người dùng nên RLS quyết định thấy gì; bốn bảng này chỉ có policy
 * SELECT (`0013_project_platform.sql:912-915`), mọi đường ghi đi qua RPC.
 */

export async function listPeriods(projectId: string): Promise<MonitoringPeriod[]> {
  const db = await projectClient();
  const { data } = await db
    .from("monitoring_periods")
    .select("*")
    .eq("project_id", projectId)
    .order("start_date", { ascending: false })
    .order("version", { ascending: false });
  return (data ?? []) as MonitoringPeriod[];
}

export async function getPeriod(
  projectId: string,
  periodId: string,
): Promise<MonitoringPeriod | null> {
  const db = await projectClient();
  const { data } = await db
    .from("monitoring_periods")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", periodId)
    .maybeSingle();
  return (data as MonitoringPeriod | null) ?? null;
}

export async function getPeriodData(periodId: string): Promise<MonitoringData[]> {
  const db = await projectClient();
  const { data } = await db
    .from("monitoring_data")
    .select("*")
    .eq("period_id", periodId)
    .order("record_key");
  return (data ?? []) as MonitoringData[];
}

export async function listImports(periodId: string): Promise<MonitoringImport[]> {
  const db = await projectClient();
  const { data } = await db
    .from("monitoring_imports")
    .select("*")
    .eq("period_id", periodId)
    .order("created_at", { ascending: false });
  return (data ?? []) as MonitoringImport[];
}

export async function listReports(projectId: string): Promise<MrvReport[]> {
  const db = await projectClient();
  const { data } = await db
    .from("mrv_reports")
    .select("*")
    .eq("project_id", projectId)
    .order("generated_at", { ascending: false });
  return (data ?? []) as MrvReport[];
}

export interface ProjectActor {
  userId: string;
  fullName: string;
  role: string;
}

/** Danh tính hẹp trong phạm vi dự án qua RPC 0015; không mở quyền đọc bảng profiles. */
export async function listProjectActors(projectId: string): Promise<ProjectActor[]> {
  const db = await projectClient();
  const { data } = await db.rpc("project_member_directory", { p_project_id: projectId });
  return ((data ?? []) as Array<{ user_id: string; full_name: string; role: string }>).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    role: row.role,
  }));
}

export async function getReport(
  projectId: string,
  reportId: string,
): Promise<MrvReport | null> {
  const db = await projectClient();
  const { data } = await db
    .from("mrv_reports")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", reportId)
    .maybeSingle();
  return (data as MrvReport | null) ?? null;
}

export interface TemplateOption {
  id: string;
  version: string;
  format: "pdf" | "docx";
  status: "placeholder" | "ready";
  disclaimer: string;
}

/** Template của đúng cặp (Standard, Methodology) mà kỳ giám sát đang dùng. */
export async function listTemplates(
  methodologyId: string,
  standardId: string,
): Promise<TemplateOption[]> {
  const db = await projectClient();
  const { data } = await db
    .from("report_templates")
    .select("id, version, format, status, disclaimer")
    .eq("methodology_id", methodologyId)
    .eq("standard_id", standardId)
    .order("version");
  return (data ?? []) as TemplateOption[];
}
