import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { Alert, Badge, Card, Empty, Table } from "@/components/ui";
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

  return (
    <div className="space-y-6">
      {!ready && (
        <Alert tone="warn" title="Chưa tạo được monitoring period">
          Phải khoá Methodology ở bước 4 trước. Kỳ giám sát chụp lại lược đồ chỉ số, baseline
          và bộ hệ số ngay lúc tạo, nên lựa chọn phải cố định trước đã.
        </Alert>
      )}

      {abilities.canApproveStage && ready && (
        <Card
          title="Tạo kỳ giám sát"
          description="Mỗi kỳ chụp lại lược đồ chỉ số, baseline và bộ hệ số tại thời điểm tạo. Sửa methodology sau đó không làm đổi kỳ đã tạo."
        >
          <CreatePeriodForm projectId={id} />
        </Card>
      )}

      <Card
        title="Monitoring periods"
        description="Nhập số liệu vào kỳ đang mở. Khoá kỳ để đóng băng data revision và sinh MRV estimate."
      >
        {periods.length === 0 ? (
          <Empty
            title="Chưa có monitoring period nào"
            hint="Tạo kỳ đầu tiên để bắt đầu nhập observation data."
          />
        ) : (
          <Table head={["Kỳ", "Khoảng thời gian", "Bản", "Trạng thái", "Quan sát", "Data revision", "Sẵn sàng khoá", ""]}>
            {periods.map((p) => {
              const readiness = periodReadiness.get(p.id) ?? { records: 0, incomplete: 0 };
              const blockers = readiness.records === 0
                ? "Chưa có dữ liệu"
                : readiness.incomplete > 0
                  ? `${readiness.incomplete} dòng thiếu field`
                  : "Đủ dữ liệu bắt buộc";
              return (
              <tr key={p.id} className="border-b border-soil-100 last:border-0">
                <td className="px-3 py-2.5 font-medium text-soil-900">{p.name}</td>
                <td className="px-3 py-2.5 text-soil-700">
                  {p.start_date} → {p.end_date}
                </td>
                <td className="px-3 py-2.5 text-soil-700">{p.version}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={p.status === "locked" ? "leaf" : "carbon"}>
                    {p.status === "locked" ? "Đã khoá" : "Đang mở"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-soil-700">{readiness.records}</td>
                <td className="px-3 py-2.5 text-soil-700">{p.data_revision}</td>
                <td className="px-3 py-2.5 text-xs text-soil-700">{p.status === "locked" ? "Snapshot đã đóng băng" : blockers}</td>
                <td className="px-3 py-2.5 text-right">
                  <Link
                    href={`/du-an/${id}/giam-sat/${p.id}`}
                    className="text-sm font-medium text-leaf-700 hover:underline"
                  >
                    Mở
                  </Link>
                </td>
              </tr>
              );
            })}
          </Table>
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
