import type { ToolSpec } from "./tools";

/**
 * Hợp đồng giữa chatbot và nhà cung cấp model. Không tệp nào ở đây biết Gemini hay
 * bất kỳ nhà cung cấp cụ thể nào — cài đặt nằm trong `providers/`, và `registry.ts`
 * là nơi duy nhất biết có những cài đặt nào.
 */

export type ToolCall = { name: string; args: Record<string, unknown> };

export type ProviderPart =
  | { text: string }
  | { functionCall: ToolCall }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface ProviderTurn {
  role: "user" | "model";
  parts: ProviderPart[];
}

export type ProviderEvent =
  | { type: "text"; text: string }
  | { type: "calls"; calls: ToolCall[] };

export interface StreamOptions {
  system: string;
  contents: ProviderTurn[];
  tools: ToolSpec[];
}

export interface ChatProvider {
  stream(opts: StreamOptions): AsyncGenerator<ProviderEvent>;
}
