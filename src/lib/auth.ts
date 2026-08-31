import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRole = Database["public"]["Enums"]["user_role"];

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data ?? null;
}

/**
 * Dùng trong trang của hợp tác xã. Người dùng chưa gắn với HTX nào sẽ được đưa
 * sang bước thiết lập thay vì thấy trang trống không rõ vì sao.
 */
export async function requireCoopProfile(): Promise<Profile & { cooperative_id: string }> {
  const profile = await getProfile();
  if (!profile) redirect("/dang-nhap");
  if (profile.role === "buyer") redirect("/cho");
  if (!profile.cooperative_id) redirect("/thiet-lap");
  return profile as Profile & { cooperative_id: string };
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/dang-nhap");
  return profile;
}

export function homePathFor(role: UserRole, cooperativeId: string | null): string {
  if (role === "buyer") return "/cho";
  if (role === "platform_admin") return "/quan-tri";
  return cooperativeId ? "/htx" : "/thiet-lap";
}
