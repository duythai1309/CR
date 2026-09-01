import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PROVIDER,
  findProvider,
  type ProviderDefinition,
} from "./providers/registry";

type Client = SupabaseClient<Database>;
type Env = Record<string, string | undefined>;

/** Những gì đọc được từ bảng `chat_settings`. */
export interface StoredSettings {
  provider: string | null;
  model: string | null;
  /** Chỉ có giá trị khi đọc bằng service role; đường thường luôn null. */
  apiKey: string | null;
  apiKeyLast4: string | null;
}

export const EMPTY_SETTINGS: StoredSettings = {
  provider: null,
  model: null,
  apiKey: null,
  apiKeyLast4: null,
};

/** Mỗi giá trị đến từ đâu — giao diện hiện ra để không ai phải đoán. */
export type ValueSource = "db" | "env" | "default";

export interface ResolvedChatConfig {
  provider: ProviderDefinition;
  model: string;
  apiKey: string;
  source: { provider: ValueSource; model: ValueSource; apiKey: ValueSource };
}

/**
 * Ghép cấu hình theo thứ tự: cơ sở dữ liệu → biến môi trường → mặc định.
 *
 * Từng giá trị giải quyết độc lập, nên đặt model trong cơ sở dữ liệu mà khoá vẫn ở
 * biến môi trường là chuyện bình thường. Hàm thuần để kiểm thử được thứ tự ưu tiên
 * mà không cần cơ sở dữ liệu.
 */
export function resolveChatConfig(
  stored: StoredSettings,
  env: Env = process.env,
): ResolvedChatConfig | null {
  const provider = findProvider(stored.provider) ?? DEFAULT_PROVIDER;
  const providerSource: ValueSource = findProvider(stored.provider) ? "db" : "default";

  const envModel = env[provider.envModelKey]?.trim();
  const model = stored.model?.trim() || envModel || provider.defaultModel;
  const modelSource: ValueSource = stored.model?.trim()
    ? "db"
    : envModel
      ? "env"
      : "default";

  const envKey = env[provider.envKey]?.trim();
  const apiKey = stored.apiKey?.trim() || envKey;
  if (!apiKey) return null;

  return {
    provider,
    model,
    apiKey,
    source: {
      provider: providerSource,
      model: modelSource,
      apiKey: stored.apiKey?.trim() ? "db" : "env",
    },
  };
}

/**
 * Đọc cấu hình đã lưu.
 *
 * Ưu tiên service role vì đó là đường duy nhất đọc được cột `api_key`. Không có
 * service role thì vẫn lấy được provider và model bằng phiên của người dùng — hai
 * thứ đó không phải bí mật nên cấp quyền đọc rộng — còn khoá rơi về biến môi trường.
 * Nhờ vậy chưa đặt `SUPABASE_SERVICE_ROLE_KEY` thì hệ thống vẫn chạy đúng, chỉ mất
 * khả năng dùng khoá lưu trong cơ sở dữ liệu.
 */
export async function loadStoredSettings(userClient?: Client): Promise<StoredSettings> {
  const service = createServiceClient();
  if (service) {
    const { data } = await service
      .from("chat_settings")
      .select("provider, model, api_key, api_key_last4")
      .maybeSingle();
    if (data)
      return {
        provider: data.provider,
        model: data.model,
        apiKey: data.api_key,
        apiKeyLast4: data.api_key_last4,
      };
  }

  if (userClient) {
    // Cố tình KHÔNG chọn `api_key`: vai trò ứng dụng không có quyền đọc cột đó, và
    // `select *` ở đây sẽ báo lỗi quyền thay vì lặng lẽ trả về khoá.
    const { data } = await userClient
      .from("chat_settings")
      .select("provider, model, api_key_last4")
      .maybeSingle();
    if (data)
      return {
        provider: data.provider,
        model: data.model,
        apiKey: null,
        apiKeyLast4: data.api_key_last4,
      };
  }

  return EMPTY_SETTINGS;
}

/** Cấu hình dùng được ngay, hoặc null nếu chưa có khoá ở đâu cả. */
export async function loadChatConfig(userClient?: Client): Promise<ResolvedChatConfig | null> {
  return resolveChatConfig(await loadStoredSettings(userClient), process.env);
}

export function missingKeyMessage(): string {
  return (
    "Trợ lý chưa hoạt động vì chưa có khoá API. Quản trị nền tảng vào " +
    "/quan-tri/tro-ly để nhập khoá, hoặc đặt biến môi trường tương ứng với nhà " +
    "cung cấp rồi khởi động lại."
  );
}
