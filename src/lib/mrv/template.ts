export interface ReportTemplateSnapshot {
  version: string;
  format: "pdf" | "docx";
  status: "placeholder" | "ready";
  bucketId: string;
  objectPath: string | null;
  checksum: string | null;
  disclaimer: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Đọc snapshot đã đóng băng cùng báo cáo; không suy trạng thái từ catalog hiện tại. */
export function parseReportTemplateSnapshot(value: unknown): ReportTemplateSnapshot | null {
  const row = record(value);
  if (!row) return null;

  const version = typeof row.version === "string" ? row.version.trim() : "";
  const format = row.format === "pdf" || row.format === "docx" ? row.format : null;
  const status = row.status === "placeholder" || row.status === "ready" ? row.status : null;
  const bucketId = typeof row.bucket_id === "string" ? row.bucket_id.trim() : "";
  const objectPath = typeof row.object_path === "string" ? row.object_path : null;
  const checksum = typeof row.checksum === "string" ? row.checksum : null;
  const disclaimer = typeof row.disclaimer === "string" ? row.disclaimer.trim() : "";

  if (!version || !format || !status || !bucketId || !disclaimer) return null;
  if (
    status === "ready" &&
    (!objectPath || !/^[0-9a-f]{64}$/.test(checksum ?? ""))
  )
    return null;

  return { version, format, status, bucketId, objectPath, checksum, disclaimer };
}

/** Khi đã có tệp thật, không tiếp tục mời người dùng sinh báo cáo bằng placeholder. */
export function preferReadyTemplates<T extends { status: "placeholder" | "ready" }>(
  templates: T[],
): T[] {
  const ready = templates.filter((template) => template.status === "ready");
  return ready.length > 0 ? ready : templates;
}

export function templateDownloadName(template: ReportTemplateSnapshot): string {
  const fallback = `report-template-${template.version}.${template.format}`;
  const leaf = template.objectPath?.split("/").at(-1)?.trim();
  return leaf ? leaf.replace(/\s+/g, "") : fallback;
}
