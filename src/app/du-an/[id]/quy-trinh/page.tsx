import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectStageApprovals, requireProjectMember } from "@/lib/auth";
import { loadChatConfig, missingKeyMessage } from "@/lib/chat/settings";
import { createClient } from "@/lib/supabase/server";
import {
  Alert,
  Badge,
  Card,
  CheckMark,
  Empty,
  LinkButton,
  Locked,
  ProgressBar,
  SectionHeader,
} from "@/components/ui";
import {
  countPresentDossiers,
  dossierPresence,
  type DossierPresence,
} from "@/components/project/journey-rail";
import { buildMethodologyForm } from "@/lib/methodology/form";
import { parseMetricSchema, validateValues } from "@/lib/methodology/schema";
import {
  DOCUMENT_KIND_LABEL,
  STAGE_HINT,
  abilitiesFor,
  approvalBlockers,
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
import { documentUploadUnavailableReason } from "./actions";
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
 * Danh mục bảy hồ sơ thiết kế cần xây dựng xuyên suốt vòng đời dự án.
 *
 * Trạng thái nội dung chỉ nói hồ sơ đã có hay còn thiếu. Duyệt là hành động riêng, mọi
 * thành viên đều làm được, vẫn dùng các phép kiểm trong `approve_project_stage` và vẫn
 * tuần tự ở DB, nhưng không được dùng làm cổng chặn người khác điền hồ sơ.
 *
 * Baseline được kiểm TRƯỚC bằng `validateValues` để người dùng biết field nào sai, thay
 * vì bấm Duyệt rồi nhận một `raise exception` thô. `baselineGateErrors()` lọc lại về đúng
 * tập mà SQL thực sự cưỡng chế — xem `docs/design/pages-module-a.md`.
 */
export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProjectMember(id);
  const supabase = await createClient();

  const [
    project,
    stages,
    tasks,
    documents,
    standards,
    stageApprovals,
    setup,
    assistantConfig,
    uploadUnavailable,
  ] = await Promise.all([
      getProject(id),
      getStages(id),
      getTasks(id),
      getDocuments(id),
      listStandards(),
      getProjectStageApprovals(id),
      getProjectSetup(id),
      loadChatConfig(supabase),
      documentUploadUnavailableReason(),
    ]);
  if (!project) notFound();

  const [methodologies, methodology] = await Promise.all([
    listMethodologies(project.standard_id),
    getMethodology(project.methodology_id),
  ]);

  const abilities = abilitiesFor(project.deleted_at !== null);
  const views = stages.map(toStageView);

  // Nội dung bốn hồ sơ đầu, gộp từ màn Khởi tạo cũ. `canWriteTasks` là cùng quyền mà màn
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
    projectDeleted: project.deleted_at !== null,
    baselineErrors,
  };

  /**
   * Những mục chưa duyệt, kèm rào đầu tiên của từng mục.
   *
   * Trước đây muốn duyệt phải tự cuộn tìm trong bảy khối đang mở sẵn — trang rất dài nên
   * khối duyệt của mục 6 hay 7 nằm ngoài tầm nhìn. Danh sách này đưa thẳng người dùng
   * tới đúng khối duyệt của mục họ chọn.
   *
   * `approvalBlockers` chỉ tính điều kiện đã KẾT LUẬN được; `unknown` không bị coi là
   * rào, nên "duyệt được ngay" ở đây nghĩa là không có rào nào đã biết, không phải lời
   * hứa rằng RPC chắc chắn nhận.
   */
  const pendingApprovals = views
    .filter((stage) => !stage.approvedAt)
    .map((stage) => ({
      stage,
      blockers: approvalBlockers(views, stage.ordinal, gate),
      checks: approvalChecklist(views, stage.ordinal, gate),
    }));

  const baselineFields = methodology
    ? buildMethodologyForm(methodology.metric_schema, "vi", project.baseline as never).baseline
    : [];
  const present = dossierPresence({
    setup,
    standardId: project.standard_id,
    methodologyId: project.methodology_id,
    baseline: project.baseline,
    documentKinds: documents.map((document) => document.kind),
  });
  const presentCount = countPresentDossiers(present);
  const presenceByOrdinal: Record<number, keyof DossierPresence> = {
    1: "idea",
    2: "feasibility",
    3: "standard",
    4: "methodology",
    5: "baseline",
    6: "additionality",
    7: "pdd",
  };

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

      {/* Toàn cảnh bảy hồ sơ; số duyệt được trình bày riêng trong từng khối. */}
      <section className="rounded-xl border border-soil-200 bg-white px-5 py-4 shadow-sm">
        <SectionHeader
          title="Bảy hồ sơ thiết kế cần xây dựng"
          description="Có thể bổ sung các hồ sơ song song, trừ phụ thuộc dữ liệu của Methodology và Baseline."
          aside={
            <p className="text-sm text-soil-600">
              <span className="font-semibold tabular-nums text-soil-900">{presentCount}/7</span>{" "}
              hồ sơ đã có
            </p>
          }
        />

        <div className="mt-3">
          <ProgressBar
            value={presentCount}
            max={7}
            label={`Đã có nội dung ${presentCount} trên 7 hồ sơ`}
            tone={presentCount === 7 ? "leaf" : "carbon"}
          />
        </div>

        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {views.map((stage) => {
            const hasContent = present[presenceByOrdinal[stage.ordinal]];
            const state = hasContent
              ? "border-leaf-200 bg-leaf-50 text-leaf-900"
              : "border-soil-200 bg-white text-soil-600";
            // Chưa duyệt thì nhảy thẳng tới khối duyệt; đã duyệt thì tới đầu khối.
            const target = stage.approvedAt
              ? `#buoc-${stage.ordinal}`
              : `#duyet-buoc-${stage.ordinal}`;
            return (
              <li key={stage.id}>
                <a
                  href={target}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-leaf-500 ${state}`}
                >
                  <span aria-hidden className="font-bold">
                    {hasContent ? "✓" : "○"}
                  </span>
                  <span className="truncate">{stage.title}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      {/*
        NƠI DUY NHẤT để duyệt.
        Trước đây mỗi mục trong bảy mục mang một khung "Duyệt hồ sơ" riêng, mỗi khung lặp
        lại cùng một đoạn giải thích về `approve_project_stage` và cùng một danh sách sáu
        điều kiện — bảy lần trên một trang. Đoạn giải thích chung nay viết một lần ở đây,
        checklist của từng mục nằm trong hàng của chính mục đó và chỉ mở khi cần.

        Hai trục vẫn tách: "có nội dung chưa" thuộc về từng khối hồ sơ bên dưới, "đã duyệt
        chưa" thuộc về khối này.
      */}
      <section
        id="cho-duyet"
        className="scroll-mt-6 rounded-xl border border-soil-200 bg-white px-5 py-4 shadow-sm"
      >
        <SectionHeader
          title={`Chờ duyệt (${pendingApprovals.length}/7)`}
          description={
            <>
              Mở một mục để xem đủ điều kiện của mục đó rồi duyệt tại chỗ. Checklist chép
              từ <code className="font-mono">approve_project_stage</code> trong{" "}
              <code className="font-mono">0013_project_platform.sql</code>: cơ sở dữ liệu
              cưỡng chế thứ tự duyệt và không kiểm gì ngoài danh sách đó. Duyệt là việc
              riêng, không khoá quyền điền hồ sơ.
            </>
          }
        />

        {pendingApprovals.length === 0 ? (
          <p className="mt-2 text-sm text-soil-700">
            Cả bảy mục đã duyệt. Duyệt ở đây không thay thế thẩm định độc lập.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {pendingApprovals.map(({ stage, blockers, checks }, index) => (
              <li key={stage.id}>
                {/*
                  Chỉ mở sẵn hàng đầu tiên. Cơ sở dữ liệu cưỡng chế duyệt TUẦN TỰ, nên
                  trong mọi lúc chỉ đúng một mục là duyệt được — chính là mục này. Sáu
                  hàng còn lại đã nói ngay ở dòng tóm tắt rằng chúng đang chờ mục nào,
                  nên mở sẵn cả bảy chỉ dựng lại đúng bức tường vừa gỡ.
                */}
                <details
                  id={`duyet-buoc-${stage.ordinal}`}
                  open={index === 0}
                  className="scroll-mt-6 overflow-hidden rounded-lg border border-soil-200"
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 hover:bg-soil-50">
                    <span className="font-mono text-xs text-soil-500">{stage.ordinal}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-soil-900">
                      {stage.title}
                    </span>
                    {blockers.length === 0 ? (
                      <Badge tone="leaf">Duyệt được ngay</Badge>
                    ) : (
                      <span className="text-xs text-soil-600">{blockers[0]}</span>
                    )}
                    <span className="text-xs font-medium text-leaf-800">
                      {blockers.length === 0 ? "Mở để duyệt" : "Xem điều kiện"}
                    </span>
                  </summary>

                  <div className="border-t border-soil-200 bg-soil-50 px-3 py-3">
                    <ApprovalChecklist
                      checks={checks}
                      action={
                        abilities.canApproveStage ? (
                          <ApproveStageForm
                            projectId={id}
                            ordinal={stage.ordinal}
                            blockers={checks
                              .filter((c) => c.state === "fail")
                              .map((c) => c.requirement)}
                          />
                        ) : (
                          <p className="max-w-xs text-right text-xs text-soil-600">
                            Dự án đã bị xoá nên mọi đường ghi, kể cả duyệt, đã đóng lại.
                          </p>
                        )
                      }
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {views.map((stage) => {
        const blockers = approvalBlockers(views, stage.ordinal, gate);
        const stageTasks = tasks.filter((t) => t.stage_id === stage.id);
        const done = stageTasks.filter((t) => t.status === "done").length;
        const kind = STAGE_DOCUMENT[stage.ordinal];
        const stageDocs = kind ? documents.filter((d) => d.kind === kind) : [];
        const hasContent = present[presenceByOrdinal[stage.ordinal]];
        const approval = approvalByStage.get(stage.id);
        const approvedBy =
          approval?.approvedBy ??
          ((stages.find((row) => row.id === stage.id)?.approved_by ?? null) as string | null);

        return (
          <details
            key={stage.id}
            id={`buoc-${stage.ordinal}`}
            open
            className="scroll-mt-6 overflow-hidden rounded-xl border border-soil-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 hover:bg-soil-50">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  hasContent
                    ? "bg-leaf-100 text-leaf-800"
                    : "bg-soil-100 text-soil-600"
                }`}
              >
                <span aria-hidden>{hasContent ? "✓" : "○"}</span>
                <span className="sr-only">{hasContent ? "Đã có nội dung" : "Còn thiếu nội dung"}</span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-soil-900">{stage.title}</span>
                <span className="mt-0.5 block text-sm text-soil-600">
                  {STAGE_HINT[stage.ordinal]}
                </span>
              </span>

              <span className="text-right text-xs text-soil-600">
                {/*
                  Nhãn phải nói rõ nó đang nói về NỘI DUNG. Bản cũ ghi "Còn thiếu" ngay
                  cạnh dòng "Đã duyệt", làm người dùng đọc thành hai câu mâu thuẫn về
                  cùng một thứ — trong khi đó là hai trục khác nhau: có nội dung chưa, và
                  đã bấm duyệt chưa.
                */}
                <Badge tone={hasContent ? "leaf" : "soil"}>
                  {hasContent ? "Đã có nội dung" : "Chưa có nội dung"}
                </Badge>
                {stage.approvedAt && (
                  <span className="mt-1 block">
                    Đã duyệt · {new Date(stage.approvedAt).toLocaleString("vi-VN")}
                  </span>
                )}
                {stage.approvedAt && (
                  <span className="mt-1 block">
                    {approvedBy
                      ? (approval?.approverName ?? "Không đọc được tên người duyệt")
                      : "Không ghi nhận người duyệt"}
                  </span>
                )}
              </span>
            </summary>

            <div className="space-y-4 border-t border-soil-200 px-5 py-4">
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

              {stage.ordinal === 4 &&
                (project.standard_locked_at ? (
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
                    standardLocked
                    canEdit={abilities.canChooseStandard}
                  />
                ) : (
                  <Locked
                    title="Chưa thể chọn Methodology"
                    reason="Cần khoá Standard trước vì Methodology phải thuộc một Standard. Đây là phụ thuộc dữ liệu, không phải thứ tự điền hồ sơ."
                    unlock={
                      <LinkButton href="#buoc-3" variant="secondary">
                        Xem hồ sơ Standard
                      </LinkButton>
                    }
                  />
                ))}

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
                          <code className="font-mono">project_validate_values</code> áp dụng. Hồ sơ
                          Baseline chưa thể duyệt cho tới khi hết lỗi; việc điền các hồ sơ khác
                          vẫn mở.
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
                  <Locked
                    title="Chưa thể nhập Baseline"
                    reason="Form baseline sinh từ metric_schema của Methodology; chưa chọn Methodology thì chưa có field nào để hiển thị. Đây là phụ thuộc dữ liệu, không phải thứ tự điền hồ sơ."
                    unlock={
                      <LinkButton href="#buoc-4" variant="secondary">
                        Xem hồ sơ Methodology
                      </LinkButton>
                    }
                  />
                ))}

              {stage.ordinal === 6 && (
                <p className="text-sm text-soil-600">
                  Schema không có bảng checklist riêng cho additionality. Có thể theo dõi các
                  việc cần làm trên bảng công việc với nhãn hồ sơ Additionality, rồi tải hồ sơ
                  chứng minh lên đây.
                </p>
              )}

              {kind && (
                <div className="rounded-lg border border-soil-200 bg-soil-50 p-4">
                  <SectionHeader title={DOCUMENT_KIND_LABEL[kind]} />

                  {stageDocs.length > 0 ? (
                    <ul className="space-y-1 text-sm text-soil-700">
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
                    <Empty
                      title={`Chưa có ${DOCUMENT_KIND_LABEL[kind]}`}
                      hint="Tải tài liệu chứng minh để hoàn thiện hồ sơ này. Mỗi lần tải lên tạo một phiên bản mới."
                      action={
                        abilities.canUploadFiles ? (
                          <UploadDocumentForm
                            projectId={id}
                            stageId={stage.id}
                            kind={kind}
                            unavailableReason={uploadUnavailable}
                          />
                        ) : (
                          <LinkButton href={`/du-an/${id}/thanh-vien`} variant="secondary">
                            Xem người phụ trách dự án
                          </LinkButton>
                        )
                      }
                    />
                  )}

                  {stageDocs.length > 0 && abilities.canUploadFiles && (
                    <div className="mt-3">
                      <UploadDocumentForm
                        projectId={id}
                        stageId={stage.id}
                        kind={kind}
                        unavailableReason={uploadUnavailable}
                      />
                    </div>
                  )}
                </div>
              )}

              {stageTasks.length > 0 && (
                <p className="border-t border-soil-100 pt-4 text-sm text-soil-600">
                  <strong className="font-medium text-soil-900">
                    {done}/{stageTasks.length}
                  </strong>{" "}
                  công việc gắn với hồ sơ này đã xong.{" "}
                  <span className="text-soil-500">
                    Công việc không phải nội dung hồ sơ và không phải điều kiện duyệt.
                  </span>
                </p>
              )}

              {/*
                Một dòng, không phải một khung. Checklist và nút duyệt nằm ở khối "Chờ
                duyệt" đầu trang; nhắc lại đủ sáu điều kiện ở đây là chép cùng một đoạn
                bảy lần trên một trang.
              */}
              {!stage.approvedAt && (
                <p className="border-t border-soil-100 pt-4 text-sm text-soil-600">
                  Chưa duyệt —{" "}
                  {blockers.length === 0 ? "đã đủ điều kiện." : blockers[0]}{" "}
                  <a
                    href={`#duyet-buoc-${stage.ordinal}`}
                    className="font-medium text-leaf-800 hover:underline"
                  >
                    {blockers.length === 0 ? "Duyệt hồ sơ này" : "Xem điều kiện"}
                  </a>
                </p>
              )}
            </div>
          </details>
        );
      })}

      <Card title="Phạm vi của danh mục hồ sơ">
        <p className="text-sm text-soil-700">
          Có đủ nội dung trong bảy hồ sơ giúp đội dự án xây dựng phần thiết kế trên nền
          tảng này. Trạng thái <strong>đã có</strong> không có nghĩa hồ sơ đã được duyệt,
          thẩm định hoặc đủ điều kiện nộp.
        </p>
        <p className="mt-2 text-sm text-soil-700">
          Còn thiếu, và nằm ngoài phạm vi phiên bản hiện tại: stakeholder consultation,
          validation, registration, VVB verification, standard review và issuance — các
          công đoạn 8–11 và 15–17 của quy trình chuẩn. MRV report sinh ở tab Báo cáo là{" "}
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
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-soil-500">
          Điều kiện cơ sở dữ liệu cưỡng chế
        </p>
        {action}
      </div>

      <ul className="mt-2 space-y-2">
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
