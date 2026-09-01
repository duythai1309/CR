import type { ChatProvider } from "../provider";
import { createGeminiProvider, pingGemini } from "./gemini";

/**
 * Danh mục nhà cung cấp model.
 *
 * Thêm một nhà cung cấp = thêm một tệp trong thư mục này rồi thêm một mục ở đây.
 * Không chỗ nào khác trong dự án được nhắc tên nhà cung cấp cụ thể — màn hình quản
 * trị dựng danh sách chọn từ chính danh mục này, nên giao diện tự có mục mới mà
 * không phải sửa.
 */

export interface ProviderModel {
  id: string;
  label: string;
  hint?: string;
}

export interface ProviderDefinition {
  id: string;
  label: string;
  /** Biến môi trường chứa khoá của nhà cung cấp này, làm lớp nền cho cấu hình. */
  envKey: string;
  /** Biến môi trường ghi đè tên model, cũng thuộc lớp nền. */
  envModelKey: string;
  defaultModel: string;
  /** Model gợi ý sẵn. Giao diện vẫn cho gõ tay tên khác, để model mới ra là dùng
   *  được ngay mà không phải sửa mã. */
  models: ProviderModel[];
  keyUrl: string;
  create(config: { apiKey: string; model: string }): ChatProvider;
  ping(config: { apiKey: string; model: string }): Promise<void>;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    envModelKey: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash",
    models: [
      {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        hint: "Nhanh và rẻ; đủ cho hầu hết câu hỏi của cán bộ hợp tác xã",
      },
      {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        hint: "Suy luận tốt hơn, chậm và đắt hơn",
      },
      {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        hint: "Bản cũ hơn, giữ lại để đối chiếu",
      },
    ],
    keyUrl: "https://aistudio.google.com/apikey",
    create: createGeminiProvider,
    ping: pingGemini,
  },
];

export const DEFAULT_PROVIDER = PROVIDERS[0];

export function findProvider(id: string | null | undefined): ProviderDefinition | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Nhà cung cấp đang có khoá đặt sẵn ở biến môi trường. */
export function providersWithEnvKey(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return PROVIDERS.filter((p) => env[p.envKey]?.trim()).map((p) => p.id);
}
