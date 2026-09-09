"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { parseMetricSchema } from "@/lib/methodology/schema";

export interface CatalogResult {
  ok: boolean;
  message: string;
}

const ok = (message: string): CatalogResult => ({ ok: true, message });
const fail = (message: string): CatalogResult => ({ ok: false, message });

/**
 * Vai trò kiểm lại ở server action, không chỉ ở trang: trang chặn để người dùng không
 * thấy màn hình, còn action mới là thứ ghi dữ liệu và gọi thẳng được bằng request tự dựng.
 *
 * Vẫn chỉ là lớp thứ hai. Policy `methodologies_insert`/`_update` và
 * `report_templates_insert`/`_update` (`0013:869-884`) đòi `app_is_admin()`, nên Postgres
 * từ chối kể cả khi hai lớp trên cùng hỏng.
 */
async function requireAdmin() {
  const profile = await requireProfile();
  return profile.role === "platform_admin" ? profile : null;
}

/**
 * Tạo methodology ở trạng thái `draft`.
 *
 * Trigger `project_guard_methodology` (`0013:474-494`) từ chối INSERT thẳng vào
 * `published` — phải tạo draft, thêm đủ hệ số theo `factor_requirements`, rồi mới publish.
 * Trình tự đó cố ý, và màn hình này đi theo chứ không tìm cách lách.
 *
 * `professionally_validated` KHÔNG có trong biểu mẫu. Nó chỉ được bật bởi
 * `markProfessionallyValidated`, sau khi có người đối chiếu và ghi tên mình vào.
 */
export async function createMethodologyDraft(form: FormData): Promise<CatalogResult> {
  if (!(await requireAdmin())) return fail("Chỉ quản trị nền tảng được sửa catalog.");

  const raw = String(form.get("metric_schema") ?? "").trim();
  if (!raw) return fail("Chưa dán metric_schema.");

  let schema: unknown;
  try {
    schema = JSON.parse(raw);
  } catch {
    return fail("metric_schema không phải JSON hợp lệ.");
  }

  // Kiểm ở client trước để báo lỗi đọc được, thay vì để Postgres ném raise exception thô.
  // DB vẫn kiểm lại bằng `project_validate_metric_schema` — đây không phải lớp bảo vệ.
  try {
    parseMetricSchema(schema);
  } catch (e) {
    return fail(`metric_schema chưa đúng khuôn: ${e instanceof Error ? e.message : String(e)}`);
  }

  const isSample = form.get("is_sample") === "on";
  const disclaimer = String(form.get("disclaimer") ?? "").trim();
  if (!disclaimer) {
    return fail(
      "Phải ghi disclaimer. Đây là chỗ nói cho người dùng biết dữ liệu này đến từ đâu và " +
        "đã được đối chiếu tới mức nào.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("methodologies").insert({
    standard_id: String(form.get("standard_id") ?? ""),
    code: String(form.get("code") ?? "").trim(),
    version: String(form.get("version") ?? "").trim(),
    name: String(form.get("name") ?? "").trim(),
    project_type: String(form.get("project_type") ?? "").trim(),
    status: "draft",
    is_sample: isSample,
    professionally_validated: false,
    disclaimer,
    metric_schema: schema,
  } as never);

  if (error) return fail(`Không tạo được: ${error.message}`);
  revalidatePath("/quan-tri/catalog");
  return ok("Đã tạo bản draft. Thêm đủ hệ số rồi mới publish được.");
}

/** Thêm một hệ số cho methodology còn ở `draft`. */
export async function addFactor(form: FormData): Promise<CatalogResult> {
  if (!(await requireAdmin())) return fail("Chỉ quản trị nền tảng được sửa catalog.");

  const value = String(form.get("value") ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(value)) return fail("Giá trị hệ số phải là số thập phân.");

  const source = String(form.get("source") ?? "").trim();
  if (!source) {
    return fail(
      "Phải ghi nguồn của hệ số — mục nào, trang nào trong tài liệu gốc. Một con số không " +
        "có nguồn thì không đối chiếu lại được.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("methodology_factors").insert({
    methodology_id: String(form.get("methodology_id") ?? ""),
    key: String(form.get("key") ?? "").trim(),
    value,
    unit: String(form.get("unit") ?? "").trim(),
    source,
  } as never);

  if (error) return fail(`Không thêm được hệ số: ${error.message}`);
  revalidatePath("/quan-tri/catalog");
  return ok("Đã thêm hệ số.");
}

/**
 * Publish: chuyển `draft` sang `published`.
 *
 * Trigger kiểm đủ hệ số theo `factor_requirements` trước khi cho qua, và sau khi published
 * thì methodology bất biến — sửa là phải tạo version mới. Đó là lý do báo cáo MRV cũ không
 * bao giờ đổi số khi catalog được cập nhật.
 */
export async function publishMethodology(id: string): Promise<CatalogResult> {
  if (!(await requireAdmin())) return fail("Chỉ quản trị nền tảng được sửa catalog.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("methodologies")
    .update({ status: "published" } as never)
    .eq("id", id);

  if (error) return fail(`Không publish được: ${error.message}`);
  revalidatePath("/quan-tri/catalog");
  return ok("Đã publish. Từ giờ methodology này bất biến; sửa thì tạo version mới.");
}

/**
 * Bật `professionally_validated`.
 *
 * Tách khỏi biểu mẫu tạo methodology một cách có chủ ý. Cờ này không mô tả dữ liệu — nó
 * ghi nhận rằng **một người có chuyên môn đã đối chiếu `metric_schema` với tài liệu gốc và
 * chịu trách nhiệm cho việc đối chiếu đó**. Bật nó cùng lúc với việc nhập dữ liệu sẽ biến
 * nó thành một ô tick cho đủ, đúng thứ nó sinh ra để chống lại.
 *
 * Hệ quả thật: `create_mrv_report` (`0013:833`) chỉ cho xuất bản `final` khi cờ này bật.
 * Bật sai là mở đường cho một con số chưa ai kiểm đi vào hồ sơ tín chỉ carbon.
 */
export async function markProfessionallyValidated(
  id: string,
  form: FormData,
): Promise<CatalogResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("Chỉ quản trị nền tảng được sửa catalog.");

  const reviewer = String(form.get("reviewer") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  if (reviewer.length < 3 || note.length < 20) {
    return fail(
      "Phải ghi tên người đối chiếu và tóm tắt việc đã đối chiếu (ít nhất 20 ký tự). " +
        "Cờ này nói có người chịu trách nhiệm — không có tên thì không có trách nhiệm.",
    );
  }

  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("methodologies")
    .select("disclaimer, is_sample")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !current) return fail("Không đọc được methodology.");

  const row = current as { disclaimer: string; is_sample: boolean };
  if (row.is_sample) {
    return fail(
      "Methodology đang gắn cờ dữ liệu MẪU. Dữ liệu mẫu không thể được thẩm định — bỏ cờ " +
        "mẫu trước, hoặc tạo bản dựng từ tài liệu gốc.",
    );
  }

  // Ghi dấu vết vào chính disclaimer: ai đối chiếu, lúc nào, đối chiếu cái gì. DB chưa có
  // bảng audit cho catalog, và một cờ boolean không nói được điều đó.
  const stamp =
    `${row.disclaimer}\n\n[Đã đối chiếu] ${reviewer}, ` +
    `${new Date().toISOString().slice(0, 10)}: ${note}`;

  const { error } = await supabase
    .from("methodologies")
    .update({ professionally_validated: true, disclaimer: stamp } as never)
    .eq("id", id);

  if (error) return fail(`Không cập nhật được: ${error.message}`);
  revalidatePath("/quan-tri/catalog");
  return ok(`Đã ghi nhận ${reviewer} đối chiếu methodology này.`);
}
