"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Select } from "@/components/ui";
import { generateReport } from "./actions";

export function GenerateReportForm({
  projectId,
  periods,
  templates,
  outputs,
}: {
  projectId: string;
  periods: Array<{ id: string; label: string }>;
  templates: Array<{ id: string; label: string; status: string }>;
  outputs: string[];
}) {
  const [result, action, pending] = useActionState(generateReport, null);
  const hasReadyTemplate = templates.some((template) => template.status === "ready");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Kỳ giám sát">
          <Select name="period_id" required defaultValue={periods[0]?.id ?? ""}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Template"
          hint={
            hasReadyTemplate
              ? "Tệp thật đã có; đọc phạm vi áp dụng trong từng template trước khi chọn."
              : "Bản placeholder chưa có tệp thật của tổ chức chứng nhận."
          }
        >
          <Select name="template_id" required defaultValue={templates[0]?.id ?? ""}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.status === "placeholder" ? " — chưa có tệp thật" : " — có tệp thật"}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Chỉ số dùng làm ước tính"
          hint="Chỉ nhận chỉ số có đơn vị tCO2e và gộp bằng tổng."
        >
          <Select name="output_calculation" required defaultValue={outputs[0] ?? ""}>
            {outputs.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {outputs.length === 0 && (
        <Alert tone="warn">
          Methodology của kỳ này không có chỉ số nào đơn vị tCO2e gộp bằng tổng, nên chưa
          sinh được ước tính tín chỉ cho cả kỳ.
        </Alert>
      )}

      {result && <Alert tone={result.ok ? "ok" : "error"}>{result.message}</Alert>}

      <Button type="submit" disabled={pending || outputs.length === 0}>
        {pending ? "Đang sinh báo cáo…" : "Sinh báo cáo ước tính"}
      </Button>
    </form>
  );
}
