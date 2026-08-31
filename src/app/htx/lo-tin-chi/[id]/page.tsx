import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Badge, Card, Empty, Stat, Table } from "@/components/ui";
import { fmtHa, fmtTonnes, fmtVnd } from "@/lib/format";
import { BATCH_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/labels";
import { BatchControls } from "./controls";

export default async function BatchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCoopProfile();
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("credit_batches")
    .select(
      `*, seasons ( name ),
       batch_items ( id, co2e_t,
         field_seasons ( id, fields ( name, area_ha, farmers ( full_name ) ) ) ),
       orders ( id, code, quantity_co2e_t, total_vnd, status )`,
    )
    .eq("id", id)
    .single();

  if (!batch) notFound();

  const items = batch.batch_items ?? [];
  const totalArea = items.reduce(
    (s, i) => s + Number(i.field_seasons?.fields?.area_ha ?? 0),
    0,
  );
  const farmers = new Set(
    items.map((i) => i.field_seasons?.fields?.farmers?.full_name).filter(Boolean),
  );
  const available =
    Number(batch.issuable_co2e_t) -
    Number(batch.sold_co2e_t) -
    (batch.orders ?? [])
      .filter((o) => o.status === "pending" || o.status === "awaiting_payment")
      .reduce((s, o) => s + Number(o.quantity_co2e_t), 0);

  return (
    <>
      <PageHeader
        title={batch.name}
        description={`Mã lô ${batch.code} · vụ ${batch.seasons?.name ?? "—"}`}
        action={<Badge tone={batch.status === "draft" ? "soil" : "leaf"}>{BATCH_STATUS_LABEL[batch.status]}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Nông hộ tham gia" value={farmers.size} tone="soil" />
        <Stat label="Diện tích" value={fmtHa(totalArea)} tone="soil" />
        <Stat label="Tổng gộp" value={fmtTonnes(batch.gross_co2e_t)} />
        <Stat
          label="Phát hành được"
          value={fmtTonnes(batch.issuable_co2e_t)}
          hint={`Sau đệm rủi ro ${batch.buffer_pct}%`}
          tone="carbon"
        />
        <Stat label="Còn bán được" value={fmtTonnes(Math.max(available, 0))} tone="carbon" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card
            title="Báo cáo phát thải giảm thiểu tập trung"
            description={
              items.length > 0
                ? `${items.length} thửa gộp từ ${farmers.size} nông hộ.`
                : "Chưa gộp thửa nào vào lô này."
            }
          >
            {items.length > 0 ? (
              <Table head={["Nông hộ", "Thửa", "Diện tích", "Giảm phát thải", "Tỷ trọng"]}>
                {[...items]
                  .sort((a, b) => Number(b.co2e_t) - Number(a.co2e_t))
                  .map((i) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2">{i.field_seasons?.fields?.farmers?.full_name}</td>
                      <td className="px-3 py-2 font-medium text-soil-900">
                        {i.field_seasons?.fields?.name}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {fmtHa(i.field_seasons?.fields?.area_ha)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{fmtTonnes(i.co2e_t)}</td>
                      <td className="px-3 py-2 tabular-nums text-soil-600">
                        {Number(batch.gross_co2e_t) > 0
                          ? `${((Number(i.co2e_t) / Number(batch.gross_co2e_t)) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </Table>
            ) : (
              <Empty
                title="Lô đang trống"
                hint="Bấm “Gộp kết quả của vụ” để hệ thống thu tất cả thửa đã tính xong trong vụ này."
              />
            )}
          </Card>

          <Card title="Đơn hàng từ doanh nghiệp">
            {batch.orders?.length ? (
              <Table head={["Mã đơn", "Khối lượng", "Giá trị", "Trạng thái"]}>
                {batch.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2 font-mono text-xs">{o.code}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtTonnes(o.quantity_co2e_t)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtVnd(o.total_vnd)}</td>
                    <td className="px-3 py-2">{ORDER_STATUS_LABEL[o.status]}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty title="Chưa có đơn hàng nào" />
            )}
          </Card>
        </div>

        <BatchControls
          batchId={id}
          status={batch.status}
          itemCount={items.length}
          currentPrice={batch.price_per_t_vnd}
          description={batch.description}
        />
      </div>
    </>
  );
}
