"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_REGION } from "@/lib/region";

export async function createCooperative(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("create_cooperative_and_join", {
    p_name: String(formData.get("name") ?? "").trim(),
    p_code: String(formData.get("code") ?? "").trim(),
    p_province: String(formData.get("province") ?? "").trim(),
    p_region: ACTIVE_REGION,
    p_commune: String(formData.get("commune") ?? "").trim(),
    p_contact_name: String(formData.get("contact_name") ?? "").trim(),
    p_contact_phone: String(formData.get("contact_phone") ?? "").trim(),
  });

  if (error) {
    return error.message.includes("duplicate key")
      ? "Mã hợp tác xã này đã có đơn vị khác dùng. Hãy chọn mã khác."
      : error.message;
  }

  revalidatePath("/", "layout");
  redirect("/htx");
}

export async function joinCooperative(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_cooperative_by_code", {
    p_code: String(formData.get("code") ?? "").trim(),
  });
  if (error) return error.message;

  revalidatePath("/", "layout");
  redirect("/htx");
}
