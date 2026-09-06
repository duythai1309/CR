"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { projectClient, requireProfile } from "@/lib/auth";
import { formConfigError } from "@/lib/supabase/config";
import { validateProjectName } from "@/components/project/rules";

/**
 * Tạo dự án.
 *
 * Đi qua RPC `create_project` (`0013_project_platform.sql:665-676`) chứ KHÔNG tự insert:
 * trigger `project_bootstrap` (`0013:577-590`) tạo owner và đủ bảy stage trong cùng
 * transaction. Tự insert tay từng bảng vừa không có quyền (`projects` không được cấp
 * INSERT cho `authenticated`), vừa mất tính nguyên tử — đúng lỗi mà `computeAndSave` cũ
 * mắc phải và bị nêu ở mục C19.
 */
export async function createProject(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const configError = formConfigError();
  if (configError) return configError;

  await requireProfile();

  const name = validateProjectName(formData.get("name"));
  if (!name.ok) return name.error;

  const description = String(formData.get("description") ?? "").trim();

  const db = await projectClient();
  const { data, error } = await db.rpc("create_project", {
    p_name: name.value,
    p_description: description,
  });

  if (error) return `Không tạo được dự án: ${error.message}`;
  if (typeof data !== "string") return "Không tạo được dự án: máy chủ không trả về mã dự án.";

  revalidatePath("/du-an");
  redirect(`/du-an/${data}`);
}
