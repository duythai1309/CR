import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Badge, Card, Empty, LinkButton } from "@/components/ui";
import { fmtTonnes, fmtVnd } from "@/lib/format";

export const metadata: Metadata = { title: "Chợ tín chỉ" };

export default async function MarketPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: batches } = await supabase
    .from("credit_batches")
    .select("id, code, name, description, status, issuable_co2e_t, sold_co2e_t, price_per_t_vnd, seasons ( name ), cooperatives ( name, province )")
    .in("status", ["listed", "sold"])
    .order("listed_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Chợ tín chỉ carbon nông nghiệp"
        description="Các lô tín chỉ do hợp tác xã chào bán, kèm hồ sơ MRV truy xuất được tới từng thửa ruộng."
        action={
          profile.role !== "buyer" ? (
            <Badge tone="carbon">Chỉ tài khoản doanh nghiệp mới đặt mua được</Badge>
          ) : undefined
        }
      />

      {batches?.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => {
            const remaining = Number(b.issuable_co2e_t) - Number(b.sold_co2e_t);
            return (
              <div key={b.id} className="flex flex-col rounded-xl border border-soil-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-soil-900">{b.name}</h2>
                    <p className="mt-0.5 text-sm text-soil-600">
                      {b.cooperatives?.name} · {b.cooperatives?.province}
                    </p>
                  </div>
                  <Badge tone={remaining > 0 ? "leaf" : "soil"}>
                    {remaining > 0 ? "Còn hàng" : "Đã bán hết"}
                  </Badge>
                </div>

                {b.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-soil-600">{b.description}</p>
                )}

                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-soil-600">Mùa vụ</dt>
                    <dd className="text-soil-900">{b.seasons?.name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-soil-600">Còn lại</dt>
                    <dd className="tabular-nums font-medium text-soil-900">{fmtTonnes(Math.max(remaining, 0))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-soil-600">Đơn giá</dt>
                    <dd className="tabular-nums font-medium text-leaf-700">
                      {fmtVnd(b.price_per_t_vnd)}/tCO₂e
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 pt-1">
                  <LinkButton href={`/cho/${b.id}`} className="w-full">
                    Xem hồ sơ lô
                  </LinkButton>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty
            title="Chưa có lô tín chỉ nào được chào bán"
            hint={
              <>
                Hợp tác xã cần hoàn tất nhật ký canh tác và gộp lô trước.{" "}
                <Link href="/" className="text-leaf-700 hover:underline">
                  Tìm hiểu quy trình
                </Link>
              </>
            }
          />
        </Card>
      )}
    </>
  );
}
