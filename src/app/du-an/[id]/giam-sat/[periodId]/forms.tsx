"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { MetricFieldInput, type MetricFieldView } from "@/components/monitoring/metric-fields";
import { CsvImport } from "@/components/monitoring/csv-import";
import { deleteObservation, importCsv, lockPeriod, saveObservation } from "../actions";

type Result = { ok: boolean; message: string } | null;

function Feedback({ result }: { result: Result }) {
  if (!result) return null;
  return <Alert tone={result.ok ? "ok" : "error"}>{result.message}</Alert>;
}

export function ObservationForm({
  projectId,
  periodId,
  fields,
  startDate,
  endDate,
}: {
  projectId: string;
  periodId: string;
  fields: MetricFieldView[];
  startDate: string;
  endDate: string;
}) {
  const [result, action, pending] = useActionState(saveObservation, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="period_id" value={periodId} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Mã đối tượng quan sát *"
          hint="Định danh ổn định của ô đo / thiết bị / lô. Nhập lại cùng mã sẽ ghi đè quan sát cũ."
        >
          <Input name="record_key" required maxLength={200} placeholder="Ví dụ: O-001" />
        </Field>
        <Field label="Ngày quan sát *" hint={`Phải nằm trong ${startDate} → ${endDate}.`}>
          <Input name="observed_on" type="date" required min={startDate} max={endDate} />
        </Field>
      </div>

      {fields.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((f) => (
            <MetricFieldInput key={f.id} field={f} />
          ))}
        </div>
      )}

      <Feedback result={result} />

      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu…" : "Lưu quan sát"}
      </Button>
    </form>
  );
}

export function ObservationRow({
  projectId,
  periodId,
  recordKey,
  observedOn,
  values,
  fromImport,
  sourceRow,
  expectedRevision,
  canEdit,
}: {
  projectId: string;
  periodId: string;
  recordKey: string;
  observedOn: string;
  values: string[];
  fromImport: boolean;
  sourceRow: number | null;
  expectedRevision: number;
  canEdit: boolean;
}) {
  const [result, action, pending] = useActionState(deleteObservation, null);

  return (
    <>
      <tr className="border-b border-soil-100 last:border-0">
        <td className="px-3 py-2 font-medium text-soil-900">{recordKey}</td>
        <td className="px-3 py-2 text-soil-700">{observedOn}</td>
        {values.map((v, i) => (
          <td key={i} className="px-3 py-2 text-soil-700">
            {v}
          </td>
        ))}
        <td className="px-3 py-2 text-xs text-soil-600">
          {fromImport ? `tệp, dòng ${sourceRow ?? "?"}` : "nhập tay"}
        </td>
        {canEdit && (
          <td className="px-3 py-2 text-right">
            <form action={action}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="period_id" value={periodId} />
              <input type="hidden" name="record_key" value={recordKey} />
              <input type="hidden" name="expected_revision" value={expectedRevision} />
              <button
                type="submit"
                disabled={pending}
                onClick={(e) => {
                  if (!confirm(`Xoá quan sát ${recordKey}?`)) e.preventDefault();
                }}
                className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
              >
                {pending ? "Đang xoá…" : "Xoá"}
              </button>
            </form>
          </td>
        )}
      </tr>
      {result && !result.ok && (
        <tr>
          <td colSpan={values.length + 4} className="px-3 pb-2">
            <Alert tone="error">{result.message}</Alert>
          </td>
        </tr>
      )}
    </>
  );
}

export function ImportPanel({
  projectId,
  periodId,
  schema,
}: {
  projectId: string;
  periodId: string;
  schema: unknown;
}) {
  const [result, action, pending] = useActionState(importCsv, null);

  return (
    <div className="space-y-3">
      <CsvImport
        projectId={projectId}
        periodId={periodId}
        schema={schema}
        disabled={pending}
        action={action}
      />
      <Feedback result={result} />
    </div>
  );
}

export function LockPeriodForm({
  projectId,
  periodId,
  expectedRevision,
  recordCount,
  incompleteCount,
}: {
  projectId: string;
  periodId: string;
  expectedRevision: number;
  recordCount: number;
  incompleteCount: number;
}) {
  const [result, action, pending] = useActionState(lockPeriod, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="period_id" value={periodId} />
      <input type="hidden" name="expected_revision" value={expectedRevision} />

      {recordCount === 0 && (
        <Alert tone="warn">Kỳ chưa có quan sát nào — nhập dữ liệu trước khi khoá.</Alert>
      )}
      {incompleteCount > 0 && (
        <Alert tone="warn">
          Còn {incompleteCount} quan sát thiếu chỉ số bắt buộc. Khoá bây giờ thì báo cáo sinh
          từ kỳ này sẽ tính trên dữ liệu chưa đầy đủ.
        </Alert>
      )}

      <Feedback result={result} />

      <Button
        type="submit"
        disabled={pending || recordCount === 0}
        onClick={(e) => {
          if (!confirm("Khoá kỳ là một chiều, không mở lại được. Tiếp tục?")) e.preventDefault();
        }}
      >
        {pending ? "Đang khoá…" : "Khoá kỳ giám sát"}
      </Button>
    </form>
  );
}
