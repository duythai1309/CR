import { GoogleGenAI } from "@google/genai";
import type { ChatProvider } from "../provider";
import type { ToolParamSchema } from "../tools";

/** Tệp duy nhất trong dự án biết đến Gemini. */

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

export function createGeminiProvider(config: {
  apiKey: string;
  model: string;
}): ChatProvider {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    async *stream({ system, contents, tools }) {
      const response = await ai.models.generateContentStream({
        model: config.model,
        // SDK khai báo kiểu Schema riêng; cấu trúc khớp nhưng TypeScript không nối
        // được hai định nghĩa, nên ép kiểu đúng tại một chỗ duy nhất này.
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

/** Gọi một lượt ngắn để xác nhận khoá và tên model dùng được. */
export async function pingGemini(config: { apiKey: string; model: string }): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  await ai.models.generateContent({
    model: config.model,
    contents: [{ role: "user", parts: [{ text: "ping" }] }],
    config: { maxOutputTokens: 1 },
  });
}
