"use client";

import { useActionState, useState } from "react";
import { Alert, Badge, Button, Field, Input, Select } from "@/components/ui";
import type { DocumentKind } from "@/components/project/rules";
import {
  approveStage,
  chooseMethodology,
  chooseStandard,
  saveBaseline,
  uploadDocument,
} from "./actions";

type Result = { ok: boolean; message: string } | null;

function Feedback({ result }: { result: Result }) {
  if (!result) return null;
  return <Alert tone={result.ok ? "ok" : "error"}>{result.message}</Alert>;
}

/* ------------------------------------------------------------------ bước 3 */

export function StandardPicker({
  projectId,
  standards,
  selected,
  locked,
  canEdit,
}: {
  projectId: string;
  standards: Array<{ id: string; label: string }>;
  selected: string | null;
  locked: boolean;
  canEdit: boolean;
}) {
  const [result, action, pending] = useActionState(chooseStandard, null);
  const current = standards.find((s) => s.id === selected);

  if (locked)
    return (
      <p className="text-sm text-soil-700">
        <Badge tone="leaf">Đã khoá</Badge>{" "}
        <span className="ml-1 font-medium">{current?.label ?? "Standard đã chọn"}</span>
        <span className="mt-1 block text-xs text-soil-600">
          Khoá là một chiều — cơ sở dữ liệu từ chối mọi thay đổi sau bước này.
        </span>
      </p>
    );

  if (!canEdit)
    return (
      <p className="text-sm text-soil-600">
        {current ? `Đang chọn: ${current.label}` : "Chủ dự án chưa chọn Standard."}
      </p>
    );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <Field label="Standard" hint="Đổi Standard sẽ bỏ Methodology đang chọn.">
        <Select name="standard_id" defaultValue={selected ?? ""} required>
          <option value="" disabled>
            — chọn Standard —
          </option>
          {standards.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Feedback result={result} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          Lưu tạm
        </Button>
        <Button
          type="submit"
          name="lock"
          value="1"
          disabled={pending}
          onClick={(e) => {
            if (!confirm("Khoá Standard là vĩnh viễn, không đổi lại được. Tiếp tục?"))
              e.preventDefault();
          }}
        >
          Xác nhận và khoá
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ bước 4 */

export function MethodologyPicker({
  projectId,
  methodologies,
  selected,
  locked,
  standardLocked,
  canEdit,
}: {
  projectId: string;
  methodologies: Array<{ id: string; label: string; projectType: string; isSample: boolean }>;
  selected: string | null;
  locked: boolean;
  standardLocked: boolean;
  canEdit: boolean;
}) {
  const [result, action, pending] = useActionState(chooseMethodology, null);
  const current = methodologies.find((m) => m.id === selected);

  if (!standardLocked)
    return (
      <p className="text-sm text-soil-600">
        Khoá Standard ở bước 3 trước. Danh sách Methodology chỉ hiện những bản thuộc đúng
        Standard đã chọn.
      </p>
    );

  if (locked)
    return (
      <p className="text-sm text-soil-700">
        <Badge tone="leaf">Đã khoá</Badge>{" "}
        <span className="ml-1 font-medium">{current?.label ?? "Methodology đã chọn"}</span>
      </p>
    );

  if (!canEdit)
    return (
      <p className="text-sm text-soil-600">
        {current ? `Đang chọn: ${current.label}` : "Chủ dự án chưa chọn Methodology."}
      </p>
    );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <Field
        label="Methodology"
        hint="Chỉ liệt kê bản đã publish và thuộc Standard đã khoá."
      >
        <Select name="methodology_id" defaultValue={selected ?? ""} required>
          <option value="" disabled>
            — chọn Methodology —
          </option>
          {methodologies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.projectType})
              {m.isSample ? " — MẪU" : ""}
            </option>
          ))}
        </Select>
      </Field>

      {methodologies.length === 0 && (
        <Alert tone="warn">
          Chưa có Methodology nào được publish cho Standard này. Quản trị nền tảng cần thêm
          trước.
        </Alert>
      )}

      <Feedback result={result} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          Lưu tạm
        </Button>
        <Button
          type="submit"
          name="lock"
          value="1"
          disabled={pending || methodologies.length === 0}
          onClick={(e) => {
            if (!confirm("Khoá Methodology là vĩnh viễn. Tiếp tục?")) e.preventDefault();
          }}
        >
          Xác nhận và khoá
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ bước 5 */

export function BaselineForm({
  projectId,
  fields,
  values,
  revision,
  canEdit,
}: {
  projectId: string;
  fields: Array<{
    id: string;
    label: string;
    control: string;
    unit: string;
    required: boolean;
    options: Array<{ value: string; label: string }>;
  }>;
  values: Record<string, unknown>;
  revision: number;
  canEdit: boolean;
}) {
  const [result, action, pending] = useActionState(saveBaseline, null);

  if (fields.length === 0)
    return (
      <p className="text-sm text-soil-600">
        Methodology này không khai chỉ số baseline nào.
      </p>
    );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />

      <p className="text-xs text-soil-600">
        Form sinh tự động từ chỉ số của Methodology — bản baseline hiện tại là số{" "}
        <strong>{revision}</strong>. Số thập phân dùng dấu chấm.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => {
          const value = values?.[f.id];
          const text = value === null || value === undefined ? "" : String(value);
          return (
            <Field
              key={f.id}
              label={`${f.label}${f.required ? " *" : ""}`}
              hint={f.unit ? `Đơn vị: ${f.unit}` : undefined}
            >
              {f.control === "select" ? (
                <Select name={`f_${f.id}`} defaultValue={text} disabled={!canEdit}>
                  <option value="">—</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.control === "checkbox" ? (
                <input
                  type="checkbox"
                  name={`f_${f.id}`}
                  defaultChecked={value === true}
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border-soil-300"
                />
              ) : (
                <Input
                  name={`f_${f.id}`}
                  type={f.control === "date" ? "date" : "text"}
                  inputMode={f.control === "decimal" || f.control === "integer" ? "decimal" : undefined}
                  defaultValue={text}
                  disabled={!canEdit}
                />
              )}
            </Field>
          );
        })}
      </div>

      <Feedback result={result} />

      {canEdit ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu baseline"}
        </Button>
      ) : (
        <p className="text-sm text-soil-600">Chỉ chủ dự án sửa được baseline.</p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ duyệt bước */

export function ApproveStageForm({
  projectId,
  ordinal,
  blockers,
}: {
  projectId: string;
  ordinal: number;
  blockers: string[];
}) {
  const [result, action, pending] = useActionState(approveStage, null);
  const blocked = blockers.length > 0;

  return (
    <div className="text-right">
      <form action={action}>
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="ordinal" value={ordinal} />
        <Button type="submit" variant="secondary" disabled={pending || blocked}>
          {pending ? "Đang duyệt…" : "Duyệt bước"}
        </Button>
      </form>
      {blocked && (
        <p className="mt-1.5 max-w-xs text-xs text-soil-600">
          Còn {blockers.length} điều kiện chưa đạt — xem danh sách bên trái.
        </p>
      )}
      {result && !result.ok && (
        <p className="mt-1.5 max-w-xs text-xs text-red-700">{result.message}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ tài liệu */

export function UploadDocumentForm({
  projectId,
  stageId,
  kind,
}: {
  projectId: string;
  stageId: string;
  kind: DocumentKind;
}) {
  const [result, action, pending] = useActionState(uploadDocument, null);
  const [name, setName] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="stage_id" value={stageId} />
      <input type="hidden" name="kind" value={kind} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          required
          onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
          className="text-sm text-soil-700 file:mr-3 file:rounded-lg file:border file:border-soil-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-soil-800"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Đang tải lên…" : "Tải lên bản mới"}
        </Button>
      </div>

      {name && <p className="text-xs text-soil-600">Sẽ tải lên: {name}</p>}
      <Feedback result={result} />
    </form>
  );
}
