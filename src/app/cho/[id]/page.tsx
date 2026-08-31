import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Alert, Badge, Card, Stat } from "@/components/ui";
import { fmtDate, fmtTonnes, fmtVnd } from "@/lib/format";
import { CURRENT_METHODOLOGY } from "@/lib/mrv/factors";
import { OrderForm } from "./order-form";

export default async function MarketBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("credit_batches")
    .select("*, seasons ( name, start_date, end_date ), cooperatives ( name, province, district, contact_name, contact_phone )")
    .eq("id", id)
    .single();

  if (!batch) notFound();

  const { data: pending } = await supabase
    .from("orders")
    .select("quantity_co2e_t, status")
    .eq("batch_id", id)
    .in("status", ["pending", "awaiting_payment"]);

  const reserved = (pending ?? []).reduce((s, o) => s + Number(o.quantity_co2e_t), 0);
  const available = Number(batch.issuable_co2e_t) - Number(batch.sold_co2e_t) - reserved;

  return (
    <>
      <PageHeader
        title={batch.name}
        description={`Mã lô ${batch.code} · ${batch.cooperatives?.name}, ${batch.cooperatives?.province}`}
        action={<Badge tone={available > 0 ? "leaf" : "soil"}>{available > 0 ? "Đang chào bán" : "Hết hàng"}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Phát hành" value={fmtTonnes(batch.issuable_co2e_t)} />
        <Stat label="Đã bán" value={fmtTonnes(batch.sold_co2e_t)} tone="soil" />
        <Stat label="Còn bán được" value={fmtTonnes(Math.max(available, 0))} tone="carbon" />
        <Stat label="Đơn giá" value={`${fmtVnd(batch.price_per_t_vnd)}`} hint="mỗi tCO₂e" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Hồ sơ lô">
            {batch.description && <p className="text-soil-700">{batch.description}</p>}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Detail label="Hợp tác xã" value={batch.cooperatives?.name} />
              <Detail
                label="Địa bàn"
                value={[batch.cooperatives?.district, batch.cooperatives?.province].filter(Boolean).join(", ")}
              />
              <Detail label="Mùa vụ" value={batch.seasons?.name} />
              <Detail
                label="Thời gian vụ"
                value={`${fmtDate(batch.seasons?.start_date)} – ${fmtDate(batch.seasons?.end_date)}`}
              />
              <Detail label="Tổng gộp trước đệm" value={fmtTonnes(batch.gross_co2e_t)} />
              <Detail label="Đệm rủi ro giữ lại" value={`${batch.buffer_pct}%`} />
              <Detail label="Phương pháp luận" value={CURRENT_METHODOLOGY} />
              <Detail label="Ngày lên sàn" value={fmtDate(batch.listed_at)} />
            </dl>
          </Card>

          <Card title="Cơ sở tính toán">
            <p className="text-sm text-soil-600">
              Lượng giảm phát thải được tính theo IPCC 2019 Refinement cho canh tác lúa nước,
              dựa trên nhật ký canh tác từng thửa: lịch tháo nước, lượng phân bón và cách xử
              lý rơm rạ. Chế độ nước không do người dùng tự khai mà suy ra từ số lần tháo
              nước đã ghi trong vụ.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-soil-900 px-4 py-3 text-sm text-leaf-200">
{`CH₄ = EFc × SFw × SFp × SFo × t × A`}
            </pre>
            <p className="mt-3 text-sm text-soil-600">
              Mỗi thửa trong lô có bản ghi tính toán riêng, lưu đầy đủ tham số đầu vào và bộ
              hệ số đã dùng, phục vụ đơn vị kiểm định độc lập đối chiếu.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          {profile.role === "buyer" ? (
            <OrderForm
              batchId={id}
              available={Math.max(available, 0)}
              unitPrice={Number(batch.price_per_t_vnd ?? 0)}
            />
          ) : (
            <Card title="Đặt mua">
              <Alert>
                Bạn đang đăng nhập bằng tài khoản hợp tác xã. Chỉ tài khoản doanh nghiệp mới
                đặt mua tín chỉ được.
              </Alert>
            </Card>
          )}

          <Card title="Liên hệ hợp tác xã">
            <dl className="space-y-2 text-sm">
              <Detail label="Người liên hệ" value={batch.cooperatives?.contact_name} />
              <Detail label="Điện thoại" value={batch.cooperatives?.contact_phone} />
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-soil-600">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-soil-900">{value || "—"}</dd>
    </div>
  );
}
