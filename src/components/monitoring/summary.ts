import { Decimal } from "@/lib/methodology/decimal";
import type { FormField } from "@/lib/methodology/form";
import type { MetricValues } from "@/lib/methodology/schema";

/**
 * Gom số liệu đã nhập để đối chiếu với baseline — `PLAN.md` §4 gạch đầu dòng đầu tiên.
 *
 * Thuần và không async, nên kiểm thử được. Dùng số học thập phân của lõi
 * (`Decimal`) chứ không phải `number` của JavaScript: dữ liệu vào là chuỗi thập phân
 * chính xác, đổi sang IEEE-754 để tính trung bình là tự làm hỏng đúng thứ mà cả hệ thống
 * cố giữ.
 */

export interface MetricSummary {
  fieldId: string;
  label: string;
  unit: string;
  /** Số quan sát có giá trị cho chỉ số này. */
  count: number;
  /** Chỉ có với chỉ số dạng số; chuỗi thập phân, không phải number. */
  min: string | null;
  max: string | null;
  mean: string | null;
  /** Giá trị baseline tương ứng, nếu Methodology có khai một chỉ số cùng tên. */
  baseline: string | null;
}

const NUMERIC = new Set(["decimal", "integer"]);

function asDecimalText(value: unknown): string | null {
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Một dòng tổng kết cho mỗi chỉ số scope `observation`.
 *
 * Cột `baseline` chỉ được điền khi Methodology khai một chỉ số baseline **trùng đúng id**
 * — không đoán theo tên gần giống, vì ghép nhầm hai chỉ số khác nhau rồi trình bày như
 * một phép so sánh là sai lệch tệ hơn là bỏ trống.
 */
export function summariseObservations(
  observationFields: FormField[],
  baselineFields: FormField[],
  baseline: MetricValues,
  records: Array<{ metric_values: MetricValues }>,
): MetricSummary[] {
  const baselineIds = new Set(baselineFields.map((f) => f.id));

  return observationFields.map((field) => {
    const numeric = NUMERIC.has(field.control);
    const values: Decimal[] = [];
    let count = 0;

    for (const record of records) {
      const raw = record.metric_values?.[field.id];
      if (raw === undefined || raw === null || raw === "") continue;
      count += 1;
      if (!numeric) continue;
      const text = asDecimalText(raw);
      if (text === null) continue;
      try {
        values.push(Decimal.parse(text));
      } catch {
        // Giá trị không parse được đã bị validator chặn từ lúc ghi; bỏ qua ở đây thay vì
        // làm hỏng cả bảng tổng kết.
      }
    }

    let min: string | null = null;
    let max: string | null = null;
    let mean: string | null = null;

    if (values.length > 0) {
      let lo = values[0];
      let hi = values[0];
      let total = values[0];
      for (const v of values.slice(1)) {
        if (v.compare(lo) < 0) lo = v;
        if (v.compare(hi) > 0) hi = v;
        total = total.add(v);
      }
      min = lo.toString();
      max = hi.toString();
      mean = total.div(Decimal.parse(String(values.length))).fixed(4);
    }

    const baselineRaw = baselineIds.has(field.id) ? baseline?.[field.id] : undefined;

    return {
      fieldId: field.id,
      label: field.label,
      unit: field.unit,
      count,
      min,
      max,
      mean,
      baseline:
        baselineRaw === undefined || baselineRaw === null ? null : String(baselineRaw),
    };
  });
}

/** Bao nhiêu quan sát thiếu chỉ số bắt buộc — dùng để cảnh báo trước khi khoá kỳ. */
export function incompleteRecords(
  observationFields: FormField[],
  records: Array<{ record_key: string; metric_values: MetricValues }>,
): Array<{ recordKey: string; missing: string[] }> {
  const required = observationFields.filter((f) => f.required);
  return records
    .map((record) => ({
      recordKey: record.record_key,
      missing: required
        .filter((f) => {
          const v = record.metric_values?.[f.id];
          return v === undefined || v === null || v === "";
        })
        .map((f) => f.label),
    }))
    .filter((r) => r.missing.length > 0);
}

/** Khoảng ngày thực tế của dữ liệu đã nhập, để đối chiếu với khoảng ngày khai báo của kỳ. */
export function observedRange(
  records: Array<{ observed_on: string }>,
): { first: string; last: string } | null {
  const dates = records.map((r) => r.observed_on).filter(Boolean).sort();
  return dates.length === 0 ? null : { first: dates[0], last: dates[dates.length - 1] };
}
