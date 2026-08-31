import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Card, Empty, LinkButton, Stat, Table } from "@/components/ui";
import { fmtHa, fmtNum, fmtTonnes } from "@/lib/format";
import { BATCH_STATUS_LABEL } from "@/lib/labels";

export default async function CoopDashboard() {
  const profile = await requireCoopProfile();
  const supabase = await createClient();
  const coopId = profile.cooperative_id;

  const [farmers, fields, seasons, calcs, batches] = await Promise.all([
    supabase.from("farmers").select("id", { count: "exact", head: true }).eq("cooperative_id", coopId),
    supabase.from("fields").select("area_ha").eq("cooperative_id", coopId),
    supabase.from("seasons").select("id, name, start_date").eq("cooperative_id", coopId)
      .order("start_date", { ascending: false }).limit(5),
    supabase.from("emission_calculations").select("reduction_co2e_t").eq("cooperative_id", coopId).eq("is_current", true),
    supabase.from("credit_batches").select("id, code, name, status, gross_co2e_t, issuable_co2e_t")
      .eq("cooperative_id", coopId).order("created_at", { ascending: false }).limit(5),
  ]);

  const totalArea = (fields.data ?? []).reduce((s, f) => s + Number(f.area_ha ?? 0), 0);
  const totalReduction = (calcs.data ?? []).reduce((s, c) => s + Number(c.reduction_co2e_t), 0);

  return (
    <>
      <PageHeader
        title="Tổng quan hợp tác xã"
        description="Bức tranh chung về vùng canh tác và lượng giảm phát thải đã tính được."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Nông hộ" value={fmtNum(farmers.count ?? 0)} tone="soil" />
        <Stat
          label="Diện tích số hoá"
          value={fmtHa(totalArea)}
          hint={`${fields.data?.length ?? 0} thửa đã vẽ ranh`}
          tone="soil"
        />
        <Stat
          label="Giảm phát thải đã tính"
          value={fmtTonnes(totalReduction)}
          hint="Tổng các thửa-vụ có kết quả hiệu lực"
        />
        <Stat
          label="Lô tín chỉ"
          value={fmtNum(batches.data?.length ?? 0)}
          hint="Năm bản ghi gần nhất"
          tone="carbon"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card
          title="Mùa vụ gần đây"
          action={<LinkButton href="/htx/mua-vu" variant="secondary">Xem tất cả</LinkButton>}
        >
          {seasons.data?.length ? (
            <ul className="divide-y divide-soil-100">
              {seasons.data.map((s) => (
                <li key={s.id} className="py-2">
                  <Link href={`/htx/mua-vu/${s.id}`} className="font-medium text-leaf-700 hover:underline">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="Chưa có mùa vụ nào"
              hint="Tạo mùa vụ rồi đăng ký các thửa ruộng tham gia để bắt đầu ghi nhật ký."
            />
          )}
        </Card>

        <Card
          title="Lô tín chỉ"
          action={<LinkButton href="/htx/lo-tin-chi" variant="secondary">Xem tất cả</LinkButton>}
        >
          {batches.data?.length ? (
            <Table head={["Mã lô", "Tên", "Trạng thái", "Phát hành được"]}>
              {batches.data.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-mono text-xs">{b.code}</td>
                  <td className="px-3 py-2">
                    <Link href={`/htx/lo-tin-chi/${b.id}`} className="text-leaf-700 hover:underline">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{BATCH_STATUS_LABEL[b.status]}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtTonnes(b.issuable_co2e_t)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title="Chưa gộp lô nào"
              hint="Sau khi các thửa trong một vụ đã có kết quả tính, bạn gộp chúng thành lô để chào bán."
            />
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink
          href="/htx/nong-ho"
          title="1. Thêm nông hộ"
          body="Ghi danh các hộ tham gia. Nông hộ không cần tài khoản riêng."
        />
        <QuickLink
          href="/htx/thua-ruong"
          title="2. Vẽ ranh thửa"
          body="Diện tích tính từ hình học trên bản đồ, không lấy số khai."
        />
        <QuickLink
          href="/htx/mua-vu"
          title="3. Ghi nhật ký vụ"
          body="Ngày cấy, lịch tháo nước, phân bón, cách xử lý rơm rạ."
        />
      </div>
    </>
  );
}

function QuickLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-soil-200 bg-white p-5 transition hover:border-leaf-300 hover:shadow-sm"
    >
      <div className="font-semibold text-soil-900">{title}</div>
      <p className="mt-1 text-sm text-soil-600">{body}</p>
    </Link>
  );
}
