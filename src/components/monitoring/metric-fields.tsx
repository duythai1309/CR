"use client";

import { Field, Input, Select } from "@/components/ui";

export interface MetricFieldView {
  id: string;
  label: string;
  control: string;
  unit: string;
  required: boolean;
  options: Array<{ value: string; label: string }>;
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

  return (
    <Field
      label={`${field.label}${field.required ? " *" : ""}`}
      hint={field.unit ? `Đơn vị: ${field.unit}` : undefined}
    >
      {field.control === "select" ? (
        <Select name={name} defaultValue={text} disabled={disabled}>
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
          defaultChecked={value === true}
          disabled={disabled}
          className="h-4 w-4 rounded border-soil-300"
        />
      ) : (
        <Input
          name={name}
          type={field.control === "date" ? "date" : "text"}
          inputMode={
            field.control === "decimal" || field.control === "integer" ? "decimal" : undefined
          }
          defaultValue={text}
          disabled={disabled}
        />
      )}
    </Field>
  );
}
