"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
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
  abandonDocumentSignedUpload,
  chooseMethodology,
  chooseStandard,
  completeDocumentSignedUpload,
  createDocumentSignedUpload,
  runBaselineDraftAssist,
  saveBaseline,
} from "./actions";

type Result = { ok: boolean; message: string } | null;

const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function documentMimeType(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return DOCUMENT_MIME_BY_EXTENSION[extension] ?? file.type.trim().toLowerCase();
}

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
        {current ? `Đang chọn: ${current.label}` : "Chưa chọn Standard."}
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
        {current ? `Đang chọn: ${current.label}` : "Chưa chọn Methodology."}
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
          <p className="text-sm text-soil-600">
            Dự án đã bị xoá nên không sửa được baseline nữa.
          </p>
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
            Dự án đã bị xoá nên không yêu cầu trợ lý tạo bản nháp được nữa.
          </p>
        )}
        <Feedback result={assistResult} />
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ tài liệu */

export function UploadDocumentForm({
  projectId,
  stageId,
  kind,
  unavailableReason = null,
}: {
  projectId: string;
  stageId: string;
  kind: DocumentKind;
  /**
   * Lý do máy chủ chưa tải tệp lên được, do trang hỏi trước khi dựng form. Có giá trị
   * thì hiện thẳng ra thay vì để người dùng chọn tệp rồi mới nhận lỗi ở bước ký phiếu.
   */
  unavailableReason?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Result>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setResult({ ok: false, message: "Bước chọn tệp thất bại: chưa có tệp để tải lên." });
      return;
    }
    if (file.size > 52_428_800) {
      setResult({ ok: false, message: "Bước chọn tệp thất bại: tệp vượt quá 50 MB." });
      return;
    }

    let step = "xin signed URL";
    let ticket: string | null = null;
    let uploaded = false;
    let checksum: string | null = null;
    setPending(true);
    setResult(null);
    try {
      const mimeType = documentMimeType(file);
      const signed = await createDocumentSignedUpload({
        projectId,
        stageId,
        kind,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
      });
      if (!signed.ok) {
        setResult(signed);
        return;
      }
      ticket = signed.ticket;

      step = "tính checksum SHA-256 trên trình duyệt";
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      checksum = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");

      step = "PUT tệp trực tiếp lên Storage";
      const browser = createBrowserClient();
      const directUpload = await browser.storage
        .from("project-documents")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: signed.contentType,
        });
      if (directUpload.error) {
        const cleanup = await abandonDocumentSignedUpload(ticket);
        setResult({
          ok: false,
          message:
            `Bước Storage thất bại: ${directUpload.error.message}. ` +
            (cleanup?.message ?? "Không xác nhận được việc dọn object tải dở."),
        });
        return;
      }
      uploaded = true;

      step = "ghi project_files và project_documents";
      const completed = await completeDocumentSignedUpload({ ticket, checksum });
      setResult(completed);
      if (completed?.ok) {
        if (fileRef.current) fileRef.current.value = "";
        setName(null);
        router.refresh();
      }
    } catch (error) {
      // Nếu response của action hoàn tất bị mất, action có thể đã commit. Gọi lại bằng
      // cùng ticket (server xử lý idempotent) trước khi kết luận; không xoá mù một object
      // có thể đã trở thành tài liệu hợp lệ.
      if (uploaded && ticket && checksum) {
        try {
          const retried = await completeDocumentSignedUpload({ ticket, checksum });
          setResult(retried);
          if (retried?.ok) {
            if (fileRef.current) fileRef.current.value = "";
            setName(null);
            router.refresh();
          }
          return;
        } catch (retryError) {
          setResult({
            ok: false,
            message:
              `Bước ghi project_files và project_documents mất kết nối sau hai lần thử: ` +
              `${retryError instanceof Error ? retryError.message : String(retryError)}. ` +
              "Chưa thể xác định metadata đã được ghi hay chưa; tải lại trang trước khi thử lại.",
          });
          return;
        }
      }
      setResult({
        ok: false,
        message: `Bước ${step} phát sinh lỗi: ${error instanceof Error ? error.message : String(error)}.`,
      });
    } finally {
      setPending(false);
    }
  }

  if (unavailableReason)
    return (
      <Alert tone="error" title={`Chưa tải lên được ${DOCUMENT_KIND_LABEL[kind]}`}>
        {unavailableReason}
      </Alert>
    );

  return (
    <form onSubmit={submit} className="space-y-2">
      <Field
        label={`Tệp ${DOCUMENT_KIND_LABEL[kind]}`}
        hint="Nhận PDF, Word (.docx), Excel (.xlsx), CSV hoặc ảnh; tối đa 50 MB. Tệp được tải thẳng lên kho, không đi qua máy chủ ứng dụng."
      >
        <input
          ref={fileRef}
          type="file"
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
