import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireProjectMember } from "@/lib/auth";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
import { Alert, Badge } from "@/components/ui";
import { getMethodology, getProject, getStages, getStandard } from "../data";
import { MethodologyIdentity } from "@/components/project/methodology-identity";
import { ProjectTabs } from "@/components/project/project-tabs";
import { approvalBlockers, approvedCount, toStageView } from "@/components/project/rules";

/**
 * Khung của MỘT dự án: kiểm tư cách thành viên một lần, rồi dựng tiêu đề và các tab.
 *
 * Mọi trang con — kể cả `giam-sat` và `bao-cao` của Module B — nằm bên trong layout này,
 * nên chúng được thừa hưởng lớp chặn ở đây mà không phải tự kiểm lại. Lớp chặn thật vẫn
 * là RLS: layout hỏng thì Postgres vẫn trả rỗng.
 *
 * Dòng "việc cần làm tiếp theo" ở đầu trang trả lời câu mà người quay lại một dự án sau
 * hai tuần hỏi trước tiên. Nó chỉ nêu rào ĐẦU TIÊN; danh sách đủ bảy điều kiện nằm ở tab
 * Bảy bước, nơi có chỗ để trích dẫn nguồn cho từng điều.
 */
const TABS = [
  { slug: "", label: "Bảng công việc" },
  { slug: "thiet-lap", label: "Khởi tạo" },
  { slug: "quy-trinh", label: "Bảy bước" },
  { slug: "thanh-vien", label: "Thành viên" },
  { slug: "giam-sat", label: "Giám sát" },
  { slug: "bao-cao", label: "Báo cáo" },
];

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await requireProjectMember(id);

  const [project, stages] = await Promise.all([getProject(id), getStages(id)]);
  if (!project) notFound();
  const [standard, methodology] = await Promise.all([
    getStandard(project.standard_id),
    getMethodology(project.methodology_id),
  ]);

  const views = stages.map(toStageView);
  const approved = approvedCount(views);
  const current = views.find((s) => !s.approvedAt) ?? null;
  const firstBlocker = current
    ? (approvalBlockers(views, current.ordinal, {
        standardId: project.standard_id,
        methodologyId: project.methodology_id,
        standardLockedAt: project.standard_locked_at,
        methodologyLockedAt: project.methodology_locked_at,
        isOwner: role === "owner",
        projectDeleted: project.deleted_at !== null,
      })[0] ?? null)
    : null;

  return (
    <>
      <div className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-soil-900">{project.name}</h1>
              <Badge tone={role === "owner" ? "leaf" : "soil"}>{PROJECT_ROLE_LABEL[role]}</Badge>
              {methodology?.is_sample && <Badge tone="carbon">Methodology MẪU</Badge>}
            </div>
            {project.description && (
              <p className="mt-1 max-w-3xl text-sm text-soil-600">{project.description}</p>
            )}
          </div>

          <div className="text-right text-sm">
            <p className="text-soil-600">
              <span className="font-semibold tabular-nums text-soil-900">{approved}/7</span> bước đã
              duyệt
            </p>
            {current ? (
              <p className="mt-0.5 text-xs text-soil-600">
                Tiếp theo:{" "}
                <Link
                  href={`/du-an/${id}/quy-trinh#buoc-${current.ordinal}`}
                  className="font-medium text-leaf-800 hover:underline"
                >
                  {current.ordinal}. {current.title}
                </Link>
                {firstBlocker && (
                  <span className="mt-0.5 block text-carbon-700">{firstBlocker}</span>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-leaf-800">Bảy bước thiết kế đã duyệt xong.</p>
            )}
          </div>
        </div>

        <ProjectTabs projectId={id} tabs={TABS} />
      </div>

      {project.deleted_at && (
        <div className="mb-4">
          <Alert tone="warn" title="Dự án đã xoá">
            Dự án này đã được chủ dự án xoá. Nội dung vẫn xem lại được, nhưng mọi thao tác
            ghi đều bị chặn.
          </Alert>
        </div>
      )}

      <div className="mb-5">
        <MethodologyIdentity standard={standard} methodology={methodology} compact />
      </div>

      {children}
    </>
  );
}
