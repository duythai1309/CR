import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { Alert, Badge, Card, Empty, Table } from "@/components/ui";
import { abilitiesFor } from "@/components/project/rules";
import { buildMethodologyForm } from "@/lib/methodology/form";
import { evaluateMethodology, type FactorInput } from "@/lib/methodology/expression";
import type { MetricValues } from "@/lib/methodology/schema";
import {
  incompleteRecords,
  observedRange,
  summariseObservations,
} from "@/components/monitoring/summary";
import { TraceView, type TraceData } from "@/components/monitoring/trace-view";
import { getProject } from "../../../data";
import { getPeriod, getPeriodData, listImports } from "../data";
import { ImportPanel, LockPeriodForm, ObservationForm, ObservationRow } from "./forms";

export const metadata: Metadata = { title: "Kỳ giám sát" };

export default async function PeriodPage({
  params,
}: {
  params: Promise<{ id: string; periodId: string }>;
}) {
  const { id, periodId } = await params;
  const { role } = await requireProjectMember(id);

  const [project, period] = await Promise.all([getProject(id), getPeriod(id, periodId)]);
  if (!project || !period) notFound();

  const [records, imports] = await Promise.all([getPeriodData(periodId), listImports(periodId)]);

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const open = period.status === "open";
  const canEdit = abilities.canWriteTasks && open;

  const form = buildMethodologyForm(period.schema_snapshot, "vi");
  const summaries = summariseObservations(
    form.observation,
    form.baseline,
    period.baseline_snapshot as MetricValues,
    records.map((r) => ({ metric_values: r.metric_values as MetricValues })),
  );
  const incomplete = incompleteRecords(
    form.observation,
    records.map((r) => ({
      record_key: r.record_key,
      metric_values: r.metric_values as MetricValues,
    })),
  );
  const range = observedRange(records);

  // Ước tính tại chỗ cho kỳ đang mở. Kỳ đã khoá thì con số chính thức nằm ở báo cáo, sinh
  // bằng `estimateMrvReport` từ ảnh chụp — không tính lại từ dữ liệu hiện thời.
  let estimate: { results: Record<string, { value: string; unit: string; aggregation: string }>; trace: TraceData } | null = null;
  let estimateError: string | null = null;
  if (records.length > 0) {
    try {
      const evaluation = evaluateMethodology(
        period.schema_snapshot,
        period.baseline_snapshot as MetricValues,
        records.map((r) => ({
          record_key: r.record_key,
          values: r.metric_values as MetricValues,
        })),
        period.factors_snapshot as unknown as FactorInput[],
      );
      estimate = {
        results: evaluation.results,
        trace: { order: evaluation.order, ...evaluation.trace } as TraceData,
      };
    } catch (e) {
      estimateError = e instanceof Error ? e.message : "Không tính được.";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/du-an/${id}/giam-sat`} className="text-sm text-soil-600 hover:text-soil-900">
          ← Các kỳ giám sát
        </Link>
        <h2 className="text-lg font-semibold text-soil-900">{period.name}</h2>
        <Badge tone={open ? "carbon" : "leaf"}>{open ? "Đang mở" : "Đã khoá"}</Badge>
        <span className="text-sm text-soil-600">
          {period.start_date} → {period.end_date} · bản {period.version}
        </span>
      </div>

      {!open && (
        <Alert tone="ok" title="Kỳ đã khoá">
          Dữ liệu đã đóng băng. Báo cáo sinh từ kỳ này sẽ không đổi số kể cả khi dữ liệu ở
          nơi khác thay đổi. Cần hiệu chỉnh thì tạo kỳ bản mới.
        </Alert>
      )}

      <Card
        title="Đối chiếu với baseline"
        description="Chỉ số quan sát của kỳ, đặt cạnh giá trị baseline đã chụp lúc tạo kỳ."
      >
        {summaries.length === 0 ? (
          <p className="text-sm text-soil-600">Methodology này không khai chỉ số quan sát nào.</p>
        ) : (
          <Table head={["Chỉ số", "Đơn vị", "Số quan sát", "Nhỏ nhất", "Lớn nhất", "Trung bình", "Baseline"]}>
            {summaries.map((s) => (
              <tr key={s.fieldId} className="border-b border-soil-100 last:border-0">
                <td className="px-3 py-2 font-medium text-soil-900">{s.label}</td>
                <td className="px-3 py-2 text-soil-600">{s.unit}</td>
                <td className="px-3 py-2 text-soil-700">{s.count}</td>
                <td className="px-3 py-2 text-soil-700">{s.min ?? "—"}</td>
                <td className="px-3 py-2 text-soil-700">{s.max ?? "—"}</td>
                <td className="px-3 py-2 text-soil-700">{s.mean ?? "—"}</td>
                <td className="px-3 py-2 text-soil-900">{s.baseline ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm text-soil-600">
          <div>
            <dt className="inline font-medium">Số quan sát: </dt>
            <dd className="inline text-soil-900">{records.length}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Khoảng ngày thực tế: </dt>
            <dd className="inline text-soil-900">
              {range ? `${range.first} → ${range.last}` : "chưa có dữ liệu"}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Số lần ghi: </dt>
            <dd className="inline text-soil-900">{period.data_revision}</dd>
          </div>
        </dl>

        {incomplete.length > 0 && (
          <div className="mt-4">
            <Alert tone="warn" title={`${incomplete.length} quan sát còn thiếu chỉ số bắt buộc`}>
              {incomplete
                .slice(0, 5)
                .map((r) => `${r.recordKey} (${r.missing.join(", ")})`)
                .join("; ")}
              {incomplete.length > 5 && ` … và ${incomplete.length - 5} quan sát nữa.`}
            </Alert>
          </div>
        )}
      </Card>

      <Card
        title="Ước tính giảm phát thải"
        description="Áp công thức của Methodology lên dữ liệu đã nhập. Mở vết tính để xem vì sao ra con số này."
      >
        {estimateError && (
          <Alert tone="error" title="Chưa tính được">
            {estimateError}
          </Alert>
        )}

        {!estimate && !estimateError && (
          <p className="text-sm text-soil-600">Nhập số liệu trước đã.</p>
        )}

        {estimate && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(estimate.results).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-soil-200 bg-white p-4">
                  <p className="text-xs text-soil-600">{key}</p>
                  <p className="mt-1 text-xl font-semibold text-soil-900">{value.value}</p>
                  <p className="text-xs text-soil-600">
                    {value.unit} · gộp bằng {value.aggregation}
                  </p>
                </div>
              ))}
            </div>

            <details className="rounded-lg border border-soil-200 bg-soil-50 p-4">
              <summary className="cursor-pointer text-sm font-medium text-soil-900">
                Vết tính toán
              </summary>
              <div className="mt-4">
                <TraceView trace={estimate.trace} />
              </div>
            </details>
          </div>
        )}
      </Card>

      {canEdit && (
        <Card
          title="Nhập một quan sát"
          description="Form sinh từ chỉ số của Methodology đã chụp trong kỳ này."
        >
          <ObservationForm
            projectId={id}
            periodId={periodId}
            fields={form.observation.map((f) => ({
              id: f.id,
              label: f.label,
              control: f.control,
              unit: f.unit,
              required: f.required,
              options: f.options,
            }))}
            startDate={period.start_date}
            endDate={period.end_date}
          />
        </Card>
      )}

      {canEdit && (
        <Card
          title="Nhập từ tệp CSV"
          description="Xem trước toàn bộ lỗi theo dòng và cột trước khi ghi. Hoặc cả tệp vào, hoặc không dòng nào vào."
        >
          <ImportPanel projectId={id} periodId={periodId} schema={period.schema_snapshot} />
        </Card>
      )}

      <Card title={`Dữ liệu đã nhập (${records.length})`}>
        {records.length === 0 ? (
          <Empty title="Chưa có quan sát nào" hint="Nhập tay hoặc nhập từ tệp CSV." />
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <Table
              head={[
                "Mã quan sát",
                "Ngày",
                ...form.observation.map((f) => f.label),
                "Nguồn",
                ...(canEdit ? [""] : []),
              ]}
            >
              {records.map((r) => (
                <ObservationRow
                  key={r.id}
                  projectId={id}
                  periodId={periodId}
                  recordKey={r.record_key}
                  observedOn={r.observed_on}
                  values={form.observation.map((f) => {
                    const v = (r.metric_values as MetricValues)?.[f.id];
                    return v === null || v === undefined ? "—" : String(v);
                  })}
                  fromImport={r.import_id !== null}
                  sourceRow={r.source_row}
                  expectedRevision={period.data_revision}
                  canEdit={canEdit}
                />
              ))}
            </Table>
          </div>
        )}
      </Card>

      {imports.length > 0 && (
        <Card title="Lần nhập tệp" description="Mỗi lần nhập được ghi lại để truy nguồn số liệu.">
          <Table head={["Thời điểm", "Mã lần nhập"]}>
            {imports.map((i) => (
              <tr key={i.id} className="border-b border-soil-100 last:border-0">
                <td className="px-3 py-2 text-soil-700">
                  {new Date(i.created_at).toLocaleString("vi-VN")}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-soil-600">{i.id}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {abilities.canApproveStage && open && (
        <Card
          title="Khoá kỳ"
          description="Đóng băng dữ liệu để sinh báo cáo. Không mở lại được — hiệu chỉnh bằng kỳ bản mới."
        >
          <LockPeriodForm
            projectId={id}
            periodId={periodId}
            expectedRevision={period.data_revision}
            recordCount={records.length}
            incompleteCount={incomplete.length}
          />
        </Card>
      )}
    </div>
  );
}
