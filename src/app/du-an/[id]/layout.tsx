import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireProjectMember } from "@/lib/auth";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
import { Alert, Badge } from "@/components/ui";
import { getMethodology, getProject, getStages, getStandard } from "../data";
import { MethodologyIdentity } from "@/components/project/methodology-identity";
import { approvedCount, toStageView } from "@/components/project/rules";

/**
 * Khung của MỘT dự án: kiểm tư cách thành viên một lần, rồi dựng tiêu đề và các tab.
 *
 * Mọi trang con — kể cả `giam-sat` và `bao-cao` của Module B — nằm bên trong layout này,
 * nên chúng được thừa hưởng lớp chặn ở đây mà không phải tự kiểm lại. Lớp chặn thật vẫn
 * là RLS: layout hỏng thì Postgres vẫn trả rỗng.
 */
const TABS = [
  { slug: "", label: "Bảng công việc" },
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

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-soil-900">{project.name}</h1>
              <Badge tone={role === "owner" ? "leaf" : "soil"}>{PROJECT_ROLE_LABEL[role]}</Badge>
            </div>
            {project.description && (
              <p className="mt-1 max-w-3xl text-sm text-soil-600">{project.description}</p>
            )}
          </div>
          <p className="text-sm text-soil-600">
            <span className="font-semibold text-soil-900">{approvedCount(stages.map(toStageView))}/7</span> bước đã duyệt
          </p>
        </div>

        <nav className="mt-5 flex flex-wrap gap-1 border-b border-soil-200">
          {TABS.map((tab) => (
            <Link
              key={tab.slug}
              href={`/du-an/${id}${tab.slug ? `/${tab.slug}` : ""}`}
              className="-mb-px rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm text-soil-600 transition hover:border-leaf-500 hover:text-soil-900"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
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
