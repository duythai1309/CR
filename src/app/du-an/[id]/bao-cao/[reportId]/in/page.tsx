import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { TraceView, type TraceData } from "@/components/monitoring/trace-view";
import { getMethodology, getProject, getStandard } from "../../../../data";
import { getPeriod, getReport, listProjectActors } from "../../../giam-sat/data";
import { parseReportTemplateSnapshot } from "@/lib/mrv/template";

export const metadata: Metadata = { title: "Bản in báo cáo" };

/**
 * Bản in.
 *
 * Không thư viện PDF nào được thêm vào (đã chốt): trang này in bằng chính chức năng in
 * của trình duyệt, và "Lưu thành PDF" là lựa chọn có sẵn trong hộp thoại in trên mọi hệ
 * điều hành. Đổi lại là không kiểm soát được bố cục tuyệt đối như một trình sinh PDF thật.
 *
 * Cố ý KHÔNG mang hình thức của Verra hay Gold Standard: kho mã không có tệp mẫu thật, và
 * một tài liệu trông giống hồ sơ chính thức mà không phải hồ sơ chính thức là thứ nguy
 * hiểm hơn cả việc không có gì để in.
 */
export default async function PrintableReportPage({
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
  const results = report.results as {
    estimated_credit?: { calculation_id?: string; value?: string; unit?: string };
    calculations?: Record<string, { value: string; unit: string; aggregation: string }>;
  };
  const snapshot = (report.input_snapshot ?? []) as Array<{
    record_key: string;
    observed_on: string;
    metric_values: Record<string, unknown>;
  }>;
  const metricKeys = [...new Set(snapshot.flatMap((r) => Object.keys(r.metric_values ?? {})))].sort();
  const template = parseReportTemplateSnapshot(report.template_snapshot);

  return (
    <article className="mx-auto max-w-4xl bg-white p-8 text-soil-900 print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          article { width: auto; max-width: none; }
          section, tr, dl > div { break-inside: avoid; }
          thead { display: table-header-group; }
          h1, h2, h3, h4 { break-after: avoid; }
        }
      `}</style>

      <div className="no-print mb-6 rounded-lg border border-carbon-100 bg-carbon-100/40 px-4 py-3 text-sm text-carbon-700">
        Dùng chức năng in của trình duyệt (Ctrl/Cmd + P) rồi chọn “Lưu thành PDF”.
      </div>

      <header className="border-b-2 border-soil-900 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-soil-600">
          Báo cáo ước tính MRV
        </p>
        <h1 className="mt-1 text-2xl font-bold">{project.name}</h1>
        <p className="mt-1 text-sm text-soil-600">
          {period?.name} · {period?.start_date} → {period?.end_date} · bản báo cáo{" "}
          {report.version}
        </p>
        <p className="mt-1 break-all font-mono text-xs text-soil-600">
          Standard: {standard?.code ?? "—"} · Methodology: {methodology?.code ?? "—"} · version {methodology?.version ?? "—"} · schema_hash {report.schema_hash}
        </p>
      </header>

      <section className="mt-5 rounded border-2 border-carbon-500 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide">Tuyên bố bắt buộc đọc</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Tài liệu này là <strong>ước tính nội bộ</strong>, không phải tín chỉ carbon đã được
          phát hành và không phải hồ sơ nộp cho tổ chức chứng nhận. Bản in này là bố cục của
          nền tảng, không phải bản DOCX đã điền theo biểu mẫu của Verra. Số liệu chưa qua
          thẩm định độc lập.
        </p>
        {template?.status === "ready" && (
          <p className="mt-2 text-sm">
            Snapshot báo cáo tham chiếu VCS Monitoring Report {template.version}; tệp gốc
            được tải riêng ở trang chi tiết báo cáo.
          </p>
        )}
        {methodology?.is_sample && (
          <p className="mt-2 text-sm font-semibold">
            Methodology SAMPLE do nhóm sản phẩm tự soạn, chưa thẩm định và không được Verra
            hay Gold Standard công nhận. Báo cáo final từ dữ liệu mẫu bị từ chối.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-base font-bold">1. Kết quả ước tính</h2>
        <p className="mt-2 text-2xl font-bold">
          {results.estimated_credit?.value ?? "—"}{" "}
          <span className="text-base font-normal">{results.estimated_credit?.unit ?? ""}</span>
        </p>
        <p className="text-sm text-soil-600">
          Chỉ số dùng: {results.estimated_credit?.calculation_id ?? "—"}
        </p>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-soil-300 text-left">
              <th className="py-1.5">Chỉ số tính</th>
              <th className="py-1.5">Giá trị</th>
              <th className="py-1.5">Đơn vị</th>
              <th className="py-1.5">Cách gộp</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(results.calculations ?? {}).map(([key, v]) => (
              <tr key={key} className="border-b border-soil-100">
                <td className="py-1.5 font-mono text-xs">{key}</td>
                <td className="py-1.5 font-medium">{v.value}</td>
                <td className="py-1.5">{v.unit}</td>
                <td className="py-1.5">{v.aggregation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-bold">2. Truy xuất nguồn gốc</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <tbody>
            {[
              ["Phiên bản engine tính", report.engine_version],
              ["Số hiệu bản dữ liệu", String(report.data_revision)],
              ["Số hiệu bản baseline", String(report.baseline_revision)],
              ["Standard / Methodology", `${standard?.code ?? "—"} / ${methodology?.code ?? "—"} ${methodology?.version ?? ""}`],
              ["Mã băm lược đồ chỉ số", report.schema_hash],
              ["Số quan sát", String(snapshot.length)],
              ["Người yêu cầu", requester ? `${requester.fullName} · ${report.requested_by}` : report.requested_by],
              ["Sinh lúc", new Date(report.generated_at).toLocaleString("vi-VN")],
            ].map(([label, value]) => (
              <tr key={label} className="border-b border-soil-100">
                <td className="w-56 py-1.5 text-soil-600">{label}</td>
                <td className="break-all py-1.5 font-mono text-xs">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-bold">3. Số liệu đã dùng ({snapshot.length} quan sát)</h2>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-soil-300 text-left">
              <th className="py-1.5">Mã quan sát</th>
              <th className="py-1.5">Ngày</th>
              {metricKeys.map((k) => (
                <th key={k} className="py-1.5">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshot.map((row) => (
              <tr key={row.record_key} className="border-b border-soil-100">
                <td className="py-1">{row.record_key}</td>
                <td className="py-1">{row.observed_on}</td>
                {metricKeys.map((k) => (
                  <td key={k} className="py-1">
                    {row.metric_values?.[k] === undefined ? "—" : String(row.metric_values[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 break-before-page">
        <h2 className="text-base font-bold">4. Calculation trace — vết tính toán</h2>
        <p className="mt-1 text-sm text-soil-600">
          Trình bày theo thứ tự engine thực thi; giá trị giữ nguyên, không làm tròn thêm ở giao diện.
        </p>
        <div className="mt-3">
          <TraceView
            trace={report.calculation_trace as TraceData}
            limit={Number.MAX_SAFE_INTEGER}
            expandAll
          />
        </div>
      </section>

      <footer className="mt-8 border-t border-soil-300 pt-3 text-xs text-soil-600">
        Nền tảng quản lý dự án Carbon · Báo cáo ước tính MRV · Không phải tín chỉ đã phát hành
      </footer>
    </article>
  );
}
