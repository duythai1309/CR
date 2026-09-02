import { GoogleGenAI } from "@google/genai";
import type { ChatProvider, ProviderTurn } from "../provider";
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

/**
 * `ProviderTurn` sang `Content` của Gemini.
 *
 * Điểm quan trọng: `thoughtSignature` là anh em cùng cấp với `functionCall` trong
 * một Part, KHÔNG nằm bên trong nó. Gemini 3.x từ chối cả lượt gọi (HTTP 400
 * "missing a thought_signature") nếu lượt model trước đó được dựng lại mà thiếu
 * chữ ký này — mà `runTurn` thì luôn dựng lại lượt đó từ tên và tham số. Nên chữ
 * ký phải đi kèm `ToolCall` suốt vòng lặp rồi được trả về đúng chỗ tại đây.
 */
function toGeminiContents(contents: ProviderTurn[]) {
  return contents.map((turn) => ({
    role: turn.role,
    parts: turn.parts.map((part) => {
      if ("functionCall" in part) {
        const { name, args, signature } = part.functionCall;
        return signature
          ? { functionCall: { name, args }, thoughtSignature: signature }
          : { functionCall: { name, args } };
      }
      return part;
    }),
  }));
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
        // SDK khai báo kiểu Content riêng; cấu trúc khớp nhưng TypeScript không nối
        // được hai định nghĩa, nên ép kiểu đúng tại một chỗ duy nhất này.
        contents: toGeminiContents(contents) as never,
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
        // Duyệt thẳng parts thay vì dùng `chunk.functionCalls`: chỉ ở đây mới lấy
        // được `thoughtSignature` đi kèm từng lượt gọi.
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        const calls = parts
          .filter((p) => p.functionCall)
          .map((p) => ({
            name: p.functionCall?.name ?? "",
            args: (p.functionCall?.args ?? {}) as Record<string, unknown>,
            ...(p.thoughtSignature ? { signature: p.thoughtSignature } : {}),
          }));

        if (calls.length > 0) {
          yield { type: "calls", calls };
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
