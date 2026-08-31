import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Badge, Card, Empty } from "@/components/ui";
import { fmtDate, fmtTonnes, fmtVnd } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";
import { PaymentPanel } from "./payment-panel";

export const metadata: Metadata = { title: "Đơn hàng" };

const TONE = {
  pending: "soil",
  awaiting_payment: "carbon",
  paid: "leaf",
  cancelled: "red",
  fulfilled: "leaf",
} as const;

export default async function OrdersPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      `id, code, quantity_co2e_t, unit_price_vnd, total_vnd, status, buyer_note, created_at,
       credit_batches ( id, name, code, cooperatives ( name, province ) ),
       payments ( id, status, provider, provider_ref, paid_at )`,
    )
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Đơn hàng"
        description="Thanh toán trong hệ thống đang chạy ở chế độ thử — không phát sinh giao dịch tiền thật."
      />

      {orders?.length ? (
        <div className="space-y-5">
          {orders.map((o) => {
            const payment = o.payments?.[0];
            return (
              <Card
                key={o.id}
                title={
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm">{o.code}</span>
                    <Badge tone={TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </span>
                }
                description={`Đặt ngày ${fmtDate(o.created_at)}`}
              >
                <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
                  <div>
                    <Link
                      href={`/cho/${o.credit_batches?.id}`}
                      className="font-medium text-leaf-700 hover:underline"
                    >
                      {o.credit_batches?.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-soil-600">
                      {o.credit_batches?.cooperatives?.name} ·{" "}
                      {o.credit_batches?.cooperatives?.province}
                    </p>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                      <div>
                        <dt className="text-soil-600">Khối lượng</dt>
                        <dd className="font-medium tabular-nums">{fmtTonnes(o.quantity_co2e_t)}</dd>
                      </div>
                      <div>
                        <dt className="text-soil-600">Đơn giá</dt>
                        <dd className="font-medium tabular-nums">{fmtVnd(o.unit_price_vnd)}</dd>
                      </div>
                      <div>
                        <dt className="text-soil-600">Thành tiền</dt>
                        <dd className="font-semibold tabular-nums text-soil-900">
                          {fmtVnd(o.total_vnd)}
                        </dd>
                      </div>
                    </dl>

                    {o.buyer_note && (
                      <p className="mt-4 rounded-lg bg-soil-100 px-3 py-2 text-sm text-soil-700">
                        {o.buyer_note}
                      </p>
                    )}

                    {payment && (
                      <p className="mt-3 text-xs text-soil-600">
                        Thanh toán {payment.provider}: {PAYMENT_STATUS_LABEL[payment.status]}
                        {payment.provider_ref && ` · mã ${payment.provider_ref}`}
                        {payment.paid_at && ` · ${fmtDate(payment.paid_at)}`}
                      </p>
                    )}
                  </div>

                  <PaymentPanel orderId={o.id} status={o.status} amount={Number(o.total_vnd)} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty
            title="Chưa có đơn hàng nào"
            hint={
              <>
                Xem các lô đang chào bán ở{" "}
                <Link href="/cho" className="text-leaf-700 hover:underline">
                  chợ tín chỉ
                </Link>
                .
              </>
            }
          />
        </Card>
      )}
    </>
  );
}
