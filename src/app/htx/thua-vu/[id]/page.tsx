import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { collectMrvInput } from "@/lib/mrv/collect";
import { PageHeader } from "@/components/app-nav";
import { Badge, Card, Stat } from "@/components/ui";
import { fmtHa, fmtNum, fmtTonnes } from "@/lib/format";
import { DatesForm, FertilizerPanel, StrawForm, WaterPanel } from "./forms";
import { CalculationPanel } from "./calculation";

export default async function FieldSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCoopProfile();
  const supabase = await createClient();

  const { data: fs } = await supabase
    .from("field_seasons")
    .select(
      `id, transplant_date, harvest_date, preseason_water, baseline_water_regime, is_locked,
       seasons ( id, name ),
       fields ( name, area_ha, farmers ( full_name ) ),
       water_events ( id, event_date, event_type, water_depth_cm, note ),
       fertilizer_applications ( id, applied_date, product_name, is_organic, organic_type, amount_kg, n_content_pct ),
       straw_management ( method, baseline_method, amount_t_per_ha, days_before_cultivation )`,
    )
    .eq("id", id)
    .single();

  if (!fs) notFound();

  const { data: calc } = await supabase
    .from("emission_calculations")
    .select("*")
    .eq("field_season_id", id)
    .eq("is_current", true)
    .maybeSingle();

  const collected = await collectMrvInput(supabase, id);

  return (
    <>
      <PageHeader
        title={`${fs.fields?.name} — ${fs.fields?.farmers?.full_name}`}
        description={
          <>
            Nhật ký canh tác vụ{" "}
            <Link href={`/htx/mua-vu/${fs.seasons?.id}`} className="text-leaf-700 hover:underline">
              {fs.seasons?.name}
            </Link>
          </>
        }
        action={fs.is_locked ? <Badge tone="carbon">Đã khoá — nằm trong lô tín chỉ</Badge> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Diện tích" value={fmtHa(fs.fields?.area_ha)} tone="soil" />
        <Stat
          label="Số ngày canh tác"
          value={collected.summary.cultivationDays ?? "—"}
          hint="Từ ngày cấy đến ngày thu hoạch"
          tone="soil"
        />
        <Stat
          label="Số lần tháo nước"
          value={fmtNum(collected.summary.drainageCount)}
          hint="Quyết định hệ số SFw"
          tone="carbon"
        />
        <Stat
          label="Giảm phát thải"
          value={calc ? fmtTonnes(calc.reduction_co2e_t) : "Chưa tính"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <DatesForm fieldSeason={fs} disabled={fs.is_locked} />
          <WaterPanel
            fieldSeasonId={id}
            events={fs.water_events ?? []}
            disabled={fs.is_locked}
          />
          <FertilizerPanel
            fieldSeasonId={id}
            rows={fs.fertilizer_applications ?? []}
            disabled={fs.is_locked}
          />
          <StrawForm
            fieldSeasonId={id}
            straw={fs.straw_management}
            disabled={fs.is_locked}
          />
        </div>

        <CalculationPanel
          fieldSeasonId={id}
          missing={collected.missing}
          calculation={calc}
          locked={fs.is_locked}
        />
      </div>
    </>
  );
}
