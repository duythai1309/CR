"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { computeAndSave } from "@/lib/mrv/collect";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

const refresh = (id: string) => revalidatePath(`/htx/thua-vu/${id}`);

export async function saveDates(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireCoopProfile();
  const supabase = await createClient();
  const id = String(formData.get("field_season_id") ?? "");

  const transplant = String(formData.get("transplant_date") ?? "") || null;
  const harvest = String(formData.get("harvest_date") ?? "") || null;
  if (transplant && harvest && new Date(harvest) <= new Date(transplant)) {
    return "Ngày thu hoạch phải sau ngày cấy.";
  }

  const { error } = await supabase
    .from("field_seasons")
    .update({
      transplant_date: transplant,
      harvest_date: harvest,
      preseason_water: String(formData.get("preseason_water")) as Enums["preseason_water"],
      baseline_water_regime: String(formData.get("baseline_water_regime")) as Enums["water_regime"],
    })
    .eq("id", id);

  if (error) return error.message;
  refresh(id);
  return null;
}

export async function addWaterEvent(_prev: string | null, formData: FormData): Promise<string | null> {
  const profile = await requireCoopProfile();
  const supabase = await createClient();
  const id = String(formData.get("field_season_id") ?? "");

  const { error } = await supabase.from("water_events").insert({
    cooperative_id: profile.cooperative_id,
    field_season_id: id,
    event_date: String(formData.get("event_date")),
    event_type: String(formData.get("event_type")) as Enums["water_event_type"],
    water_depth_cm: formData.get("water_depth_cm") ? Number(formData.get("water_depth_cm")) : null,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error) return error.message;
  refresh(id);
  return null;
}

export async function addFertilizer(_prev: string | null, formData: FormData): Promise<string | null> {
  const profile = await requireCoopProfile();
  const supabase = await createClient();
  const id = String(formData.get("field_season_id") ?? "");
  const isOrganic = formData.get("is_organic") === "on";

  const { error } = await supabase.from("fertilizer_applications").insert({
    cooperative_id: profile.cooperative_id,
    field_season_id: id,
    applied_date: String(formData.get("applied_date")),
    product_name: String(formData.get("product_name") ?? "").trim() || null,
    is_organic: isOrganic,
    organic_type: isOrganic
      ? (String(formData.get("organic_type")) as Enums["organic_amendment"])
      : null,
    amount_kg: Number(formData.get("amount_kg")),
    n_content_pct: Number(formData.get("n_content_pct") ?? 0),
  });

  if (error) return error.message;
  refresh(id);
  return null;
}

export async function saveStraw(_prev: string | null, formData: FormData): Promise<string | null> {
  const profile = await requireCoopProfile();
  const supabase = await createClient();
  const id = String(formData.get("field_season_id") ?? "");

  const { error } = await supabase.from("straw_management").upsert(
    {
      cooperative_id: profile.cooperative_id,
      field_season_id: id,
      method: String(formData.get("method")) as Enums["straw_method"],
      baseline_method: String(formData.get("baseline_method")) as Enums["straw_method"],
      amount_t_per_ha: formData.get("amount_t_per_ha")
        ? Number(formData.get("amount_t_per_ha"))
        : null,
      days_before_cultivation: formData.get("days_before_cultivation")
        ? Number(formData.get("days_before_cultivation"))
        : null,
    },
    { onConflict: "field_season_id" },
  );

  if (error) return error.message;
  refresh(id);
  return null;
}

export async function deleteLogRow(
  table: "water_events" | "fertilizer_applications",
  rowId: string,
  fieldSeasonId: string,
): Promise<string | null> {
  await requireCoopProfile();
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", rowId);
  if (error) return error.message;
  refresh(fieldSeasonId);
  return null;
}

export interface ComputeResult {
  ok: boolean;
  reductionCo2eT?: number;
  missing?: string[];
  message?: string;
}

export async function runCalculation(fieldSeasonId: string): Promise<ComputeResult> {
  const profile = await requireCoopProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const result = await computeAndSave(
      supabase,
      fieldSeasonId,
      profile.cooperative_id,
      user!.id,
    );
    refresh(fieldSeasonId);
    return result.ok
      ? { ok: true, reductionCo2eT: result.reductionCo2eT }
      : { ok: false, missing: result.missing };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Lỗi không xác định" };
  }
}

export async function unlockFieldSeason(fieldSeasonId: string): Promise<string | null> {
  await requireCoopProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlock_field_season", {
    p_field_season_id: fieldSeasonId,
  });
  if (error) return error.message;
  refresh(fieldSeasonId);
  return null;
}
