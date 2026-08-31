"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";

export async function addFarmer(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return "Chưa nhập họ tên nông hộ.";

  const { error } = await supabase.from("farmers").insert({
    cooperative_id: profile.cooperative_id,
    full_name: fullName,
    phone: String(formData.get("phone") ?? "").trim() || null,
    village: String(formData.get("village") ?? "").trim() || null,
    member_code: String(formData.get("member_code") ?? "").trim() || null,
  });

  if (error) {
    return error.message.includes("duplicate key")
      ? "Mã xã viên này đã có người dùng trong hợp tác xã."
      : error.message;
  }

  revalidatePath("/htx/nong-ho");
  return null;
}
