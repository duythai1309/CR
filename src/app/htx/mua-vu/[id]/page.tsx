import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Badge, Card, Empty, Stat, Table } from "@/components/ui";
import { fmtDate, fmtHa, fmtTonnes } from "@/lib/format";
import { SEASON_TYPE_LABEL } from "@/lib/labels";
import { EnrollForm } from "./enroll";

export default async function SeasonDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("id, name, season_type, start_date, end_date")
    .eq("id", id)
    .single();
  if (!season) notFound();

  const [{ data: enrolled }, { data: allFields }] = await Promise.all([
    supabase
      .from("field_seasons")
      .select(
        `id, transplant_date, harvest_date, is_locked,
         fields ( id, name, area_ha, farmers ( full_name ) ),
         water_events ( id, event_type ),
         emission_calculations ( reduction_co2e_t, is_current )`,
      )
      .eq("season_id", id)
      .order("created_at"),
    supabase
      .from("fields")
      .select("id, name, area_ha, farmers ( full_name )")
      .eq("cooperative_id", profile.cooperative_id)
      .order("name"),
  ]);

  const enrolledIds = new Set((enrolled ?? []).map((e) => e.fields?.id));
  const available = (allFields ?? []).filter((f) => !enrolledIds.has(f.id));

  const totalArea = (enrolled ?? []).reduce((s, e) => s + Number(e.fields?.area_ha ?? 0), 0);
  const totalReduction = (enrolled ?? []).reduce((s, e) => {
    const current = (e.emission_calculations ?? []).find((c) => c.is_current);
    return s + Number(current?.reduction_co2e_t ?? 0);
  }, 0);
  const computed = (enrolled ?? []).filter((e) =>
    (e.emission_calculations ?? []).some((c) => c.is_current),
  ).length;

  return (
    <>
      <PageHeader
        title={season.name}
        description={
          <>
            {season.season_type ? `${SEASON_TYPE_LABEL[season.season_type]} · ` : ""}
            Từ {fmtDate(season.start_date)}
            {season.end_date ? ` đến ${fmtDate(season.end_date)}` : ""}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Thửa đăng ký" value={enrolled?.length ?? 0} tone="soil" />
        <Stat label="Diện tích" value={fmtHa(totalArea)} tone="soil" />
        <Stat
          label="Đã tính xong"
          value={`${computed}/${enrolled?.length ?? 0}`}
          hint="Thửa có kết quả MRV hiệu lực"
          tone="carbon"
        />
        <Stat label="Giảm phát thải" value={fmtTonnes(totalReduction)} />
      </div>

      <div className="mt-6 space-y-6">
        <Card title="Các thửa trong vụ này">
          {enrolled?.length ? (
            <Table head={["Thửa", "Nông hộ", "Diện tích", "Ngày cấy", "Ngày thu hoạch", "Lần tháo nước", "Kết quả", ""]}>
              {enrolled.map((e) => {
                const current = (e.emission_calculations ?? []).find((c) => c.is_current);
                const drainage = (e.water_events ?? []).filter((w) => w.event_type === "drainage").length;
                return (
                  <tr key={e.id}>
                    <td className="px-3 py-2 font-medium text-soil-900">{e.fields?.name}</td>
                    <td className="px-3 py-2">{e.fields?.farmers?.full_name}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtHa(e.fields?.area_ha)}</td>
                    <td className="px-3 py-2">{fmtDate(e.transplant_date)}</td>
                    <td className="px-3 py-2">{fmtDate(e.harvest_date)}</td>
                    <td className="px-3 py-2 tabular-nums">{drainage}</td>
                    <td className="px-3 py-2">
                      {current ? (
                        <span className="font-medium text-leaf-700">
                          {fmtTonnes(current.reduction_co2e_t)}
                        </span>
                      ) : (
                        <Badge tone="soil">Chưa tính</Badge>
                      )}
                      {e.is_locked && (
                        <span className="ml-2">
                          <Badge tone="carbon">Đã khoá</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/htx/thua-vu/${e.id}`} className="text-sm text-leaf-700 hover:underline">
                        Nhật ký →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty
              title="Chưa đăng ký thửa nào cho vụ này"
              hint="Chọn các thửa ở khung bên dưới để bắt đầu ghi nhật ký canh tác."
            />
          )}
        </Card>

        <EnrollForm seasonId={id} fields={available} />
      </div>
    </>
  );
}
