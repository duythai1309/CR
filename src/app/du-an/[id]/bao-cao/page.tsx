import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { Alert, Badge, Card, Empty, Table } from "@/components/ui";
import { abilitiesFor } from "@/components/project/rules";
import { getMethodology, getProject } from "../../data";
import { listPeriods, listReports, listTemplates } from "../giam-sat/data";
import { creditCalculationOptions } from "./actions";
import { GenerateReportForm } from "./forms";

export const metadata: Metadata = { title: "Báo cáo MRV" };

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireProjectMember(id);

  const [project, periods, reports] = await Promise.all([
    getProject(id),
    listPeriods(id),
    listReports(id),
  ]);
  if (!project) notFound();

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const locked = periods.filter((p) => p.status === "locked");
  const methodology = await getMethodology(project.methodology_id);

  const templates =
    project.methodology_id && project.standard_id
      ? await listTemplates(project.methodology_id, project.standard_id)
      : [];

  const outputs = locked[0] ? await creditCalculationOptions(locked[0].schema_snapshot) : [];
  const periodName = new Map(periods.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <Alert tone="warn" title="Đây là ước tính, không phải tín chỉ đã phát hành">
        Báo cáo sinh ở đây áp công thức của Methodology lên số liệu đã nhập.
        {methodology?.is_sample &&
          " Methodology đang dùng là dữ liệu MẪU do nhóm tự soạn, chưa được thẩm định chuyên môn và không phải methodology được Verra hay Gold Standard công nhận."}{" "}
        Kết quả chưa qua thẩm định độc lập và không thay thế hồ sơ phát hành tín chỉ.
      </Alert>

      {abilities.canWriteTasks && (
        <Card
          title="Sinh báo cáo mới"
          description="Chỉ sinh được từ kỳ đã khoá — nhờ vậy con số trong báo cáo không đổi khi dữ liệu sau này thay đổi."
        >
          {locked.length === 0 ? (
            <p className="text-sm text-soil-600">
              Chưa có kỳ nào được khoá.{" "}
              <Link href={`/du-an/${id}/giam-sat`} className="text-leaf-700 hover:underline">
                Sang phần giám sát
              </Link>{" "}
              để nhập số liệu và khoá kỳ.
            </p>
          ) : templates.length === 0 ? (
            <Alert tone="warn">
              Chưa có template báo cáo nào cho cặp Standard/Methodology của dự án. Quản trị
              nền tảng cần thêm trước.
            </Alert>
          ) : (
            <GenerateReportForm
              projectId={id}
              periods={locked.map((p) => ({
                id: p.id,
                label: `${p.name} (${p.start_date} → ${p.end_date}, bản ${p.version})`,
              }))}
              templates={templates.map((t) => ({
                id: t.id,
                label: `${t.version} · ${t.format.toUpperCase()}`,
                status: t.status,
              }))}
              outputs={outputs}
            />
          )}
        </Card>
      )}

      <Card title={`Báo cáo đã sinh (${reports.length})`}>
        {reports.length === 0 ? (
          <Empty
            title="Chưa có báo cáo nào"
            hint="Khoá một kỳ giám sát rồi sinh báo cáo ước tính từ đó."
          />
        ) : (
          <Table head={["Kỳ", "Bản", "Trạng thái", "Ước tính", "Sinh lúc", ""]}>
            {reports.map((r) => {
              const credit = (r.results as { estimated_credit?: { value?: string; unit?: string } })
                ?.estimated_credit;
              return (
                <tr key={r.id} className="border-b border-soil-100 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-soil-900">
                    {periodName.get(r.period_id) ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-soil-700">{r.version}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={r.status === "final" ? "leaf" : "carbon"}>
                      {r.status === "final" ? "Chính thức" : "Xem thử"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-soil-900">
                    {credit?.value ?? "—"} {credit?.unit ?? ""}
                  </td>
                  <td className="px-3 py-2.5 text-soil-700">
                    {new Date(r.generated_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/du-an/${id}/bao-cao/${r.id}`}
                      className="text-sm font-medium text-leaf-700 hover:underline"
                    >
                      Xem
                    </Link>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
