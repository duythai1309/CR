import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Badge, Card, Empty, Table } from "@/components/ui";
import { fmtTonnes, fmtVnd } from "@/lib/format";
import { BATCH_STATUS_LABEL } from "@/lib/labels";
import { NewBatchForm } from "./form";

export const metadata: Metadata = { title: "Lô tín chỉ" };

const TONE = {
  draft: "soil",
  submitted: "soil",
  verified: "carbon",
  listed: "leaf",
  sold: "leaf",
  retired: "red",
} as const;

export default async function BatchesPage() {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const [{ data: batches }, { data: seasons }] = await Promise.all([
    supabase
      .from("credit_batches")
      .select("id, code, name, status, gross_co2e_t, issuable_co2e_t, sold_co2e_t, price_per_t_vnd, seasons ( name )")
      .eq("cooperative_id", profile.cooperative_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("seasons")
      .select("id, name")
      .eq("cooperative_id", profile.cooperative_id)
      .order("start_date", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader
        title="Lô tín chỉ"
        description="Gom kết quả MRV của cả vụ thành một lô đủ quy mô để làm việc với đơn vị kiểm định và doanh nghiệp mua."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title={`Các lô (${batches?.length ?? 0})`}>
          {batches?.length ? (
            <Table head={["Mã lô", "Tên / vụ", "Trạng thái", "Tổng gộp", "Phát hành được", "Đã bán", "Giá"]}>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-mono text-xs">{b.code}</td>
                  <td className="px-3 py-2">
                    <Link href={`/htx/lo-tin-chi/${b.id}`} className="font-medium text-leaf-700 hover:underline">
                      {b.name}
                    </Link>
                    <div className="text-xs text-soil-600">{b.seasons?.name}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={TONE[b.status]}>{BATCH_STATUS_LABEL[b.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmtTonnes(b.gross_co2e_t)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtTonnes(b.issuable_co2e_t)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtTonnes(b.sold_co2e_t)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {b.price_per_t_vnd ? `${fmtVnd(b.price_per_t_vnd)}/t` : "—"}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title="Chưa có lô nào"
              hint="Tạo lô cho một vụ đã tính xong kết quả MRV, rồi bấm gộp để hệ thống tổng hợp tất cả các thửa."
            />
          )}
        </Card>

        <NewBatchForm seasons={seasons ?? []} />
      </div>
    </>
  );
}
