"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formConfigError } from "@/lib/supabase/config";
import { homePathFor } from "@/lib/auth";
import type { Database } from "@/types/database";

type Role = Database["public"]["Enums"]["user_role"];

export async function signIn(_prev: string | null, formData: FormData): Promise<string | null> {
  const configError = formConfigError();
  if (configError) return configError;

  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return "Email hoặc mật khẩu không đúng.";

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, cooperative_id")
    .eq("id", user!.id)
    .single();

  const next = String(formData.get("tiep-tuc") ?? "");
  revalidatePath("/", "layout");
  redirect(next || homePathFor(profile?.role ?? "coop_staff", profile?.cooperative_id ?? null));
}

export async function signUp(_prev: string | null, formData: FormData): Promise<string | null> {
  const configError = formConfigError();
  if (configError) return configError;

  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "coop_staff") as Role;

  if (password.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
  if (role !== "coop_manager" && role !== "buyer") {
    return "Vai trò không hợp lệ.";
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: String(formData.get("full_name") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
        company_name: String(formData.get("company_name") ?? "").trim() || null,
        role,
      },
    },
  });

  if (error) {
    return error.message.includes("already registered")
      ? "Email này đã được đăng ký."
      : `Không tạo được tài khoản: ${error.message}`;
  }

  revalidatePath("/", "layout");
  redirect(role === "buyer" ? "/cho" : "/thiet-lap");
}

export async function signOut() {
  // Thiếu cấu hình thì không có phiên nào để đóng; đưa về trang chủ là đủ.
  if (formConfigError()) redirect("/");

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
