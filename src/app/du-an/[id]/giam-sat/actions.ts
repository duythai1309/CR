"use server";

import { revalidatePath } from "next/cache";
import { projectClient, requireProjectMember } from "@/lib/auth";
import { formConfigError } from "@/lib/supabase/config";
import { buildMethodologyForm } from "@/lib/methodology/form";
import { parseMetricSchema, validateValues, type MetricValues } from "@/lib/methodology/schema";
import { parseCSV, prepareImportRecords, type ImportOptions } from "@/lib/monitoring/import";
import { getPeriod } from "./data";

/**
 * Ghi dữ liệu giám sát.
 *
 * Bốn bảng `monitoring_*` và `mrv_reports` **không có quyền ghi trực tiếp**
 * (`0013_project_platform.sql:918-925` thu hết, chỉ cấp lại SELECT), nên mọi thay đổi đi
 * qua RPC `security definer`. RPC tự khoá dòng dự án rồi dòng kỳ theo đúng thứ tự, kiểm
 * quyền và kiểm `expected_revision` — nên hai người nhập cùng lúc thì một người bị từ
 * chối chứ không ghi đè nhau.
 *
 * Preview phía trình duyệt KHÔNG phải ranh giới tin cậy: mọi đường ghi ở đây parse và
 * validate lại từ nguồn, đúng như `docs/design/engine-core.md` §6 yêu cầu.
 */

type Result = { ok: boolean; message: string } | null;
const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

function refresh(projectId: string, periodId?: string) {
  revalidatePath(`/du-an/${projectId}/giam-sat`);
  if (periodId) revalidatePath(`/du-an/${projectId}/giam-sat/${periodId}`);
  revalidatePath(`/du-an/${projectId}/bao-cao`);
}

/* ------------------------------------------------------------------ kỳ giám sát */

export async function createPeriod(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return fail("Thiếu mã dự án.");
  await requireProjectMember(projectId);

  const name = String(formData.get("name") ?? "").trim();
  const start = String(formData.get("start_date") ?? "").trim();
  const end = String(formData.get("end_date") ?? "").trim();
  const version = Number(formData.get("version") ?? 1);

  if (!name) return fail("Đặt tên cho kỳ giám sát.");
  if (!start || !end) return fail("Chọn ngày bắt đầu và ngày kết thúc.");
  if (end < start) return fail("Ngày kết thúc phải sau ngày bắt đầu.");
  if (!Number.isInteger(version) || version < 1) return fail("Số hiệu bản kỳ không hợp lệ.");

  const db = await projectClient();
  const { error } = await db.rpc("create_monitoring_period", {
    p_project_id: projectId,
    p_name: name,
    p_start_date: start,
    p_end_date: end,
    p_version: version,
  });
  if (error) return fail(periodError(error.message));

  refresh(projectId);
  return ok("Đã tạo kỳ giám sát. Lược đồ, baseline và hệ số được chụp lại ngay lúc này.");
}

export async function lockPeriod(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  const periodId = String(formData.get("period_id") ?? "");
  const revision = Number(formData.get("expected_revision"));
  if (!projectId || !periodId) return fail("Thiếu thông tin kỳ giám sát.");
  await requireProjectMember(projectId);

  const db = await projectClient();
  const { error } = await db.rpc("lock_monitoring_period", {
    p_period_id: periodId,
    p_expected_revision: revision,
  });
  if (error) return fail(periodError(error.message));

  refresh(projectId, periodId);
  return ok("Đã khoá kỳ. Dữ liệu được đóng băng và từ đây mới sinh được báo cáo.");
}

/* ------------------------------------------------------------------ nhập tay */

/**
 * Nhập/sửa một quan sát bằng form sinh từ `metric_schema`.
 *
 * Giá trị đưa về đúng dạng canonical mà cả validator TS lẫn validator SQL đòi: `decimal`
 * là CHUỖI (giữ nguyên độ chính xác, không qua IEEE-754), `integer` là SỐ, `boolean` là
 * boolean. Kiểm bằng `validateValues` trước để báo lỗi theo từng ô — cơ sở dữ liệu vẫn
 * kiểm lại, đó mới là lớp thật.
 */
export async function saveObservation(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  const periodId = String(formData.get("period_id") ?? "");
  if (!projectId || !periodId) return fail("Thiếu thông tin kỳ giám sát.");
  await requireProjectMember(projectId);

  const period = await getPeriod(projectId, periodId);
  if (!period) return fail("Không tìm thấy kỳ giám sát.");
  if (period.status !== "open") return fail("Kỳ đã khoá. Tạo kỳ bản mới để hiệu chỉnh.");

  const recordKey = String(formData.get("record_key") ?? "").trim();
  const observedOn = String(formData.get("observed_on") ?? "").trim();
  if (!recordKey) return fail("Nhập mã đối tượng quan sát (record_key).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)) return fail("Chọn ngày quan sát.");
  if (observedOn < period.start_date || observedOn > period.end_date)
    return fail(`Ngày quan sát phải nằm trong kỳ (${period.start_date} → ${period.end_date}).`);

  let schema;
  try {
    schema = parseMetricSchema(period.schema_snapshot);
  } catch {
    return fail("Lược đồ chỉ số của kỳ này không đọc được.");
  }

  const { observation: fields } = buildMethodologyForm(period.schema_snapshot, "vi");
  const values: MetricValues = {};

  for (const field of fields) {
    const raw = formData.get(`f_${field.id}`);
    if (field.control === "checkbox") {
      values[field.id] = raw === "on" || raw === "true";
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue;
    if (field.control === "integer") {
      if (!/^-?\d+$/.test(text)) return fail(`"${field.label}" phải là số nguyên.`);
      values[field.id] = Number(text);
    } else if (field.control === "decimal") {
      if (!/^-?\d+(\.\d+)?$/.test(text))
        return fail(`"${field.label}" phải là số dạng 123 hoặc 123.45 (dấu chấm thập phân).`);
      values[field.id] = text;
    } else {
      values[field.id] = text;
    }
  }

  const errors = validateValues(schema, values, "observation");
  if (errors.length > 0) {
    const first = errors[0];
    const label = fields.find((f) => f.id === first.field)?.label ?? first.field;
    return fail(`Chỉ số "${label}": ${first.message}`);
  }

  const db = await projectClient();
  const { error } = await db.rpc("save_monitoring_records", {
    p_period_id: periodId,
    p_records: [
      { record_key: recordKey, observed_on: observedOn, values, raw_input: {}, source_row: null },
    ],
    p_expected_revision: period.data_revision,
  });
  if (error) return fail(periodError(error.message));

  refresh(projectId, periodId);
  return ok(`Đã lưu quan sát "${recordKey}".`);
}

export async function deleteObservation(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  const periodId = String(formData.get("period_id") ?? "");
  const recordKey = String(formData.get("record_key") ?? "");
  const revision = Number(formData.get("expected_revision"));
  if (!projectId || !periodId || !recordKey) return fail("Thiếu thông tin quan sát.");
  await requireProjectMember(projectId);

  const db = await projectClient();
  const { error } = await db.rpc("delete_monitoring_record", {
    p_period_id: periodId,
    p_record_key: recordKey,
    p_expected_revision: revision,
  });
  if (error) return fail(periodError(error.message));

  refresh(projectId, periodId);
  return ok(`Đã xoá quan sát "${recordKey}".`);
}

/* ------------------------------------------------------------------ import CSV */

/**
 * Nhập hàng loạt từ CSV.
 *
 * Trình duyệt đã xem trước bằng cùng bộ hàm, nhưng ở đây **parse và validate lại từ đầu**
 * trên chính văn bản gửi lên: preview không phải ranh giới tin cậy. `prepareImportRecords`
 * ném lỗi nếu còn bất kỳ dòng nào sai, nên hoặc cả tệp vào hoặc không dòng nào vào —
 * RPC cũng chạy trong một transaction nên không có trạng thái nhập dở.
 */
export async function importCsv(_prev: Result, formData: FormData): Promise<Result> {
  const configError = formConfigError();
  if (configError) return fail(configError);

  const projectId = String(formData.get("project_id") ?? "");
  const periodId = String(formData.get("period_id") ?? "");
  if (!projectId || !periodId) return fail("Thiếu thông tin kỳ giám sát.");
  await requireProjectMember(projectId);

  const period = await getPeriod(projectId, periodId);
  if (!period) return fail("Không tìm thấy kỳ giám sát.");
  if (period.status !== "open") return fail("Kỳ đã khoá, không nhập thêm được.");

  const text = String(formData.get("csv_text") ?? "");
  if (!text.trim()) return fail("Chưa có nội dung CSV.");

  const options: ImportOptions = {
    delimiter: pickDelimiter(String(formData.get("delimiter") ?? ",")),
    decimalSeparator: String(formData.get("decimal_separator") ?? ".") === "," ? "," : ".",
    scope: "observation",
  };
  const thousands = String(formData.get("thousands_separator") ?? "");
  if (thousands === "." || thousands === "," || thousands === " ")
    options.thousandsSeparator = thousands;

  let records;
  try {
    records = prepareImportRecords(period.schema_snapshot, parseCSV(text, options.delimiter), options);
  } catch (e) {
    return fail(
      `Tệp còn lỗi nên không nhập được dòng nào: ${e instanceof Error ? e.message : "lỗi không rõ"}`,
    );
  }
  if (records.length === 0) return fail("Không có dòng dữ liệu nào trong tệp.");

  const db = await projectClient();
  const { error } = await db.rpc("save_monitoring_records", {
    p_period_id: periodId,
    p_records: records,
    p_expected_revision: period.data_revision,
    // `p_mapping` phải là OBJECT theo yêu cầu của SQL; ghi lại cả cấu hình locale để sau
    // này truy được vì sao một con số được đọc như vậy.
    p_mapping: { source: "csv", options },
  });
  if (error) return fail(periodError(error.message));

  refresh(projectId, periodId);
  return ok(`Đã nhập ${records.length} dòng.`);
}

function pickDelimiter(value: string): "," | ";" | "\t" {
  return value === ";" ? ";" : value === "\t" || value === "tab" ? "\t" : ",";
}

function periodError(message: string): string {
  if (message.includes("Kỳ khóa hoặc revision đã thay đổi"))
    return "Dữ liệu vừa thay đổi ở nơi khác, hoặc kỳ đã khoá. Tải lại trang rồi thử lại.";
  if (message.includes("Chỉ thành viên") || message.includes("Không có quyền nhập monitoring"))
    return "Bạn không còn là thành viên của dự án này.";
  if (message.includes("Phải khóa lựa chọn methodology"))
    return "Phải khoá Methodology ở bước 4 trước khi tạo kỳ giám sát.";
  if (message.includes("Kỳ chưa có dữ liệu"))
    return "Kỳ chưa có quan sát nào — nhập dữ liệu trước khi khoá.";
  if (message.includes("Ngày đo ngoài kỳ")) return "Có quan sát nằm ngoài khoảng ngày của kỳ.";
  if (message.includes("duplicate key") && message.includes("monitoring_periods"))
    return "Đã có kỳ trùng khoảng ngày và số hiệu bản. Đổi số hiệu bản để tạo bản hiệu chỉnh.";
  return `Không lưu được: ${message}`;
}
