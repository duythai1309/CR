"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";

export interface SaveFieldResult {
  ok: boolean;
  message?: string;
  areaHa?: number;
  overlaps?: Array<{ label: string; overlap_ha: number; same_cooperative: boolean }>;
}

export async function saveField(formData: FormData): Promise<SaveFieldResult> {
  await requireCoopProfile();
  const supabase = await createClient();

  const farmerId = String(formData.get("farmer_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const geojsonRaw = String(formData.get("geojson") ?? "");
  const declared = String(formData.get("declared_area_ha") ?? "").trim();

  if (!farmerId) return { ok: false, message: "Chưa chọn nông hộ." };
  if (!name) return { ok: false, message: "Chưa đặt tên thửa." };
  if (!geojsonRaw) return { ok: false, message: "Chưa vẽ ranh thửa trên bản đồ." };

  const { data, error } = await supabase.rpc("save_field", {
    p_farmer_id: farmerId,
    p_name: name,
    p_geojson: JSON.parse(geojsonRaw),
    p_declared_area_ha: declared ? Number(declared) : undefined,
    p_soil_type: String(formData.get("soil_type") ?? "").trim() || undefined,
  });

  if (error) return { ok: false, message: error.message };

  const result = data as unknown as {
    area_ha: number;
    overlaps: SaveFieldResult["overlaps"];
  };

  revalidatePath("/htx/thua-ruong");
  return { ok: true, areaHa: Number(result.area_ha), overlaps: result.overlaps ?? [] };
}
