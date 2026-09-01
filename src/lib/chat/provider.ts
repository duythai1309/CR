import { GoogleGenAI } from "@google/genai";
import type { ChatConfig } from "./config";
import type { ToolParamSchema, ToolSpec } from "./tools";

/**
 * Tệp duy nhất biết đến Gemini. Mọi phần còn lại của chatbot làm việc với các kiểu
 * khai báo ở đây, nên đổi sang nhà cung cấp khác chỉ phải viết lại một cài đặt của
 * `ChatProvider`.
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

/** JSON Schema của `tools.ts` sang dạng Gemini mong đợi: cùng cấu trúc, kiểu viết hoa. */
function toGeminiSchema(schema: ToolParamSchema) {
  return {
    type: "OBJECT",
    properties: Object.fromEntries(
      Object.entries(schema.properties).map(([name, p]) => [
        name,
        {
          type: p.type.toUpperCase(),
          description: p.description,
          ...(p.enum ? { enum: p.enum } : {}),
        },
      ]),
    ),
    ...(schema.required?.length ? { required: schema.required } : {}),
  };
}

export function createGeminiProvider(config: ChatConfig): ChatProvider {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    async *stream({ system, contents, tools }) {
      const response = await ai.models.generateContentStream({
        model: config.model,
        // SDK khai báo kiểu Schema riêng; cấu trúc khớp nhưng TypeScript không tự
        // nối được hai định nghĩa, nên ép kiểu đúng tại một chỗ duy nhất này.
        contents: contents as never,
        config: {
          systemInstruction: system,
          // Số liệu kiểm định không phải chỗ để model sáng tạo.
          temperature: 0.2,
          tools:
            tools.length > 0
              ? [
                  {
                    functionDeclarations: tools.map((t) => ({
                      name: t.name,
                      description: t.description,
                      parameters: toGeminiSchema(t.parameters) as never,
                    })),
                  },
                ]
              : undefined,
        },
      });

      for await (const chunk of response) {
        const calls = chunk.functionCalls;
        if (calls && calls.length > 0) {
          yield {
            type: "calls",
            calls: calls.map((c) => ({
              name: c.name ?? "",
              args: (c.args ?? {}) as Record<string, unknown>,
            })),
          };
          continue;
        }
        const text = chunk.text;
        if (text) yield { type: "text", text };
      }
    },
  };
}
