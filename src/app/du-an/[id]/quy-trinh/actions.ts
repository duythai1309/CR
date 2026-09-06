"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { projectClient, requireProjectMember } from "@/lib/auth";
import { formConfigError } from "@/lib/supabase/config";
import { buildMethodologyForm } from "@/lib/methodology/form";
import { validateValues, parseMetricSchema, type MetricValues } from "@/lib/methodology/schema";
import { isDocumentKind, DOCUMENT_KIND_LABEL } from "@/components/project/rules";
import { getMethodology, getProject } from "../../data";

type Result = { ok: boolean; message: string } | null;

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

function refresh(projectId: string) {
  revalidatePath(`/du-an/${projectId}/quy-trinh`);
  revalidatePath(`/du-an/${projectId}`);
}

/* ------------------------------------------------------------------ bước 3 và 4 */

/**
 * Chọn/khoá Standard rồi Methodology.
 *
 * Ghi thẳng vào `projects` vì bảng này có quyền UPDATE theo cột cho owner
 * (`0013_project_platform.sql:928`) và policy `projects_update` (`0013:888`). Việc khoá
 * là MỘT CHIỀU: `project_guard_project` (`0013:537-541`) từ chối mọi thay đổi sau khi
 * `*_locked_at` đã có giá trị, nên giao diện phải hỏi lại trước khi khoá.
 */
export async function chooseStandard(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return fail("Thiếu mã dự án.");
  await requireProjectMember(projectId, "owner");

  const standardId = String(formData.get("standard_id") ?? "").trim();
  if (!standardId) return fail("Chưa chọn Standard.");

  const lock = formData.get("lock") === "1";
  const db = await projectClient();
  const patch: Record<string, unknown> = { standard_id: standardId };
  // Đổi Standard thì Methodology cũ không còn thuộc về nó nữa; bỏ luôn để tránh
  // trạng thái mâu thuẫn mà trigger sẽ từ chối.
  patch.methodology_id = null;
  if (lock) patch.standard_locked_at = new Date().toISOString();

  const { error } = await db.from("projects").update(patch).eq("id", projectId);
  if (error) return fail(projectError(error.message));

  refresh(projectId);
  return ok(lock ? "Đã chọn và khoá Standard." : "Đã chọn Standard. Khoá lại khi chắc chắn.");
}

export async function chooseMethodology(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return fail("Thiếu mã dự án.");
  await requireProjectMember(projectId, "owner");

  const methodologyId = String(formData.get("methodology_id") ?? "").trim();
  if (!methodologyId) return fail("Chưa chọn Methodology.");

  const project = await getProject(projectId);
  if (!project) return fail("Không tìm thấy dự án.");
  if (!project.standard_locked_at) return fail("Phải khoá Standard ở bước 3 trước.");

  const lock = formData.get("lock") === "1";
  const db = await projectClient();
  const patch: Record<string, unknown> = { methodology_id: methodologyId };
  if (lock) patch.methodology_locked_at = new Date().toISOString();

  const { error } = await db.from("projects").update(patch).eq("id", projectId);
  if (error) return fail(projectError(error.message));

  refresh(projectId);
  return ok(
    lock
      ? "Đã chọn và khoá Methodology. Từ đây tạo được kỳ giám sát."
      : "Đã chọn Methodology. Khoá lại khi chắc chắn.",
  );
}

/* ------------------------------------------------------------------ bước 5: baseline */

/**
 * Lưu baseline theo `metric_schema` của Methodology đã khoá.
 *
 * Giá trị được đưa về đúng dạng canonical mà validator SQL đòi
 * (`project_validate_values`, `0013:430-472`): `decimal` là CHUỖI ASCII, `integer` là
 * SỐ, `boolean` là boolean. Kiểm trước bằng validator của Module B
 * (`src/lib/methodology/schema.ts`) để người dùng thấy lỗi theo từng ô thay vì một
 * thông báo chung từ cơ sở dữ liệu — nhưng cơ sở dữ liệu vẫn kiểm lại, đó mới là lớp thật.
 */
export async function saveBaseline(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return fail("Thiếu mã dự án.");
  await requireProjectMember(projectId, "owner");

  const project = await getProject(projectId);
  if (!project) return fail("Không tìm thấy dự án.");

  const methodology = await getMethodology(project.methodology_id);
  if (!methodology) return fail("Phải chọn Methodology ở bước 4 trước khi nhập baseline.");

  let schema;
  try {
    schema = parseMetricSchema(methodology.metric_schema);
  } catch {
    return fail("Methodology này có lược đồ chỉ số không đọc được. Báo quản trị nền tảng.");
  }

  const { baseline: fields } = buildMethodologyForm(methodology.metric_schema, "vi");
  const values: MetricValues = {};

  for (const field of fields) {
    const raw = formData.get(`f_${field.id}`);
    if (field.control === "checkbox") {
      values[field.id] = raw === "on" || raw === "true";
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue; // Bỏ trống: để validator quyết định có bắt buộc hay không.
    if (field.control === "integer") {
      if (!/^-?\d+$/.test(text)) return fail(`"${field.label}" phải là số nguyên.`);
      values[field.id] = Number(text);
    } else if (field.control === "decimal") {
      if (!/^-?\d+(\.\d+)?$/.test(text))
        return fail(`"${field.label}" phải là số dạng 123 hoặc 123.45 (dùng dấu chấm).`);
      values[field.id] = text;
    } else {
      values[field.id] = text;
    }
  }

  const errors = validateValues(schema, values, "baseline");
  if (errors.length > 0) {
    const first = errors[0];
    const label = fields.find((f) => f.id === first.field)?.label ?? first.field;
    return fail(`Chỉ số "${label}": ${first.message}`);
  }

  const db = await projectClient();
  const { error } = await db.from("projects").update({ baseline: values }).eq("id", projectId);
  if (error) return fail(projectError(error.message));

  refresh(projectId);
  return ok("Đã lưu baseline. Mỗi lần lưu tăng một số hiệu bản (baseline_revision).");
}

/* ------------------------------------------------------------------ duyệt bước */

/**
 * Duyệt một bước. Chỉ owner, và phải tuần tự — RPC `approve_project_stage`
 * (`0013:696-715`) tự kiểm lại toàn bộ điều kiện, giao diện chỉ nói trước lý do.
 */
export async function approveStage(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  const ordinal = Number(formData.get("ordinal"));
  if (!projectId || !Number.isInteger(ordinal)) return fail("Thiếu thông tin bước.");
  await requireProjectMember(projectId, "owner");

  const db = await projectClient();
  const { error } = await db.rpc("approve_project_stage", {
    p_project_id: projectId,
    p_ordinal: ordinal,
  });
  if (error) return fail(projectError(error.message));

  refresh(projectId);
  return ok(`Đã duyệt bước ${ordinal}.`);
}

/* ------------------------------------------------------------------ tài liệu */

/**
 * Tải tài liệu lên và ghi nhận một PHIÊN BẢN mới.
 *
 * Ba bước, đúng thứ tự: đưa bytes vào bucket `project-documents`, đăng ký metadata vào
 * `project_files` (kèm checksum SHA-256 của chính bytes vừa gửi), rồi gắn vào
 * `project_documents` với số phiên bản kế tiếp. `unique (project_id, kind, version)`
 * (`0013:178`) là thứ bảo đảm không hai người cùng ghi đè một phiên bản.
 *
 * Đường dẫn object phải là `{project_id}/{uploaded_by}/{uuid}/{tên tệp}` — cả ràng buộc
 * `check` trên bảng (`0013:147-149`) lẫn policy storage (`0013:957-960`) đều đòi đúng
 * hai cấp đầu, nên sai một cấp là bị từ chối ở cả hai nơi.
 */
export async function uploadDocument(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  const stageId = String(formData.get("stage_id") ?? "");
  if (!projectId || !stageId) return fail("Thiếu thông tin dự án hoặc bước.");
  const { profile } = await requireProjectMember(projectId, "developer");

  const kind = String(formData.get("kind") ?? "");
  if (!isDocumentKind(kind)) return fail("Loại tài liệu không hợp lệ.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Chưa chọn tệp.");
  if (file.size > 52_428_800) return fail("Tệp vượt quá 50 MB.");

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120) || "tai-lieu";
  const objectPath = `${projectId}/${profile.id}/${randomUUID()}/${safeName}`;

  const db = await projectClient();

  const upload = await db.storage
    .from("project-documents")
    .upload(objectPath, bytes, { contentType: file.type || "application/octet-stream" });
  if (upload.error) return fail(`Không tải được tệp lên: ${upload.error.message}`);

  const inserted = await db
    .from("project_files")
    .insert({
      project_id: projectId,
      object_path: objectPath,
      original_name: file.name.slice(0, 200),
      mime_type: file.type || "application/octet-stream",
      size_bytes: bytes.byteLength,
      checksum,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data)
    return fail(
      `Tệp đã lên kho nhưng chưa ghi nhận được: ${inserted.error?.message ?? "không rõ lý do"}`,
    );

  const { data: existing } = await db
    .from("project_documents")
    .select("version")
    .eq("project_id", projectId)
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion =
    (((existing ?? [])[0] as { version?: number } | undefined)?.version ?? 0) + 1;

  const linked = await db.from("project_documents").insert({
    project_id: projectId,
    stage_id: stageId,
    file_id: (inserted.data as { id: string }).id,
    kind,
    version: nextVersion,
  });

  if (linked.error)
    return linked.error.message.includes("duplicate key")
      ? fail("Vừa có người khác tải lên cùng lúc. Thử lại để nhận số phiên bản mới.")
      : fail(`Không gắn được tài liệu vào bước: ${linked.error.message}`);

  refresh(projectId);
  return ok(`Đã tải lên ${DOCUMENT_KIND_LABEL[kind]} — phiên bản ${nextVersion}.`);
}

function projectError(message: string): string {
  if (message.includes("Standard đã khóa"))
    return "Standard đã khoá, không đổi được nữa. Tạo dự án mới nếu cần Standard khác.";
  if (message.includes("Methodology đã khóa"))
    return "Methodology đã khoá, không đổi được nữa.";
  if (message.includes("methodology published"))
    return "Chỉ chọn được Methodology đã publish và đúng Standard của dự án.";
  if (message.includes("Chỉ owner")) return "Chỉ chủ dự án làm được việc này.";
  if (message.includes("Cần duyệt các stage trước"))
    return "Phải duyệt các bước trước theo đúng thứ tự.";
  if (message.includes("Chưa khóa Standard")) return "Chưa khoá Standard ở bước 3.";
  if (message.includes("Chưa khóa Methodology")) return "Chưa khoá Methodology ở bước 4.";
  if (message.includes("row-level security") || message.includes("permission denied"))
    return "Bạn không có quyền thực hiện thao tác này.";
  return `Không lưu được: ${message}`;
}
