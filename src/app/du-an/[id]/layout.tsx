import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getActiveProjectSupport, requireProjectMember } from "@/lib/auth";
import { Alert, Badge, NextAction } from "@/components/ui";
import { getDocuments, getMethodology, getProject, getStages, getStandard } from "../data";
import { getProjectSetup } from "./thiet-lap/data";
import { MethodologyIdentity } from "@/components/project/methodology-identity";
import { JourneyRail, dossierCountFor } from "@/components/project/journey-rail";
import { ProjectTabs } from "@/components/project/project-tabs";
import { approvalBlockers, toStageView } from "@/components/project/rules";

/**
 * Khung của MỘT dự án: kiểm tư cách thành viên một lần, rồi dựng tiêu đề và điều hướng.
 *
 * Mọi trang con — kể cả `giam-sat` và `bao-cao` của Module B — nằm bên trong layout này,
 * nên chúng được thừa hưởng lớp chặn ở đây mà không phải tự kiểm lại. Lớp chặn thật vẫn
 * là RLS: layout hỏng thì Postgres vẫn trả rỗng.
 *
 * `NextAction` ở đầu trang chỉ nêu rào ĐẦU TIÊN; danh sách đủ điều kiện của từng bước
 * nằm trong chính khối của bước đó ở tab Thiết kế (`quy-trinh`), nơi có chỗ trích dẫn nguồn.
 *
 * Route giữ tên `quy-trinh` chứ không đổi sang `thiet-lap`: trợ lý ảo tham chiếu cứng
 * đường dẫn này ở `src/lib/chat/prompt.ts`, `knowledge.ts`, `handlers.ts` và eval fixture.
 * Đổi route sẽ làm trợ lý mất ngữ cảnh trang mà không đem lại lợi ích nào cho người dùng.
 */

/**
 * Tab chia làm hai nhóm chứ không còn phẳng: ba tab HÀNH TRÌNH đi theo vòng đời dự án,
 * hai tab CÔNG CỤ dùng xuyên suốt mọi giai đoạn.
 *
 * `giam-sat` và `bao-cao` khoá cho tới khi Methodology bị khoá ở bước 4, vì trước mốc đó
 * `metric_schema` chưa cố định nên không có form nào để sinh. Khoá chứ không ẩn: người
 * dùng cần thấy đủ chu kỳ MRV kể cả phần chưa mở.
 *
 * Điều kiện tinh hơn của Báo cáo — phải có ít nhất một kỳ đã khoá — cố ý KHÔNG kiểm ở
 * đây. Kiểm nó cần một truy vấn `listPeriods` trên MỌI trang con của dự án, trong khi
 * chính trang Báo cáo đã có sẵn dữ liệu đó để nói lý do chính xác hơn.
 */
function tabsFor({ methodologyLocked }: { methodologyLocked: boolean }) {
  const lockReason = "Mở sau khi khoá Methodology ở bước 4 — metric_schema chưa cố định.";

  return [
    { slug: "quy-trinh", label: "Thiết kế" },
    {
      slug: "giam-sat",
      label: "Giám sát",
      locked: !methodologyLocked,
      lockReason,
    },
    {
      slug: "bao-cao",
      label: "Báo cáo",
      locked: !methodologyLocked,
      lockReason,
    },
    { slug: "", label: "Bảng công việc" },
    { slug: "thanh-vien", label: "Thành viên" },
  ];
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireProjectMember(id);

  const [project, stages, documents, setup, supportSession] = await Promise.all([
    getProject(id),
    getStages(id),
    getDocuments(id),
    getProjectSetup(id),
    profile.role === "platform_admin" ? getActiveProjectSupport(id, profile.id) : Promise.resolve(null),
  ]);
  if (!project) notFound();
  const [standard, methodology] = await Promise.all([
    getStandard(project.standard_id),
    getMethodology(project.methodology_id),
  ]);

  /**
   * Thanh tiến độ đếm HỒ SƠ ĐÃ CÓ NỘI DUNG, không đếm lượt duyệt stage.
   *
   * Tính ngay tại đây và truyền xuống, thay vì để `JourneyRail` tự đi lấy: layout đã cầm
   * sẵn `project`, nên tự truy vấn lại trong component là lặp một vòng trên MỌI trang con.
   * `getDocuments` là nguồn của hai hồ sơ Additionality (bước 6) và PDD (bước 7) — tải tài
   * liệu lên cho hai bước đó phải làm con số này nhích lên.
   */
  const dossierCount = dossierCountFor({
    setup,
    standardId: project.standard_id,
    methodologyId: project.methodology_id,
    baseline: project.baseline,
    documentKinds: documents.map((document) => document.kind),
  });

  const views = stages.map(toStageView);
  const current = views.find((s) => !s.approvedAt) ?? null;
  const firstBlocker = current
    ? (approvalBlockers(views, current.ordinal, {
        standardId: project.standard_id,
        methodologyId: project.methodology_id,
        standardLockedAt: project.standard_locked_at,
        methodologyLockedAt: project.methodology_locked_at,
        projectDeleted: project.deleted_at !== null,
      })[0] ?? null)
    : null;

  return (
    <>
      <div className="mb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-soil-900">{project.name}</h1>
            {methodology?.is_sample && <Badge tone="carbon">Methodology MẪU</Badge>}
          </div>
          {project.description && (
            <p className="mt-1 max-w-3xl text-sm text-soil-600">{project.description}</p>
          )}
        </div>

        <JourneyRail
          projectId={id}
          dossierCount={dossierCount}
          methodologyLocked={project.methodology_locked_at !== null}
        />

        <ProjectTabs projectId={id} tabs={tabsFor({ methodologyLocked: project.methodology_locked_at !== null })} />
      </div>

      {/*
        "Việc cần làm tiếp theo" từng là một dòng chữ nhỏ căn phải, lẫn vào tiêu đề. Đây
        là câu người quay lại dự án sau hai tuần hỏi trước tiên, nên nó được kéo ra thành
        một đích bấm được chạy hết chiều ngang, đặt ngay trên nội dung trang.
      */}
      {current && (
        <div className="mb-4">
          <NextAction
            href={`/du-an/${id}/quy-trinh#buoc-${current.ordinal}`}
            label={`Bước ${current.ordinal}: ${current.title}`}
            note={firstBlocker ?? undefined}
          />
        </div>
      )}

      {project.deleted_at && (
        <div className="mb-4">
          <Alert tone="warn" title="Dự án đã xoá">
            Dự án này đã bị xoá. Nội dung vẫn xem lại được, nhưng mọi thao tác
            ghi đều bị chặn.
          </Alert>
        </div>
      )}

      {supportSession && (
        <div className="mb-4">
          <Alert tone="warn" title="Phiên hỗ trợ chỉ đọc đang hoạt động">
            Quyền xem hộ được ghi vào nhật ký với lý do “{supportSession.reason}” và tự hết
            hạn lúc {new Date(supportSession.expiresAt).toLocaleString("vi-VN")}. Bạn không
            thể sửa dữ liệu, duyệt stage hoặc chạy thao tác MRV trong phiên này.
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
