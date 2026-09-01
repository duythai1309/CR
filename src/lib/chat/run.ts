import { MAX_TOOL_ROUNDS } from "./guards";
import type { ChatProvider, ProviderTurn, ToolCall } from "./provider";
import type { ToolSpec } from "./tools";

export type RunEvent =
  | { type: "status"; tool: string }
  | { type: "delta"; text: string }
  | { type: "done"; text: string; toolCalls: ToolCall[] };

export interface RunOptions {
  provider: ChatProvider;
  system: string;
  /** Lịch sử đã dựng sẵn, kết thúc bằng câu hỏi mới. Hàm này bồi thêm vào bản sao. */
  contents: ProviderTurn[];
  tools: ToolSpec[];
  /** Chạy một công cụ. Lỗi đã được bắt ở đây, luôn trả về object mô tả kết quả. */
  execute: (call: ToolCall) => Promise<Record<string, unknown>>;
  maxRounds?: number;
}

const OUT_OF_ROUNDS =
  "Câu hỏi này cần tra nhiều bước quá nên mình dừng lại để khỏi chạy lòng vòng. " +
  "Anh/chị tách thành vài câu ngắn hơn giúp mình nhé.";

/**
 * Một lượt hỏi–đáp trọn vẹn, kể cả các vòng gọi công cụ ở giữa.
 *
 * Trần `maxRounds` là thứ bắt buộc phải có: model hoàn toàn có thể mắc kẹt gọi đi
 * gọi lại cùng một hàm, và mỗi vòng là một lần tính tiền.
 */
export async function* runTurn(opts: RunOptions): AsyncGenerator<RunEvent> {
  const { provider, system, tools, execute } = opts;
  const maxRounds = opts.maxRounds ?? MAX_TOOL_ROUNDS;
  const contents: ProviderTurn[] = [...opts.contents];
  const toolCalls: ToolCall[] = [];
  let answer = "";

  for (let round = 0; round < maxRounds; round++) {
    const calls: ToolCall[] = [];

    for await (const event of provider.stream({ system, contents, tools })) {
      if (event.type === "calls") {
        calls.push(...event.calls);
      } else if (event.text) {
        answer += event.text;
        yield { type: "delta", text: event.text };
      }
    }

    if (calls.length === 0) {
      yield { type: "done", text: answer, toolCalls };
      return;
    }

    contents.push({ role: "model", parts: calls.map((c) => ({ functionCall: c })) });

    const responses: ProviderTurn["parts"] = [];
    for (const call of calls) {
      yield { type: "status", tool: call.name };
      toolCalls.push(call);
      responses.push({ functionResponse: { name: call.name, response: await execute(call) } });
    }
    contents.push({ role: "user", parts: responses });
  }

  // Hết vòng mà model vẫn đòi gọi tiếp: dừng và nói thật, không im lặng trả lời bừa.
  const text = answer.trim() ? `${answer.trim()}\n\n${OUT_OF_ROUNDS}` : OUT_OF_ROUNDS;
  yield { type: "delta", text: answer.trim() ? `\n\n${OUT_OF_ROUNDS}` : OUT_OF_ROUNDS };
  yield { type: "done", text, toolCalls };
}
