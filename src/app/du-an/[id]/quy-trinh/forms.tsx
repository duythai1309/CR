"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Field,
  Input,
  LinkButton,
  Locked,
  SectionHeader,
  Select,
} from "@/components/ui";
import { DOCUMENT_KIND_LABEL, type DocumentKind } from "@/components/project/rules";
import type { BaselineDraft } from "@/types/project-setup";
import {
  approveStage,
  chooseMethodology,
  chooseStandard,
  runBaselineDraftAssist,
  saveBaseline,
  uploadDocument,
} from "./actions";

type Result = { ok: boolean; message: string } | null;

function Feedback({ result }: { result: Result }) {
  if (!result) return null;
  return (
    <div role={result.ok ? "status" : "alert"} aria-live={result.ok ? "polite" : "assertive"}>
      <Alert tone={result.ok ? "ok" : "error"}>{result.message}</Alert>
    </div>
  );
}

/* ------------------------------------------------------------------ hồ sơ Standard */

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
          Khoá là một chiều — cơ sở dữ liệu từ chối mọi thay đổi sau đó.
        </span>
      </p>
    );

  if (standards.length === 0)
    return (
      <Locked
        title="Chưa có Standard để chọn"
        reason="Catalog chưa có Standard. Quản trị nền tảng cần bổ sung trước."
      />
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

/* ------------------------------------------------------------------ hồ sơ Methodology */

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
        Khoá Standard trước. Danh sách Methodology chỉ hiện những bản thuộc đúng
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

  if (methodologies.length === 0)
    return (
      <Locked
        title="Chưa có Methodology để chọn"
        reason="Catalog chưa có Methodology đã publish cho Standard này. Quản trị nền tảng cần bổ sung trước."
      />
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

/* ------------------------------------------------------------------ hồ sơ Baseline */

export function BaselineForm({
  projectId,
  fields,
  values,
  revision,
  canEdit,
  canAssist,
  assistantConfigured,
  assistantMissingMessage,
  draft,
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
  canAssist: boolean;
  assistantConfigured: boolean;
  assistantMissingMessage: string;
  draft?: BaselineDraft;
}) {
  const [result, action, pending] = useActionState(saveBaseline, null);
  const [assistResult, setAssistResult] = useState<Result>(null);
  const [running, setRunning] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const draftRows = Object.entries(draft?.values ?? {}).flatMap(([fieldId, proposal]) => {
    const field = fields.find((candidate) => candidate.id === fieldId);
    return field ? [{ field, proposal }] : [];
  });

  async function runAssist() {
    setRunning(true);
    const next = await runBaselineDraftAssist(projectId);
    setAssistResult(next);
    setRunning(false);
    if (next?.ok) router.refresh();
  }

  function copyToForm(fieldId: string, value: string | number) {
    const control = formRef.current?.elements.namedItem(`f_${fieldId}`);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      control.focus();
    }
  }

  if (fields.length === 0)
    return (
      <Locked
        title="Chưa có chỉ số baseline"
        reason="Methodology đang chọn không khai chỉ số baseline, nên chưa có trường dữ liệu để nhập."
        unlock={
          <LinkButton href="#buoc-4" variant="secondary">
            Xem hồ sơ Methodology
          </LinkButton>
        }
      />
    );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
      <form ref={formRef} action={action} className="space-y-4">
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
                    aria-label={f.label}
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

      <aside className="rounded-lg border border-soil-200 bg-soil-50 p-4">
        <SectionHeader
          title="Bản nháp baseline của trợ lý"
          description="Trợ lý chỉ đọc payload từ hai công cụ nội bộ. Không giá trị nào tự đi vào baseline thật."
        />

        {draftRows.length === 0 ? (
          <Empty
            title="Chưa có giá trị nháp"
            hint="Trợ lý chỉ đề xuất field số còn trống khi payload handler có đủ nguồn để suy ra."
            action={
              <Button
                type="button"
                disabled={running || !canAssist || !assistantConfigured}
                onClick={runAssist}
              >
                {running ? "Trợ lý đang soạn…" : "Nhờ trợ lý soạn nháp baseline"}
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            <Alert tone="warn" title="Nội dung do máy sinh, chưa được thẩm định">
              {draft?.disclaimer}
            </Alert>
            <p className="text-xs text-soil-600">
              Sinh lúc {draft?.generated_at ? new Date(draft.generated_at).toLocaleString("vi-VN") : "—"}
              {draft?.generated_by_name || draft?.generated_by
                ? ` · người bấm sinh: ${draft.generated_by_name || draft.generated_by}`
                : ""}
            </p>
            <ul className="space-y-2">
              {draftRows.map(({ field, proposal }) => (
                <li key={field.id} className="rounded-lg border border-soil-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-soil-900">{field.label}</p>
                      <p className="font-mono text-sm text-soil-800">
                        {proposal.value} {field.unit}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!canEdit}
                      onClick={() => copyToForm(field.id, proposal.value)}
                    >
                      Chép sang ô nhập
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-soil-700">
                    <strong>Lý do:</strong> {proposal.reason}
                  </p>
                  <p className="mt-1 text-xs text-soil-600">
                    <strong>Nguồn suy ra:</strong> {proposal.source}
                  </p>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              disabled={running || !canAssist || !assistantConfigured}
              onClick={runAssist}
            >
              {running ? "Trợ lý đang soạn…" : "Soạn lại bản nháp"}
            </Button>
          </div>
        )}

        {!assistantConfigured && (
          <p className="mt-3 text-sm text-soil-600">{assistantMissingMessage}</p>
        )}
        {!canAssist && (
          <p className="mt-3 text-sm text-soil-600">
            Vai trò hiện tại không được yêu cầu trợ lý tạo bản nháp.
          </p>
        )}
        <Feedback result={assistResult} />
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ duyệt hồ sơ */

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
          {pending ? "Đang duyệt…" : "Duyệt hồ sơ"}
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

      <Field
        label={`Tệp ${DOCUMENT_KIND_LABEL[kind]}`}
        hint="Nhận PDF, Word (.docx), Excel (.xlsx), CSV hoặc ảnh; tối đa 4 MB. Mỗi lần tải lên tạo một phiên bản mới."
      >
        <input
          type="file"
          name="file"
          accept=".pdf,.docx,.xlsx,.csv,image/jpeg,image/png,image/webp"
          required
          onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
          className="text-sm text-soil-700 file:mr-3 file:rounded-lg file:border file:border-soil-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-soil-800"
        />
      </Field>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Đang tải lên…" : "Tải lên bản mới"}
        </Button>
      </div>

      {name && <p className="text-xs text-soil-600">Sẽ tải lên: {name}</p>}
      <Feedback result={result} />
    </form>
  );
}
