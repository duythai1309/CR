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

  if (password.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";

  // Biểu mẫu gửi lên NGỮ CẢNH đăng ký, không gửi thẳng giá trị enum. Ánh xạ nằm ở đây
  // để danh sách hợp lệ chỉ có một chỗ, và để giá trị lạ bị từ chối thành lỗi nhìn thấy
  // được thay vì bị `handle_new_user` (0012_signup_role_guard.sql:33-38) âm thầm hạ về
  // `coop_staff` — đó là rủi ro R5 trong docs/audit/audit-keep.md.
  //
  // `du_an` ánh xạ sang `coop_staff` một cách CÓ CHỦ Ý: nền tảng dự án không đọc
  // `user_role`, quyền của nó nằm ở `project_members.role`. Xem
  // docs/design/auth-role-design.md §1 để biết vì sao không thêm giá trị enum mới.
  const ACCOUNT_KINDS: Record<string, Role> = {
    du_an: "coop_staff",
    htx: "coop_manager",
    buyer: "buyer",
  };
  const kind = String(formData.get("account_kind") ?? "du_an");
  const role = ACCOUNT_KINDS[kind];
  if (!role) return "Loại tài khoản không hợp lệ.";

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
  // Tài khoản mới chưa có hợp tác xã nào, nên `homePathFor` tự đưa đúng chỗ:
  // buyer → /cho, htx → /thiet-lap, du_an → /du-an.
  redirect(homePathFor(role, null));
}

export async function signOut() {
  // Thiếu cấu hình thì không có phiên nào để đóng; đưa về trang chủ là đủ.
  if (formConfigError()) redirect("/");

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
