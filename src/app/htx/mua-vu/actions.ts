"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

export async function createSeason(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  if (!name) return "Chưa đặt tên mùa vụ.";
  if (!startDate) return "Chưa chọn ngày bắt đầu vụ.";

  const seasonType = String(formData.get("season_type") ?? "") as Enums["season_type"];
  if (!seasonType) return "Chưa chọn loại vụ.";

  const { error } = await supabase.from("seasons").insert({
    cooperative_id: profile.cooperative_id,
    name,
    season_type: seasonType,
    start_date: startDate,
    end_date: String(formData.get("end_date") ?? "") || null,
  });
  if (error) return error.message;

  revalidatePath("/htx/mua-vu");
  return null;
}

/** Đăng ký các thửa tham gia một vụ. Thửa đã đăng ký rồi thì bỏ qua, không báo lỗi. */
export async function enrollFields(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const seasonId = String(formData.get("season_id") ?? "");
  const fieldIds = formData.getAll("field_ids").map(String).filter(Boolean);
  if (!seasonId) return "Thiếu mùa vụ.";
  if (fieldIds.length === 0) return "Chưa chọn thửa nào.";

  const { error } = await supabase.from("field_seasons").upsert(
    fieldIds.map((fieldId) => ({
      cooperative_id: profile.cooperative_id,
      season_id: seasonId,
      field_id: fieldId,
      preseason_water: String(formData.get("preseason_water") ?? "non_flooded_short") as Enums["preseason_water"],
      baseline_water_regime: String(
        formData.get("baseline_water_regime") ?? "continuously_flooded",
      ) as Enums["water_regime"],
    })),
    { onConflict: "season_id,field_id", ignoreDuplicates: true },
  );
  if (error) return error.message;

  revalidatePath(`/htx/mua-vu/${seasonId}`);
  return null;
}
