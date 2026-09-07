"use client";

import { Field, Input, Select } from "@/components/ui";

export interface MetricFieldView {
  id: string;
  label: string;
  control: string;
  unit: string;
  required: boolean;
  options: Array<{ value: string; label: string }>;
  group: string;
  constraints?: {
    minimum?: number;
    maximum?: number;
    exclusive_minimum?: number;
    scale?: number;
  };
  requiredIf?: { field: string; equals: string | number | boolean };
  aliases: string[];
  acceptedUnits: string[];
}

export function metricConstraintText(field: MetricFieldView): string {
  const parts: string[] = [];
  const bounds = field.constraints;
  if (bounds?.minimum !== undefined) parts.push(`≥ ${bounds.minimum}`);
  if (bounds?.exclusive_minimum !== undefined) parts.push(`> ${bounds.exclusive_minimum}`);
  if (bounds?.maximum !== undefined) parts.push(`≤ ${bounds.maximum}`);
  if (bounds?.scale !== undefined) parts.push(`tối đa ${bounds.scale} số lẻ`);
  if (field.requiredIf)
    parts.push(`bắt buộc khi ${field.requiredIf.field} = ${String(field.requiredIf.equals)}`);
  return parts.join(" · ");
}

/**
 * Ô nhập sinh từ `metric_schema`, không hard-code theo methodology nào.
 *
 * Số thập phân dùng `<input type="text">` chứ không phải `type="number"`: giá trị phải đi
 * tới máy chủ nguyên dạng CHUỖI để giữ đúng độ chính xác. `type="number"` cho trình duyệt
 * quyền chuẩn hoá lại theo locale và đưa qua dấu phẩy động — đúng thứ cả lõi tính toán cố
 * tránh.
 */
export function MetricFieldInput({
  field,
  value,
  disabled,
  namePrefix = "f_",
}: {
  field: MetricFieldView;
  value?: unknown;
  disabled?: boolean;
  namePrefix?: string;
}) {
  const name = `${namePrefix}${field.id}`;
  const text = value === null || value === undefined ? "" : String(value);
  const constraint = metricConstraintText(field);
  const hint = [field.unit ? `Đơn vị: ${field.unit}` : "", constraint].filter(Boolean).join(" · ");

  return (
    <Field
      label={`${field.label}${field.required ? " *" : ""}`}
      hint={hint || undefined}
    >
      <p className="mb-1 font-mono text-[11px] text-soil-500">{field.id}</p>
      {field.control === "select" ? (
        <Select name={name} defaultValue={text} disabled={disabled} required={field.required}>
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : field.control === "checkbox" ? (
        <input
          type="checkbox"
          name={name}
          aria-label={field.label}
          defaultChecked={value === true}
          disabled={disabled}
          className="h-4 w-4 rounded border-soil-300"
        />
      ) : (
        <Input
          name={name}
          aria-label={field.label}
          type={field.control === "date" ? "date" : "text"}
          inputMode={
            field.control === "decimal" || field.control === "integer" ? "decimal" : undefined
          }
          defaultValue={text}
          disabled={disabled}
          required={field.required}
        />
      )}
    </Field>
  );
}
