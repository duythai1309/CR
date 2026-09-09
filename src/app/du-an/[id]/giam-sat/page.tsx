import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { Badge, Card, Empty, LinkButton, Locked, SectionHeader, Table } from "@/components/ui";
import { abilitiesFor } from "@/components/project/rules";
import { incompleteRecords } from "@/components/monitoring/summary";
import { buildMethodologyForm } from "@/lib/methodology/form";
import type { MetricValues } from "@/lib/methodology/schema";
import { getProject } from "../../data";
import { getPeriodData, listPeriods } from "./data";
import { CreatePeriodForm } from "./forms";

export const metadata: Metadata = { title: "Giám sát" };

export default async function MonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireProjectMember(id);

  const [project, periods] = await Promise.all([getProject(id), listPeriods(id)]);
  if (!project) notFound();

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const ready = project.methodology_locked_at !== null;
  const periodReadiness = new Map(
    await Promise.all(
      periods.map(async (period) => {
        const rows = await getPeriodData(period.id);
        const fields = buildMethodologyForm(period.schema_snapshot, "vi").observation;
        const incomplete = incompleteRecords(
          fields,
          rows.map((row) => ({
            record_key: row.record_key,
            metric_values: row.metric_values as MetricValues,
          })),
        );
        return [period.id, { records: rows.length, incomplete: incomplete.length }] as const;
      }),
    ),
  );
  const periodRows = periods.map((period) => {
    const readiness = periodReadiness.get(period.id) ?? { records: 0, incomplete: 0 };
    const readyToLock =
      readiness.records === 0
        ? "Chưa có dữ liệu"
        : readiness.incomplete > 0
          ? `${readiness.incomplete} dòng thiếu field`
          : "Đủ dữ liệu bắt buộc";
    return {
      period,
      readiness,
      readyToLock: period.status === "locked" ? "Snapshot đã đóng băng" : readyToLock,
      actionLabel: period.status === "locked" ? "Xem dữ liệu" : "Nhập dữ liệu",
    };
  });

  // Tab đã bị khoá ở điều hướng, nhưng vào thẳng URL vẫn tới được đây. Không có cổng
  // này thì form tạo kỳ vẫn hiện và chết ở DB bằng một lỗi thô — tệ hơn là không hiện.
  if (!ready)
    return (
      <Locked
        title="Chưa tạo được kỳ giám sát"
        reason="Kỳ giám sát chụp lược đồ chỉ số, baseline và bộ hệ số khi tạo, nên Methodology phải được khoá trước."
        unlock={
          <LinkButton href={`/du-an/${id}/quy-trinh#buoc-4`}>
            Tới hồ sơ Methodology
          </LinkButton>
        }
      />
    );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Kỳ giám sát"
        description="Tạo kỳ, nhập số liệu quan sát và khoá ảnh chụp dữ liệu dùng cho báo cáo MRV."
      />

      {abilities.canApproveStage && (
        <div id="tao-ky-giam-sat" className="scroll-mt-6">
          <Card
            title="Tạo kỳ giám sát"
            description="Mỗi kỳ chụp lại lược đồ chỉ số, baseline và bộ hệ số tại thời điểm tạo. Sửa methodology sau đó không làm đổi kỳ đã tạo."
          >
            <CreatePeriodForm projectId={id} />
          </Card>
        </div>
      )}

      <Card
        title="Các kỳ giám sát"
        description="Nhập số liệu vào kỳ đang mở. Khoá kỳ để đóng băng data revision và sinh ước tính MRV."
      >
        {periods.length === 0 ? (
          <Empty
            title="Chưa có kỳ giám sát"
            hint={
              abilities.canApproveStage
                ? "Tạo kỳ đầu tiên để chụp cấu hình hiện tại và bắt đầu nhập dữ liệu quan sát."
                : "Chủ dự án cần tạo kỳ đầu tiên trước khi nhóm có thể nhập dữ liệu quan sát."
            }
            action={
              abilities.canApproveStage ? (
                <LinkButton href="#tao-ky-giam-sat">Tạo kỳ giám sát đầu tiên</LinkButton>
              ) : (
                <LinkButton href={`/du-an/${id}/thanh-vien`} variant="secondary">
                  Xem người phụ trách dự án
                </LinkButton>
              )
            }
          />
        ) : (
          <>
            {/*
              Không đặt hành động chính ở cuối một bảng cuộn ngang: trên màn hẹp, nút vẫn
              tồn tại trong DOM nhưng biến khỏi tầm nhìn và người dùng tưởng không có lối
              nhập dữ liệu. Thẻ dưới đây giữ hành động trong viewport; bảng desktop vẫn
              giữ đủ cột và đưa hành động lên đầu dòng.
            */}
            <div className="grid min-w-0 gap-3 lg:hidden">
              {periodRows.map(({ period, readiness, readyToLock, actionLabel }) => (
                <section
                  key={period.id}
                  className="min-w-0 rounded-lg border border-soil-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-medium text-soil-900">{period.name}</h3>
                      <p className="mt-1 text-sm text-soil-600">
                        {period.start_date} → {period.end_date}
                      </p>
                    </div>
                    <Badge tone={period.status === "locked" ? "leaf" : "carbon"}>
                      {period.status === "locked" ? "Đã khoá" : "Đang mở"}
                    </Badge>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-soil-600">Bản</dt>
                      <dd className="font-medium text-soil-900">{period.version}</dd>
                    </div>
                    <div>
                      <dt className="text-soil-600">Quan sát</dt>
                      <dd className="font-medium text-soil-900">{readiness.records}</dd>
                    </div>
                    <div>
                      <dt className="text-soil-600">Data revision</dt>
                      <dd className="font-medium text-soil-900">{period.data_revision}</dd>
                    </div>
                    <div>
                      <dt className="text-soil-600">Sẵn sàng khoá</dt>
                      <dd className="break-words text-soil-900">{readyToLock}</dd>
                    </div>
                  </dl>

                  <LinkButton
                    href={`/du-an/${id}/giam-sat/${period.id}`}
                    className="mt-4 w-full"
                  >
                    {actionLabel}
                  </LinkButton>
                </section>
              ))}
            </div>

            <div className="hidden min-w-0 overflow-x-auto lg:block">
              <div className="min-w-[64rem]">
                <Table
                  head={[
                    "Thao tác",
                    "Kỳ",
                    "Khoảng thời gian",
                    "Bản",
                    "Trạng thái",
                    "Quan sát",
                    "Data revision",
                    "Sẵn sàng khoá",
                  ]}
                >
                  {periodRows.map(({ period, readiness, readyToLock, actionLabel }) => (
                    <tr key={period.id} className="border-b border-soil-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <LinkButton
                          href={`/du-an/${id}/giam-sat/${period.id}`}
                          variant="secondary"
                          className="whitespace-nowrap px-3 py-1.5"
                        >
                          {actionLabel}
                        </LinkButton>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-soil-900">{period.name}</td>
                      <td className="px-3 py-2.5 text-soil-700">
                        {period.start_date} → {period.end_date}
                      </td>
                      <td className="px-3 py-2.5 text-soil-700">{period.version}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={period.status === "locked" ? "leaf" : "carbon"}>
                          {period.status === "locked" ? "Đã khoá" : "Đang mở"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-soil-700">{readiness.records}</td>
                      <td className="px-3 py-2.5 text-soil-700">{period.data_revision}</td>
                      <td className="px-3 py-2.5 text-xs text-soil-700">{readyToLock}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card title="Cách kỳ giám sát hoạt động">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-soil-700">
          <li>Tạo kỳ — hệ thống chụp lược đồ chỉ số, baseline và hệ số tại đúng thời điểm đó.</li>
          <li>Nhập số liệu bằng tay hoặc nhập tệp CSV. Mỗi lần ghi tăng một số hiệu bản.</li>
          <li>
            Khoá kỳ — dữ liệu đóng băng. Từ đây mới sinh được báo cáo, và báo cáo cũ không
            bao giờ đổi số khi dữ liệu sau này thay đổi.
          </li>
          <li>Cần sửa sau khi khoá thì tạo kỳ <em>bản mới</em> cùng khoảng ngày, không sửa kỳ cũ.</li>
        </ol>
      </Card>
    </div>
  );
}
