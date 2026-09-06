import { requireProjectMember } from "@/lib/auth";
import { getMethodology, getStandard } from "../../../../data";
import { getPeriod, getReport, listProjectActors } from "../../../giam-sat/data";

/**
 * Tải số liệu của báo cáo dưới dạng CSV.
 *
 * Xuất từ ẢNH CHỤP lưu trong báo cáo, không truy vấn lại dữ liệu hiện thời — nếu không
 * thì tệp tải về hôm nay có thể khác con số trong chính báo cáo đó.
 *
 * `requireProjectMember` chặn người ngoài; RLS vẫn là lớp thật vì `getReport` chạy bằng
 * phiên người dùng và trả null cho người không có quyền.
 */

/** Bọc trường theo RFC 4180. Chặn cả ký tự mở đầu công thức để tệp mở bằng bảng tính
 *  không tự chạy công thức do người khác nhập vào. */
function cell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  const { id, reportId } = await params;
  await requireProjectMember(id);

  const report = await getReport(id, reportId);
  if (!report) return new Response("Không tìm thấy báo cáo.", { status: 404 });

  const [period, standard, methodology, actors] = await Promise.all([
    getPeriod(id, report.period_id),
    getStandard(report.standard_id),
    getMethodology(report.methodology_id),
    listProjectActors(id),
  ]);
  const requester = actors.find((actor) => actor.userId === report.requested_by);
  const results = report.results as {
    estimated_credit?: { calculation_id?: string; value?: string; unit?: string };
    calculations?: Record<string, { value: string; unit: string; aggregation: string }>;
  };
  const snapshot = (report.input_snapshot ?? []) as Array<{
    record_key: string;
    observed_on: string;
    metric_values: Record<string, unknown>;
  }>;

  const lines: string[] = [];
  lines.push(cell("BÁO CÁO ƯỚC TÍNH MRV — KHÔNG PHẢI TÍN CHỈ ĐÃ PHÁT HÀNH"));
  lines.push(cell("Bản trình bày nội bộ, không phải mẫu chính thức của tổ chức chứng nhận"));
  lines.push("");
  lines.push([cell("Kỳ giám sát"), cell(period?.name ?? "")].join(","));
  lines.push([cell("Khoảng thời gian"), cell(`${period?.start_date} → ${period?.end_date}`)].join(","));
  lines.push([cell("Bản báo cáo"), cell(report.version)].join(","));
  lines.push([cell("Trạng thái"), cell(report.status)].join(","));
  lines.push([cell("Standard"), cell(standard?.code ?? "")].join(","));
  lines.push([cell("Methodology"), cell(methodology?.code ?? "")].join(","));
  lines.push([cell("Methodology version"), cell(methodology?.version ?? "")].join(","));
  lines.push([cell("Methodology SAMPLE"), cell(methodology?.is_sample ? "Có — tự soạn, chưa thẩm định" : "Không")].join(","));
  lines.push([cell("Phiên bản engine"), cell(report.engine_version)].join(","));
  lines.push([cell("Số hiệu bản dữ liệu"), cell(report.data_revision)].join(","));
  lines.push([cell("Người yêu cầu"), cell(requester?.fullName ?? ""), cell(report.requested_by)].join(","));
  lines.push([cell("Sinh lúc"), cell(report.generated_at)].join(","));
  lines.push([cell("Mã băm lược đồ"), cell(report.schema_hash)].join(","));
  lines.push("");

  lines.push([cell("Ước tính"), cell(results.estimated_credit?.calculation_id ?? "")].join(","));
  lines.push(
    [cell("Giá trị"), cell(results.estimated_credit?.value ?? ""), cell(results.estimated_credit?.unit ?? "")].join(","),
  );
  lines.push("");

  lines.push([cell("Chỉ số tính"), cell("Giá trị"), cell("Đơn vị"), cell("Cách gộp")].join(","));
  for (const [key, value] of Object.entries(results.calculations ?? {}))
    lines.push([cell(key), cell(value.value), cell(value.unit), cell(value.aggregation)].join(","));
  lines.push("");

  const metricKeys = [...new Set(snapshot.flatMap((r) => Object.keys(r.metric_values ?? {})))].sort();
  lines.push([cell("record_key"), cell("observed_on"), ...metricKeys.map(cell)].join(","));
  for (const row of snapshot)
    lines.push(
      [cell(row.record_key), cell(row.observed_on), ...metricKeys.map((k) => cell(row.metric_values?.[k]))].join(","),
    );

  // BOM để Excel trên Windows nhận đúng UTF-8 cho tiếng Việt.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bao-cao-mrv-${report.version}.csv"`,
      "cache-control": "no-store",
    },
  });
}
