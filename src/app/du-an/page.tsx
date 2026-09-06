import type { Metadata } from "next";
import { PageHeader } from "@/components/app-nav";
import { Alert, Empty, LinkButton, Stat } from "@/components/ui";
import { ProjectPortfolio } from "@/components/project/portfolio";
import { projectAttention } from "@/components/project/rules";
import { listPortfolio } from "./data";

export const metadata: Metadata = { title: "Danh mục dự án" };

/**
 * Danh mục dự án — màn hình mở đầu của người giữ nhiều hồ sơ cùng lúc.
 *
 * Đọc một lượt bằng `listPortfolio()` rồi giao toàn bộ việc lọc/sắp xếp cho client. Bốn
 * ô tổng ở đầu trang trả lời câu hỏi "sáng nay tôi phải nhìn vào đâu", danh mục bên dưới
 * trả lời "cái gì đang chặn dự án nào".
 */
export default async function ProjectListPage() {
  const rows = await listPortfolio();

  const live = rows.filter((r) => !r.deletedAt);
  const attention = live.filter((r) => projectAttention(r).length > 0);
  const myOpen = live.reduce((sum, r) => sum + r.myOpenTasks, 0);
  const designed = live.filter((r) => r.approvedStages === 7).length;
  const sampleMethodology = live.some((r) => r.methodologyIsSample);

  const standards = [...new Set(live.flatMap((r) => (r.standardCode ? [r.standardCode] : [])))].sort();

  return (
    <>
      <PageHeader
        title="Danh mục dự án"
        description="Hồ sơ thiết kế dự án carbon mà bạn là thành viên. Bảy bước từ Project concept tới PDD, rồi monitoring period và MRV estimate."
        action={<LinkButton href="/du-an/moi">Tạo dự án</LinkButton>}
      />

      {rows.length === 0 ? (
        <Empty
          title="Chưa có dự án nào"
          hint={
            <>
              Tạo dự án đầu tiên để bắt đầu. Người tạo là chủ dự án, và bảy stage thiết kế
              được dựng sẵn trong cùng một transaction.
            </>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Dự án đang giữ" value={live.length} tone="soil" />
            <Stat
              label="Đang có việc chặn"
              value={attention.length}
              tone={attention.length > 0 ? "carbon" : "soil"}
              hint="Việc vướng, việc quá hạn, hoặc điều kiện khoá còn thiếu"
            />
            <Stat label="Việc mở giao cho tôi" value={myOpen} tone="leaf" />
            <Stat
              label="Đã duyệt đủ 7/7"
              value={designed}
              tone="soil"
              hint="Xong phần thiết kế; chưa phải hồ sơ nộp được"
            />
          </div>

          {sampleMethodology && (
            <Alert tone="warn" title="Có dự án đang dùng Methodology MẪU">
              Bốn methodology trong hệ thống là dữ liệu mẫu do nhóm tự soạn,{" "}
              <strong>chưa được thẩm định chuyên môn</strong>. Chúng không phải methodology
              được Verra hay Gold Standard công nhận, và mọi con số sinh ra từ chúng chỉ để
              thử luồng.
            </Alert>
          )}

          <ProjectPortfolio rows={rows} standards={standards} />
        </div>
      )}

      <div className="mt-6 rounded-xl border border-soil-200 bg-soil-100/60 px-5 py-4">
        <h2 className="text-sm font-semibold text-soil-900">Phạm vi của nền tảng</h2>
        <p className="mt-1.5 text-sm text-soil-700">
          Nền tảng đi từ <strong>Project concept</strong> tới <strong>PDD</strong>, rồi
          monitoring period và MRV estimate có calculation trace. Luồng{" "}
          <strong>dừng trước</strong> stakeholder consultation, validation, registration,
          VVB verification, standard review và issuance — tương ứng bước 8–11 và 15–17 của
          quy trình chuẩn.
        </p>
        <p className="mt-2 text-sm text-soil-700">
          Nghĩa là: hồ sơ dựng ở đây <strong>chưa phải hồ sơ nộp được</strong>, và MRV
          report là ước tính, không phải tín chỉ đã phát hành. Import observation data hiện
          chỉ nhận CSV.
        </p>
      </div>
    </>
  );
}
