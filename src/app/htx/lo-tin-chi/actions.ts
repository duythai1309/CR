"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";

export async function createBatch(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const seasonId = String(formData.get("season_id") ?? "");
  if (!name) return "Chưa đặt tên lô.";
  if (!seasonId) return "Chưa chọn mùa vụ.";

  const code = `LO-${new Date().toISOString().slice(2, 7).replace("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

  const { error } = await supabase.from("credit_batches").insert({
    cooperative_id: profile.cooperative_id,
    season_id: seasonId,
    code,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    buffer_pct: Number(formData.get("buffer_pct") ?? 15),
  });

  if (error) return error.message;
  revalidatePath("/htx/lo-tin-chi");
  return null;
}

export async function buildBatch(batchId: string): Promise<{ ok: boolean; message: string }> {
  await requireCoopProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("build_credit_batch", { p_batch_id: batchId });
  if (error) return { ok: false, message: error.message };

  const result = data as unknown as { items: number; gross_co2e_t: number };
  revalidatePath(`/htx/lo-tin-chi/${batchId}`);
  return {
    ok: true,
    message: `Đã gộp ${result.items} thửa, tổng ${Number(result.gross_co2e_t).toFixed(4)} tCO₂e.`,
  };
}

export async function listBatch(
  batchId: string,
  pricePerTonne: number,
): Promise<string | null> {
  await requireCoopProfile();
  const supabase = await createClient();

  if (!(pricePerTonne > 0)) return "Giá bán phải lớn hơn 0.";

  const { error } = await supabase
    .from("credit_batches")
    .update({
      status: "listed",
      price_per_t_vnd: pricePerTonne,
      listed_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  if (error) return error.message;
  revalidatePath(`/htx/lo-tin-chi/${batchId}`);
  revalidatePath("/cho");
  return null;
}
