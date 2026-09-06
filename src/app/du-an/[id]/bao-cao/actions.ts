"use server";

import { revalidatePath } from "next/cache";
import { projectClient, requireProjectMember } from "@/lib/auth";
import { formConfigError } from "@/lib/supabase/config";
import { compileMethodology } from "@/lib/methodology/expression";
import { estimateMrvReport } from "@/lib/mrv/report";
import { getPeriod, getPeriodData } from "../giam-sat/data";
import { createReportClient, missingServiceKeyMessage } from "./service-client";

type Result = { ok: boolean; message: string } | null;
const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

/**
 * Sinh báo cáo MRV từ một kỳ ĐÃ KHOÁ.
 *
 * Trình tự cố định (xem `service-client.ts` để biết vì sao):
 * xác thực bằng phiên người dùng → đọc kỳ và dữ liệu bằng client người dùng (RLS còn hiệu
 * lực) → tính bằng hàm thuần `estimateMrvReport` → chỉ bước ghi cuối dùng service role.
 *
 * `estimateMrvReport` tự từ chối nếu kỳ chưa khoá, dữ liệu lệch khỏi ảnh chụp, quan sát
 * nằm ngoài kỳ, hoặc hệ số thuộc methodology khác. Nó là chốt chặn thứ hai sau cơ sở dữ
 * liệu, không phải chốt duy nhất.
 */
export async function generateReport(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  const periodId = String(formData.get("period_id") ?? "");
  const templateId = String(formData.get("template_id") ?? "");
  const outputCalculation = String(formData.get("output_calculation") ?? "").trim();
  if (!projectId || !periodId) return fail("Thiếu thông tin kỳ giám sát.");
  if (!templateId) return fail("Chọn một template báo cáo.");
  if (!outputCalculation) return fail("Chọn chỉ số tính dùng làm ước tính tín chỉ của kỳ.");

  const { profile } = await requireProjectMember(projectId, "developer");

  const period = await getPeriod(projectId, periodId);
  if (!period) return fail("Không tìm thấy kỳ giám sát.");
  if (period.status !== "locked") return fail("Chỉ sinh báo cáo được từ kỳ đã khoá.");

  const records = await getPeriodData(periodId);

  let estimate;
  try {
    estimate = estimateMrvReport(period, records, outputCalculation);
  } catch (e) {
    return fail(`Không tính được báo cáo: ${e instanceof Error ? e.message : "lỗi không rõ"}`);
  }

  const service = createReportClient();
  if (!service) return fail(missingServiceKeyMessage());

  const { error } = await service.rpc("create_mrv_report", {
    p_period_id: periodId,
    p_template_id: templateId,
    p_results: estimate.results,
    p_trace: estimate.calculation_trace,
    p_engine_version: estimate.engine_version,
    // Lấy từ phiên đã xác thực ở trên, KHÔNG từ biểu mẫu.
    p_requested_by: profile.id,
    // Luôn là `preview`. Dữ liệu methodology hiện là mẫu chưa thẩm định, và
    // `create_mrv_report` (0013:838-840) từ chối `final` trong trường hợp đó — giao diện
    // phản ánh đúng điều đó thay vì tìm cách lách.
    p_status: "preview",
  });

  if (error) return fail(reportError(error.message));

  revalidatePath(`/du-an/${projectId}/bao-cao`);
  return ok("Đã sinh báo cáo ước tính từ ảnh chụp của kỳ.");
}

/**
 * Chỉ số tính dùng được làm ước tính tín chỉ của kỳ.
 *
 * `estimateMrvReport` đòi chọn TƯỜNG MINH một calculation có đơn vị `tCO2e` và gộp bằng
 * `sum` — cố ý không đoán theo tên hay lấy cái cuối cùng. Hàm này liệt kê đúng những ứng
 * viên hợp lệ để giao diện không mời người dùng chọn thứ chắc chắn bị từ chối.
 */
export async function creditCalculationOptions(schema: unknown): Promise<string[]> {
  try {
    const { schema: parsed } = compileMethodology(schema);
    return parsed.calculations
      .filter((c) => c.unit === "tCO2e" && c.aggregation === "sum")
      .map((c) => c.id);
  } catch {
    return [];
  }
}

function reportError(message: string): string {
  if (message.includes("Chỉ tạo report từ kỳ đã khóa"))
    return "Kỳ chưa khoá. Khoá kỳ trước khi sinh báo cáo.";
  if (message.includes("Template khác methodology"))
    return "Template được chọn không thuộc đúng Standard/Methodology của kỳ này.";
  if (message.includes("Final cần methodology đã thẩm định"))
    return "Dữ liệu methodology hiện là mẫu chưa thẩm định nên chỉ xuất được bản xem thử.";
  if (message.includes("Người yêu cầu không có quyền"))
    return "Bạn không có quyền sinh báo cáo cho dự án này.";
  return `Không sinh được báo cáo: ${message}`;
}
