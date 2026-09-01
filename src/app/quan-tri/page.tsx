import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AppNav, PageHeader } from "@/components/app-nav";
import { ChatWidget } from "@/components/chat/chat-widget";
import { Badge, Card, Empty, Stat, Table } from "@/components/ui";
import { fmtTonnes, fmtVnd } from "@/lib/format";
import { BATCH_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Quản trị nền tảng" };

export default async function AdminPage() {
  const profile = await requireProfile();
  if (profile.role !== "platform_admin") redirect("/");

  const supabase = await createClient();
  const [{ data: coops }, { data: batches }, { data: shares }] = await Promise.all([
    supabase.from("cooperatives").select("id, name, code, province, farmers ( id ), fields ( area_ha )"),
    supabase
      .from("credit_batches")
      .select("id, code, name, status, issuable_co2e_t, sold_co2e_t, cooperatives ( name )")
      .order("created_at", { ascending: false }),
    supabase.from("revenue_shares").select("platform_amount_vnd, farmer_amount_vnd"),
  ]);

  const platformRevenue = (shares ?? []).reduce((s, r) => s + Number(r.platform_amount_vnd), 0);
  const farmerRevenue = (shares ?? []).reduce((s, r) => s + Number(r.farmer_amount_vnd), 0);
  const totalSold = (batches ?? []).reduce((s, b) => s + Number(b.sold_co2e_t), 0);

  return (
    <div className="min-h-dvh bg-soil-50">
      <AppNav profile={profile} />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <PageHeader
          title="Quản trị nền tảng"
          description="Toàn cảnh các hợp tác xã, lô tín chỉ và dòng doanh thu."
        />

        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Hợp tác xã" value={coops?.length ?? 0} tone="soil" />
          <Stat label="Tín chỉ đã bán" value={fmtTonnes(totalSold)} tone="carbon" />
          <Stat label="Phí nền tảng" value={fmtVnd(platformRevenue)} />
          <Stat label="Doanh thu về nông hộ" value={fmtVnd(farmerRevenue)} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Hợp tác xã">
            {coops?.length ? (
              <Table head={["Mã", "Tên", "Tỉnh", "Nông hộ", "Diện tích (ha)"]}>
                {coops.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-3 py-2 font-medium text-soil-900">{c.name}</td>
                    <td className="px-3 py-2">{c.province}</td>
                    <td className="px-3 py-2 tabular-nums">{c.farmers?.length ?? 0}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {(c.fields ?? []).reduce((s, f) => s + Number(f.area_ha ?? 0), 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty title="Chưa có hợp tác xã nào" />
            )}
          </Card>

          <Card title="Lô tín chỉ toàn nền tảng">
            {batches?.length ? (
              <Table head={["Mã lô", "Hợp tác xã", "Trạng thái", "Phát hành", "Đã bán"]}>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/cho/${b.id}`} className="text-leaf-700 hover:underline">
                        {b.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{b.cooperatives?.name}</td>
                    <td className="px-3 py-2">
                      <Badge tone="soil">{BATCH_STATUS_LABEL[b.status]}</Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{fmtTonnes(b.issuable_co2e_t)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtTonnes(b.sold_co2e_t)}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty title="Chưa có lô nào" />
            )}
          </Card>
        </div>
      </main>
      <ChatWidget audience="admin" />
    </div>
  );
}
