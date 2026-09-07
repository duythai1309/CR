import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectStageApprovals, requireProjectMember } from "@/lib/auth";
import { loadChatConfig, missingKeyMessage } from "@/lib/chat/settings";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, CheckMark, ProgressBar } from "@/components/ui";
import { buildMethodologyForm } from "@/lib/methodology/form";
import { parseMetricSchema, validateValues } from "@/lib/methodology/schema";
import {
  DOCUMENT_KIND_LABEL,
  STAGE_HINT,
  abilitiesFor,
  approvalChecklist,
  baselineGateErrors,
  toStageView,
  type ApprovalCheck,
  type ApprovalContext,
  type DocumentKind,
} from "@/components/project/rules";
import {
  getDocuments,
  getMethodology,
  getProject,
  getStages,
  getTasks,
  listMethodologies,
  listStandards,
} from "../../data";
import {
  ApproveStageForm,
  BaselineForm,
  MethodologyPicker,
  StandardPicker,
  UploadDocumentForm,
} from "./forms";
import {
  StageFeasibilityBlock,
  StageIdeaBlock,
  StageSelectionAdviceBlock,
} from "./setup-blocks";
import { getProjectSetup } from "../thiet-lap/data";

export const metadata: Metadata = { title: "Thiết kế dự án" };

const STAGE_DOCUMENT: Record<number, DocumentKind> = {
  2: "feasibility",
  5: "baseline",
  6: "additionality",
  7: "pdd",
};

/**
 * Bảy bước thiết kế — màn hình chính của giai đoạn lập kế hoạch.
 *
 * Nó phải trả lời được ba câu ngay: **bước này cần gì để duyệt**, **còn thiếu gì**, và
 * **ai duyệt bước trước, lúc nào**. Điều kiện duyệt không phải quy trình chuẩn ngành mà
 * là bảy phép kiểm trong `approve_project_stage` (`0013_project_platform.sql:696-714`),
 * chép nguyên vào `approvalChecklist()`.
 *
 * Baseline được kiểm TRƯỚC bằng `validateValues` để người dùng biết field nào sai, thay
 * vì bấm Duyệt rồi nhận một `raise exception` thô. `baselineGateErrors()` lọc lại về đúng
 * tập mà SQL thực sự cưỡng chế — xem `docs/design/pages-module-a.md`.
 */
export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireProjectMember(id);
  const supabase = await createClient();

  const [project, stages, tasks, documents, standards, stageApprovals, setup, assistantConfig] =
    await Promise.all([
      getProject(id),
      getStages(id),
      getTasks(id),
      getDocuments(id),
      listStandards(),
      getProjectStageApprovals(id),
      getProjectSetup(id),
      loadChatConfig(supabase),
    ]);
  if (!project) notFound();

  const [methodologies, methodology] = await Promise.all([
    listMethodologies(project.standard_id),
    getMethodology(project.methodology_id),
  ]);

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const views = stages.map(toStageView);

  // Nội dung bốn bước đầu, gộp từ màn Khởi tạo cũ. `canWriteTasks` là cùng quyền mà màn
  // đó dùng trước đây, giữ nguyên để không nới quyền ghi qua đường giao diện.
  const idea = setup.idea ?? {};
  const description = setup.description ?? "";
  const feasibility = setup.feasibility ?? {};
  const advice = setup.selection_advice ?? {};
  const canEditSetup = abilities.canWriteTasks;
  const hasSetupInput =
    Object.values(idea).some((v) => v !== undefined && v !== "") || description.trim().length > 0;
  const approvalByStage = new Map(stageApprovals.map((approval) => [approval.stageId, approval]));

  // Kiểm baseline theo đúng những phép mà `project_validate_values` thực hiện. Schema
  // hỏng hoặc chưa chọn methodology thì để `undefined` — "chưa kết luận được" khác hẳn
  // "kiểm rồi và không đạt", và gộp hai thứ đó lại là nói dối người dùng.
  let baselineErrors: Array<{ field: string; message: string }> | undefined;
  if (methodology) {
    try {
      const schema = parseMetricSchema(methodology.metric_schema);
      baselineErrors = baselineGateErrors(
        validateValues(schema, project.baseline, "baseline"),
        schema.fields
          .filter((f) => f.scope === "baseline")
          .map((f) => ({ id: f.id, required: f.required })),
      );
    } catch {
      baselineErrors = undefined;
    }
  }

  const gate: ApprovalContext = {
    standardId: project.standard_id,
    methodologyId: project.methodology_id,
    standardLockedAt: project.standard_locked_at,
    methodologyLockedAt: project.methodology_locked_at,
    isOwner: role === "owner",
    projectDeleted: project.deleted_at !== null,
    baselineErrors,
  };

  const baselineFields = methodology
    ? buildMethodologyForm(methodology.metric_schema, "vi", project.baseline as never).baseline
    : [];

  const approved = views.filter((s) => s.approvedAt).length;
  const current = views.find((s) => !s.approvedAt) ?? null;

  return (
    <div className="space-y-5">
      {methodology?.is_sample && (
        <Alert tone="warn" title="Methodology MẪU — chưa thẩm định">
          Bộ chỉ số, hệ số và công thức của methodology này do nhóm tự soạn để thử luồng.
          Nó <strong>không</strong> phải methodology được Verra hay Gold Standard công nhận,
          và mọi con số sinh ra từ nó là bản xem thử.{" "}
          <span className="underline decoration-dotted" title={methodology.disclaimer}>
            Xem disclaimer đầy đủ
          </span>
          .
        </Alert>
      )}

      {/* Dải bảy bước: đang ở đâu, còn bao xa */}
      <section className="rounded-xl border border-soil-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-semibold text-soil-900">Tiến độ bảy bước thiết kế</h2>
          <p className="text-sm text-soil-600">
            <span className="font-semibold tabular-nums text-soil-900">{approved}/7</span> đã duyệt
            {current && (
              <>
                {" "}
                · đang chờ <strong className="font-medium text-soil-900">{current.ordinal}. {current.title}</strong>
              </>
            )}
          </p>
        </div>

        <div className="mt-3">
          <ProgressBar
            value={approved}
            max={7}
            label={`Đã duyệt ${approved} trên 7 bước`}
            tone={approved === 7 ? "leaf" : "carbon"}
          />
        </div>

        <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {views.map((stage) => {
            const state = stage.approvedAt
              ? "border-leaf-200 bg-leaf-50 text-leaf-900"
              : stage.ordinal === current?.ordinal
                ? "border-carbon-500 bg-carbon-100/50 text-carbon-700"
                : "border-soil-200 bg-white text-soil-600";
            return (
              <li key={stage.id}>
                <a
                  href={`#buoc-${stage.ordinal}`}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-leaf-500 ${state}`}
                >
                  <span className="font-bold tabular-nums">{stage.ordinal}</span>
                  <span className="truncate">{stage.title}</span>
                  {stage.approvedAt && <span aria-hidden className="ml-auto">✓</span>}
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      {views.map((stage) => {
        const checks = approvalChecklist(views, stage.ordinal, gate);
        const stageTasks = tasks.filter((t) => t.stage_id === stage.id);
        const done = stageTasks.filter((t) => t.status === "done").length;
        const kind = STAGE_DOCUMENT[stage.ordinal];
        const stageDocs = kind ? documents.filter((d) => d.kind === kind) : [];
        const isCurrent = stage.ordinal === current?.ordinal;
        const approval = approvalByStage.get(stage.id);
        const approvedBy =
          approval?.approvedBy ??
          ((stages.find((row) => row.id === stage.id)?.approved_by ?? null) as string | null);

        return (
          <details
            key={stage.id}
            id={`buoc-${stage.ordinal}`}
            open={!stage.approvedAt}
            className={`scroll-mt-6 overflow-hidden rounded-xl border bg-white shadow-sm ${
              isCurrent ? "border-carbon-500" : "border-soil-200"
            }`}
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 hover:bg-soil-50">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  stage.approvedAt
                    ? "bg-leaf-100 text-leaf-800"
                    : isCurrent
                      ? "bg-carbon-100 text-carbon-700"
                      : "bg-soil-100 text-soil-600"
                }`}
              >
                {stage.ordinal}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-soil-900">{stage.title}</span>
                <span className="mt-0.5 block text-sm text-soil-600">
                  {STAGE_HINT[stage.ordinal]}
                </span>
              </span>

              {stage.approvedAt ? (
                <span className="text-right text-xs text-soil-600">
                  <Badge tone="leaf">Đã duyệt</Badge>
                  <span className="mt-1 block">
                    {new Date(stage.approvedAt).toLocaleString("vi-VN")}
                  </span>
                  <span className="block">
                    {approvedBy
                      ? (approval?.approverName ?? "Không đọc được tên người duyệt")
                      : "Không ghi nhận người duyệt"}
                  </span>
                </span>
              ) : isCurrent ? (
                <Badge tone="carbon">Đang chờ duyệt</Badge>
              ) : (
                <Badge tone="soil">Chưa tới lượt</Badge>
              )}
            </summary>

            <div className="space-y-4 border-t border-soil-200 px-5 py-4">
              {!stage.approvedAt && (
                <ApprovalChecklist
                  checks={checks}
                  action={
                    abilities.canApproveStage ? (
                      <ApproveStageForm
                        projectId={id}
                        ordinal={stage.ordinal}
                        blockers={checks.filter((c) => c.state === "fail").map((c) => c.requirement)}
                      />
                    ) : (
                      <p className="max-w-xs text-right text-xs text-soil-600">
                        Chỉ chủ dự án bấm duyệt được. Vai trò của bạn:{" "}
                        {role === "developer" ? "Đơn vị phát triển" : "Người xem"}.
                      </p>
                    )
                  }
                />
              )}

              {stageTasks.length > 0 && (
                <p className="text-sm text-soil-600">
                  <strong className="font-medium text-soil-900">
                    {done}/{stageTasks.length}
                  </strong>{" "}
                  công việc ở bước này đã xong.{" "}
                  <span className="text-soil-500">
                    Công việc không phải điều kiện duyệt — đây là kỷ luật của đội, không phải
                    ràng buộc của hệ thống.
                  </span>
                </p>
              )}

              {stage.ordinal === 1 && (
                <StageIdeaBlock
                  projectId={id}
                  idea={idea}
                  description={description}
                  canEdit={canEditSetup}
                />
              )}

              {stage.ordinal === 2 && (
                <StageFeasibilityBlock
                  projectId={id}
                  feasibility={feasibility}
                  canEdit={canEditSetup}
                  hasInput={hasSetupInput}
                />
              )}

              {(stage.ordinal === 3 || stage.ordinal === 4) && (
                <StageSelectionAdviceBlock
                  projectId={id}
                  advice={advice}
                  canEdit={canEditSetup}
                  hasProjectType={Boolean(idea.project_type)}
                />
              )}

              {stage.ordinal === 3 && (
                <StandardPicker
                  projectId={id}
                  standards={standards.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }))}
                  selected={project.standard_id}
                  locked={project.standard_locked_at !== null}
                  canEdit={abilities.canChooseStandard}
                />
              )}

              {stage.ordinal === 4 && (
                <MethodologyPicker
                  projectId={id}
                  methodologies={methodologies.map((m) => ({
                    id: m.id,
                    label: `${m.code} · ${m.version} — ${m.name}`,
                    projectType: m.project_type,
                    isSample: m.is_sample,
                  }))}
                  selected={project.methodology_id}
                  locked={project.methodology_locked_at !== null}
                  standardLocked={project.standard_locked_at !== null}
                  canEdit={abilities.canChooseStandard}
                />
              )}

              {stage.ordinal === 5 &&
                (methodology ? (
                  <>
                    {baselineErrors && baselineErrors.length > 0 && (
                      <Alert tone="error" title="Baseline chưa qua được phép kiểm của cơ sở dữ liệu">
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                          {baselineErrors.map((e) => (
                            <li key={`${e.field}-${e.message}`}>
                              <code className="font-mono text-xs">{e.field || "(giá trị)"}</code>:{" "}
                              {e.message}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs">
                          Đây là kết quả chạy trước cùng bộ quy tắc mà{" "}
                          <code className="font-mono">project_validate_values</code> áp dụng. Bước 5
                          trở đi không duyệt được cho tới khi hết lỗi.
                        </p>
                      </Alert>
                    )}
                    <BaselineForm
                      projectId={id}
                      fields={baselineFields.map((f) => ({
                        id: f.id,
                        label: f.label,
                        control: f.control,
                        unit: f.unit,
                        required: f.required,
                        options: f.options,
                      }))}
                      values={project.baseline as Record<string, unknown>}
                      revision={project.baseline_revision}
                      canEdit={abilities.canEditBaseline}
                      canAssist={canEditSetup}
                      assistantConfigured={assistantConfig !== null}
                      assistantMissingMessage={missingKeyMessage()}
                      draft={setup.baseline_draft}
                    />
                  </>
                ) : (
                  <p className="text-sm text-soil-600">
                    Chọn Methodology ở bước 4 trước — form baseline sinh từ{" "}
                    <code className="font-mono text-xs">metric_schema</code> của chính
                    Methodology đó, nên chưa có Methodology thì chưa có field nào để nhập.
                  </p>
                ))}

              {stage.ordinal === 6 && (
                <p className="text-sm text-soil-600">
                  Schema không có bảng checklist riêng cho additionality. Cách làm trong hệ
                  thống này: mỗi mục kiểm tra theo tool của Standard là một công việc ở bước
                  6 trên bảng công việc, rồi tải hồ sơ chứng minh lên đây.
                </p>
              )}

              {kind && (
                <div className="rounded-lg border border-soil-200 bg-soil-50 p-4">
                  <h4 className="text-sm font-semibold text-soil-900">
                    {DOCUMENT_KIND_LABEL[kind]}
                  </h4>

                  {stageDocs.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-soil-700">
                      {stageDocs.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center gap-2">
                          <Badge tone="soil">bản {d.version}</Badge>
                          <span>{d.originalName}</span>
                          <span className="text-xs text-soil-500">
                            {(d.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                            {new Date(d.created_at).toLocaleDateString("vi-VN")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-soil-600">Chưa có tài liệu nào.</p>
                  )}

                  {abilities.canUploadFiles && (
                    <div className="mt-3">
                      <UploadDocumentForm projectId={id} stageId={stage.id} kind={kind} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>
        );
      })}

      <Card title="Bảy bước này dừng ở đâu">
        <p className="text-sm text-soil-700">
          Duyệt xong cả bảy bước nghĩa là phần <strong>thiết kế dự án</strong> đã khép lại
          trong hệ thống này. Nó <strong>không</strong> có nghĩa hồ sơ đủ điều kiện nộp.
        </p>
        <p className="mt-2 text-sm text-soil-700">
          Còn thiếu, và nằm ngoài phạm vi phiên bản hiện tại: stakeholder consultation,
          validation, registration, VVB verification, standard review và issuance — bước
          8–11 và 15–17 của quy trình chuẩn. MRV report sinh ở tab Báo cáo là{" "}
          <strong>ước tính</strong>, không phải tín chỉ đã phát hành.
        </p>
      </Card>
    </div>
  );
}

/**
 * Danh sách kiểm điều kiện duyệt.
 *
 * Mỗi dòng trích dẫn dòng migration tương ứng để người dùng đối chiếu được với nguồn, và
 * để người sau không lặng lẽ thêm điều kiện không có thật vào đây.
 */
function ApprovalChecklist({
  checks,
  action,
}: {
  checks: ApprovalCheck[];
  action: React.ReactNode;
}) {
  const failing = checks.filter((c) => c.state === "fail");

  return (
    <div className="rounded-lg border border-soil-200 bg-soil-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-soil-900">Điều kiện duyệt bước này</h4>
          <p className="mt-0.5 text-xs text-soil-600">
            Chép từ <code className="font-mono">approve_project_stage</code> trong{" "}
            <code className="font-mono">0013_project_platform.sql</code>. Cơ sở dữ liệu không
            kiểm gì ngoài danh sách này.
          </p>
        </div>
        {action}
      </div>

      <ul className="mt-3 space-y-2">
        {checks.map((check) => (
          <li key={check.id} className="flex gap-2.5">
            <CheckMark state={check.state} />
            <div className="min-w-0 text-sm">
              <p
                className={
                  check.state === "not_applicable" ? "text-soil-500" : "text-soil-800"
                }
              >
                {check.requirement}{" "}
                <span className="font-mono text-[11px] text-soil-500">{check.source}</span>
              </p>
              {check.detail && (
                <p
                  className={`mt-0.5 text-xs ${
                    check.state === "fail" ? "text-red-700" : "text-soil-500"
                  }`}
                >
                  {check.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {failing.length === 0 && (
        <p className="mt-3 text-xs text-leaf-800">
          Mọi điều kiện đã đạt — cơ sở dữ liệu sẽ chấp nhận lượt duyệt này.
        </p>
      )}
    </div>
  );
}
