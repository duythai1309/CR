import { Badge, Table } from "@/components/ui";

/**
 * Vết tính toán — `PLAN.md` §4 đòi người dùng xem được **vì sao** ra con số đó.
 *
 * Hiện đúng những gì engine trả về, không diễn giải thêm: thứ tự tính, từng phép trên
 * từng quan sát, hệ số đã dùng kèm nguồn, rồi bước gộp cuối. Con số hiển thị là chuỗi
 * thập phân nguyên bản của engine, không định dạng lại theo locale — làm tròn để nhìn cho
 * đẹp ở đây là bóp méo đúng thứ người ta mở vết ra để kiểm.
 */

export interface TraceData {
  order?: string[];
  records?: Array<{
    record_key: string;
    factors?: Array<{ key: string; value: string | number; unit: string; source: string }>;
    calculations?: Record<
      string,
      { value: string; nodes?: Array<{ path: string; operation: string; inputs: string[]; value: string; unit: string }> }
    >;
  }>;
  aggregation?: Array<{ id: string; inputs: string[]; value: string }>;
  operations?: number;
  precision_digits?: number;
  rounding?: string;
  output_scale?: number;
}

export function TraceView({ trace, limit = 3 }: { trace: TraceData; limit?: number }) {
  const records = trace.records ?? [];
  const shown = records.slice(0, limit);

  return (
    <div className="space-y-5">
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-soil-600">
        <div>
          <dt className="inline font-medium">Độ chính xác: </dt>
          <dd className="inline">{trace.precision_digits ?? "—"} chữ số</dd>
        </div>
        <div>
          <dt className="inline font-medium">Làm tròn: </dt>
          <dd className="inline">{trace.rounding ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Số chữ số kết quả: </dt>
          <dd className="inline">{trace.output_scale ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Số phép tính: </dt>
          <dd className="inline">{trace.operations ?? "—"}</dd>
        </div>
      </dl>

      {trace.order && trace.order.length > 0 && (
        <p className="text-sm text-soil-700">
          Thứ tự tính:{" "}
          {trace.order.map((id, i) => (
            <span key={id}>
              {i > 0 && " → "}
              <code className="rounded bg-soil-100 px-1 py-0.5 text-xs">{id}</code>
            </span>
          ))}
        </p>
      )}

      {trace.aggregation && trace.aggregation.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-soil-900">Aggregation — gộp toàn kỳ</h4>
          <Table head={["Chỉ số tính", "Số giá trị đầu vào", "Kết quả"]}>
            {trace.aggregation.map((a) => (
              <tr key={a.id} className="border-b border-soil-100 last:border-0">
                <td className="px-3 py-2">
                  <code className="text-xs">{a.id}</code>
                </td>
                <td className="px-3 py-2 text-soil-700">{a.inputs.length}</td>
                <td className="px-3 py-2 font-medium text-soil-900">{a.value}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}

      {shown.map((record) => (
        <div key={record.record_key}>
          <h4 className="mb-2 text-sm font-semibold text-soil-900">
            Quan sát <code className="text-xs">{record.record_key}</code>
          </h4>

          {record.factors && record.factors.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {record.factors.map((f) => (
                <li key={f.key} className="rounded-full bg-soil-100 px-2.5 py-0.5 text-xs text-soil-700">
                  {f.key} = {String(f.value)} {f.unit}
                  <span className="ml-1 text-soil-500">· {f.source}</span>
                </li>
              ))}
            </ul>
          )}

          {Object.entries(record.calculations ?? {}).map(([id, calc]) => (
            <details key={id} className="mb-1.5 rounded-lg border border-soil-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-sm">
                <code className="text-xs">{id}</code>{" "}
                <span className="font-medium text-soil-900">= {calc.value}</span>
              </summary>
              <div className="border-t border-soil-100 px-3 py-2">
                <Table head={["Nút", "Phép", "Đầu vào", "Kết quả", "Đơn vị"]}>
                  {(calc.nodes ?? []).map((n, i) => (
                    <tr key={i} className="border-b border-soil-100 last:border-0">
                      <td className="px-3 py-1.5 font-mono text-xs text-soil-600">{n.path}</td>
                      <td className="px-3 py-1.5 text-soil-700">{n.operation}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-soil-600">
                        {n.inputs.join(", ")}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-soil-900">{n.value}</td>
                      <td className="px-3 py-1.5 text-soil-600">{n.unit}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </details>
          ))}
        </div>
      ))}

      {records.length > limit && (
        <p className="text-xs text-soil-600">
          Đang hiện {limit} trên {records.length} quan sát. Vết đầy đủ được lưu trong báo cáo.
        </p>
      )}

      <p className="text-xs text-soil-600">
        <Badge tone="carbon">Ước tính</Badge> Con số ở đây là ước tính theo phương pháp luận
        đã chọn, không phải tín chỉ đã được phát hành.
      </p>
    </div>
  );
}
