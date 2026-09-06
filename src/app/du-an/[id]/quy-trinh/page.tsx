import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { Alert, Badge, Card } from "@/components/ui";
import { buildMethodologyForm } from "@/lib/methodology/form";
import {
  DOCUMENT_KIND_LABEL,
  STAGE_HINT,
  abilitiesFor,
  approvalBlockers,
  toStageView,
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

export const metadata: Metadata = { title: "Bảy bước" };

const STAGE_DOCUMENT: Record<number, DocumentKind> = {
  2: "feasibility",
  5: "baseline",
  6: "additionality",
  7: "pdd",
};

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireProjectMember(id);

  const [project, stages, tasks, documents, standards] = await Promise.all([
    getProject(id),
    getStages(id),
    getTasks(id),
    getDocuments(id),
    listStandards(),
  ]);
  if (!project) notFound();

  const [methodologies, methodology] = await Promise.all([
    listMethodologies(project.standard_id),
    getMethodology(project.methodology_id),
  ]);

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const views = stages.map(toStageView);
  const gate = {
    standardId: project.standard_id,
    methodologyId: project.methodology_id,
    standardLockedAt: project.standard_locked_at,
    methodologyLockedAt: project.methodology_locked_at,
  };

  const baselineFields = methodology
    ? buildMethodologyForm(methodology.metric_schema, "vi", project.baseline as never).baseline
    : [];

  return (
    <div className="space-y-4">
      {methodology?.is_sample && (
        <Alert tone="warn" title="Methodology MẪU — chưa thẩm định">
          Chỉ dùng để thử luồng; báo cáo từ methodology này luôn là bản xem thử. <span title={methodology.disclaimer}>Xem disclaimer đầy đủ</span>.
        </Alert>
      )}

      {views.map((stage) => {
        const blockers = approvalBlockers(views, stage.ordinal, gate);
        const stageTasks = tasks.filter((t) => t.stage_id === stage.id);
        const done = stageTasks.filter((t) => t.status === "done").length;
        const kind = STAGE_DOCUMENT[stage.ordinal];
        const stageDocs = kind ? documents.filter((d) => d.kind === kind) : [];

        return (
          <Card
            key={stage.id}
            title={
              <span className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-leaf-100 text-xs font-bold text-leaf-800">
                  {stage.ordinal}
                </span>
                {stage.title}
                {stage.approvedAt && <Badge tone="leaf">Đã duyệt</Badge>}
              </span>
            }
            description={STAGE_HINT[stage.ordinal]}
            action={
              abilities.canApproveStage && !stage.approvedAt ? (
                <ApproveStageForm
                  projectId={id}
                  ordinal={stage.ordinal}
                  blockers={blockers}
                />
              ) : null
            }
          >
            <div className="space-y-4">
              {stageTasks.length > 0 && (
                <p className="text-sm text-soil-600">
                  {done}/{stageTasks.length} công việc đã xong ở bước này.
                </p>
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
                  />
                ) : (
                  <p className="text-sm text-soil-600">
                    Chọn Methodology ở bước 4 trước — form baseline được sinh từ chỉ số của
                    chính Methodology đó.
                  </p>
                ))}

              {stage.ordinal === 6 && (
                <p className="text-sm text-soil-600">
                  Đánh giá additionality bằng checklist: tạo mỗi mục kiểm tra thành một
                  công việc ở bước 6 trên bảng công việc, rồi tải hồ sơ chứng minh lên đây.
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
          </Card>
        );
      })}
    </div>
  );
}
