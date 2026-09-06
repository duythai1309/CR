import { Badge, Card } from "@/components/ui";

export function MethodologyIdentity({
  standard,
  methodology,
  compact = false,
}: {
  standard?: { code: string; name: string } | null;
  methodology?: { code: string; version: string; project_type: string; schema_hash: string; is_sample: boolean; disclaimer?: string } | null;
  compact?: boolean;
}) {
  if (!standard && !methodology) return null;
  const content = (
    <dl className={`grid gap-x-5 gap-y-1 text-xs ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
      <div><dt className="text-soil-500">Standard</dt><dd className="font-medium text-soil-900">{standard ? `${standard.code} — ${standard.name}` : "Chưa chọn"}</dd></div>
      <div><dt className="text-soil-500">Methodology</dt><dd className="font-medium text-soil-900">{methodology ? methodology.code : "Chưa chọn"}</dd></div>
      <div><dt className="text-soil-500">Version</dt><dd className="font-mono text-soil-900">{methodology?.version ?? "—"}</dd></div>
      <div><dt className="text-soil-500">schema_hash</dt><dd className="break-all font-mono text-soil-900">{methodology?.schema_hash ?? "—"}</dd></div>
    </dl>
  );
  return compact ? <div className="rounded-lg border border-soil-200 bg-soil-50 px-4 py-3">{content}</div> : <Card title="Methodology identity" description="Định danh dùng để trích dẫn trong PDD, monitoring plan và trao đổi với VVB.">{content}{methodology?.is_sample && <p className="mt-3 text-xs text-carbon-700"><Badge tone="carbon">MẪU</Badge> Chưa thẩm định chuyên môn; chỉ dùng để thử luồng. <span title={methodology.disclaimer}>Xem disclaimer đầy đủ trong bản ghi methodology.</span></p>}</Card>;
}
