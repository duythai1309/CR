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

/**
 * Model có thể kết thúc lượt mà không sinh chữ nào — không phải lỗi mạng, không ném
 * ngoại lệ, chỉ là 0 token đầu ra. Gặp thật với `gemini-2.5-flash-lite`: nó im lặng
 * trả về rỗng sau MỌI lượt `functionResponse`. Không có câu này thì người dùng nhận
 * một bong bóng trắng và không có manh mối nào để lần ra.
 */
const EMPTY_ANSWER =
  "Model không trả về nội dung nào cho câu hỏi này. Anh/chị thử hỏi lại bằng câu khác " +
  "giúp mình; nếu lặp lại nhiều lần thì báo quản trị nền tảng kiểm tra cấu hình model.";

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
      if (!answer.trim()) {
        yield { type: "delta", text: EMPTY_ANSWER };
        yield { type: "done", text: EMPTY_ANSWER, toolCalls };
        return;
      }
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
