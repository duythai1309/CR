"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { findProvider } from "@/lib/chat/providers/registry";
import { loadChatConfig } from "@/lib/chat/settings";
import type { Database } from "@/types/database";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Vai trò được kiểm lại ở server action, không chỉ ở trang. Trang chặn để người
 * dùng không thấy màn hình, còn action mới là thứ thực sự ghi dữ liệu — và nó gọi
 * được thẳng bằng một request tự dựng.
 *
 * Dù vậy đây vẫn chỉ là lớp thứ hai: policy `chat_settings_update` đòi
 * `app_is_admin()`, nên Postgres từ chối kể cả khi hai lớp trên đều hỏng.
 */
async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "platform_admin") return null;
  return profile;
}

export async function saveChatSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (!profile) return { ok: false, message: "Chỉ quản trị nền tảng đổi được cấu hình này." };

  const providerId = String(formData.get("provider") ?? "").trim();
  const provider = findProvider(providerId);
  if (!provider) return { ok: false, message: "Nhà cung cấp không hợp lệ." };

  // Ô chọn có sẵn danh sách gợi ý, nhưng vẫn nhận tên gõ tay để model mới ra là
  // dùng được ngay. Bỏ trống thì quay về mặc định của nhà cung cấp.
  const model = String(formData.get("model") ?? "").trim() || provider.defaultModel;
  const apiKey = String(formData.get("api_key") ?? "").trim();

  const supabase = await createClient();
  const patch: Database["public"]["Tables"]["chat_settings"]["Update"] = {
    provider: provider.id,
    model,
    updated_by: profile.id,
  };
  // Để trống ô khoá nghĩa là giữ nguyên khoá cũ — người quản trị không đọc lại được
  // khoá đã lưu, nên bắt gõ lại mỗi lần đổi model là cách chắc chắn làm mất khoá.
  if (apiKey) patch.api_key = apiKey;

  const { error } = await supabase.from("chat_settings").update(patch).eq("id", true);
  if (error) return { ok: false, message: `Không lưu được: ${error.message}` };

  revalidatePath("/quan-tri/tro-ly");
  return {
    ok: true,
    message: apiKey ? "Đã lưu cấu hình và khoá mới." : "Đã lưu cấu hình, giữ nguyên khoá cũ.",
  };
}

/**
 * Gọi thử một lượt thật để lỗi credential/model được phát hiện ở màn hình vận hành,
 * trước khi thành viên dự án gửi câu hỏi trong workspace.
 */
export async function testChatConnection(): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (!profile) return { ok: false, message: "Chỉ quản trị nền tảng chạy được kiểm tra này." };

  const supabase = await createClient();
  const config = await loadChatConfig(supabase);
  if (!config)
    return {
      ok: false,
      message:
        "Chưa có khoá API ở đâu cả — chưa lưu vào hệ thống và cũng không có trong biến môi trường.",
    };

  try {
    await config.provider.ping({ apiKey: config.apiKey, model: config.model });
    return {
      ok: true,
      message: `Kết nối được tới ${config.provider.label}, model ${config.model}.`,
    };
  } catch (e) {
    return {
      ok: false,
      message: `Không gọi được model: ${e instanceof Error ? e.message : "lỗi không rõ"}`,
    };
  }
}
