import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { loadChatConfig, missingKeyMessage } from "@/lib/chat/settings";
import { createClient } from "@/lib/supabase/server";
import {
  Alert,
  Badge,
  Card,
  Empty,
  LinkButton,
  SectionHeader,
  Table,
} from "@/components/ui";
import { abilitiesFor } from "@/components/project/rules";
import { TraceView, type TraceData } from "@/components/monitoring/trace-view";
import { MethodologyIdentity } from "@/components/project/methodology-identity";
import { getMethodology, getProject, getStandard } from "../../../data";
import { getPeriod, getReport, listProjectActors } from "../../giam-sat/data";
import { ReportAssistPanel } from "./assist-panel";

export const metadata: Metadata = { title: "Báo cáo MRV" };

interface ReportResults {
  estimated_credit?: { calculation_id?: string; value?: string; unit?: string };
  calculations?: Record<string, { value: string; unit: string; aggregation: string }>;
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  await requireProjectMember(id);

  const [project, report] = await Promise.all([getProject(id), getReport(id, reportId)]);
  if (!project || !report) notFound();

  const [period, standard, methodology, actors] = await Promise.all([
    getPeriod(id, report.period_id),
    getStandard(report.standard_id),
    getMethodology(report.methodology_id),
    listProjectActors(id),
  ]);
  const requester = actors.find((actor) => actor.userId === report.requested_by);
  const results = report.results as ReportResults;
  const credit = results?.estimated_credit;
  const abilities = abilitiesFor(project.deleted_at !== null);
  const supabase = await createClient();
  const assistantConfigured = (await loadChatConfig(supabase)) !== null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/du-an/${id}/bao-cao`} className="text-sm text-soil-600 hover:text-soil-900">
          ← Danh sách báo cáo
        </Link>
        <div className="mt-3">
          <SectionHeader
            title={`${period?.name ?? "Kỳ giám sát"} — bản ${report.version}`}
            description="Báo cáo ước tính được sinh từ ảnh chụp của kỳ giám sát đã khoá."
            aside={
              <Badge tone={report.status === "final" ? "leaf" : "carbon"}>
                {report.status === "final" ? "Final" : "Preview"}
              </Badge>
            }
          />
        </div>
      </div>

      <Alert tone="warn" title="Ước tính MRV — không phải tín chỉ đã phát hành">
        Con số dưới đây tính từ ảnh chụp dữ liệu của kỳ đã khoá, theo công thức của
        Methodology đã chọn. Chưa qua thẩm định độc lập.
      </Alert>

      {methodology?.is_sample && (
        <Alert tone="warn" title="Methodology SAMPLE do nhóm sản phẩm tự soạn">
          Methodology này chưa được thẩm định chuyên môn và không phải methodology được
          Verra hoặc Gold Standard công nhận. Hệ thống không cho xuất bản báo cáo final từ
          dữ liệu mẫu.
        </Alert>
      )}

      <MethodologyIdentity standard={standard} methodology={methodology} />

      <SectionHeader
        title="Kết quả và truy xuất"
        description="Xem con số ước tính, các ảnh chụp đầu vào và toàn bộ vết tính toán."
      />

      <Card
        title="Ước tính giảm phát thải"
        description={`Chỉ số dùng: ${credit?.calculation_id ?? "—"}`}
      >
        {credit?.value ? (
          <p className="text-3xl font-semibold text-soil-900">
            {credit.value}{" "}
            <span className="text-lg font-normal text-soil-600">{credit.unit ?? ""}</span>
          </p>
        ) : (
          <Empty
            title="Báo cáo chưa có giá trị ước tính"
            hint="Bản báo cáo này không chứa chỉ số ước tính giảm phát thải."
            action={
              <LinkButton href={`/du-an/${id}/bao-cao`} variant="secondary">
                Quay lại danh sách báo cáo
              </LinkButton>
            }
          />
        )}

        {results?.calculations && Object.keys(results.calculations).length > 0 ? (
          <div className="mt-5">
            <div className="overflow-x-auto">
              <div className="min-w-[36rem]">
                <Table head={["Chỉ số tính", "Giá trị", "Đơn vị", "Cách gộp"]}>
                  {Object.entries(results.calculations).map(([key, value]) => (
                    <tr key={key} className="border-b border-soil-100 last:border-0">
                      <td className="px-3 py-2">
                        <code className="text-xs">{key}</code>
                      </td>
                      <td className="px-3 py-2 font-medium text-soil-900">{value.value}</td>
                      <td className="px-3 py-2 text-soil-600">{value.unit}</td>
                      <td className="px-3 py-2 text-soil-600">{value.aggregation}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <Empty
              title="Không có chi tiết phép tính"
              hint="Báo cáo này không lưu kết quả trung gian để đối chiếu."
              action={
                <LinkButton href={`/du-an/${id}/bao-cao`} variant="secondary">
                  Xem báo cáo khác
                </LinkButton>
              }
            />
          </div>
        )}
      </Card>

      <ReportAssistPanel
        projectId={id}
        reportId={reportId}
        configured={assistantConfigured}
        canUse={abilities.canWriteTasks}
        missingMessage={missingKeyMessage()}
      />

      <Card title="Xuất báo cáo">
        <Alert tone="warn" title="Chưa phải mẫu chính thức của tổ chức chứng nhận">
          Kho mã hiện <strong>không có</strong> tệp mẫu PDF/Word thật của Verra hay Gold
          Standard — bản ghi template trong hệ thống mới ở dạng placeholder. Hai đường xuất
          dưới đây là bản trình bày của nền tảng này, dùng để rà soát nội bộ, không phải hồ
          sơ nộp cho tổ chức chứng nhận.
        </Alert>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/du-an/${id}/bao-cao/${reportId}/in`}
            className="rounded-lg border border-soil-200 bg-white px-4 py-2 text-sm font-medium text-soil-800 hover:bg-soil-100"
          >
            Bản in / lưu PDF
          </Link>
          <a
            href={`/du-an/${id}/bao-cao/${reportId}/csv`}
            className="rounded-lg border border-soil-200 bg-white px-4 py-2 text-sm font-medium text-soil-800 hover:bg-soil-100"
          >
            Tải CSV số liệu
          </a>
        </div>
        <p className="mt-2 text-xs text-soil-600">
          Bản in dùng chức năng in của trình duyệt để lưu thành PDF — không cần cài thêm
          phần mềm nào.
        </p>
      </Card>

      <Card
        title="Ảnh chụp dùng để tính"
        description="Báo cáo giữ nguyên các bản chụp này, nên tính lại lúc nào cũng ra đúng con số cũ."
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Số hiệu bản dữ liệu", String(report.data_revision)],
            ["Số hiệu bản baseline", String(report.baseline_revision)],
            ["Phiên bản engine", report.engine_version],
            ["Mã băm lược đồ", report.schema_hash],
            ["Số quan sát", String((report.input_snapshot as unknown[])?.length ?? 0)],
            ["Người yêu cầu", requester ? `${requester.fullName} · ${report.requested_by}` : report.requested_by],
            ["Sinh lúc", new Date(report.generated_at).toLocaleString("vi-VN")],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-40 shrink-0 text-soil-600">{label}</dt>
              <dd className="min-w-0 flex-1 break-all font-mono text-xs text-soil-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Vết tính toán" description="Đối chiếu từng phép tính với VVB và mở rộng toàn bộ quan sát.">
        <div className="overflow-x-auto">
          <TraceView trace={report.calculation_trace as TraceData} limit={Number.MAX_SAFE_INTEGER} expandAll />
        </div>
      </Card>
    </div>
  );
}
