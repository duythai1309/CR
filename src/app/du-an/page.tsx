import type { Metadata } from "next";
import { PageHeader } from "@/components/app-nav";
import { Alert, Empty, LinkButton, Stat } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
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
  const [profile, rows] = await Promise.all([requireProfile(), listPortfolio()]);

  const live = rows.filter((r) => !r.deletedAt);
  const attention = live.filter((r) => projectAttention(r).length > 0);
  const myOpen = live.reduce((sum, r) => sum + r.myOpenTasks, 0);
  const designed = live.filter((r) => r.dossierCount === 7).length;
  const sampleMethodology = live.some((r) => r.methodologyIsSample);

  const standards = [...new Set(live.flatMap((r) => (r.standardCode ? [r.standardCode] : [])))].sort();

  return (
    <>
      <PageHeader
        title="Danh mục dự án"
        description="Theo dõi các hồ sơ dự án bạn tham gia và việc cần chú ý."
        action={
          <div className="flex gap-2">
            {profile.role === "platform_admin" && (
              <LinkButton href="/du-an/ho-tro" variant="secondary">
                Xem hộ dự án
              </LinkButton>
            )}
            <LinkButton href="/du-an/moi">Tạo dự án</LinkButton>
          </div>
        }
      />

      {rows.length === 0 ? (
        <Empty
          title="Danh mục dự án của bạn đang trống"
          hint="Tạo dự án đầu tiên để bắt đầu xây dựng hồ sơ và theo dõi công việc."
          action={<LinkButton href="/du-an/moi">Tạo dự án đầu tiên</LinkButton>}
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
              label="Đủ 7/7 hồ sơ"
              value={designed}
              tone="soil"
              hint="Bảy mục đều đã có nội dung; chưa phải hồ sơ nộp được"
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

    </>
  );
}
