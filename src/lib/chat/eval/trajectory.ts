import type { ToolCall } from "../provider";

/**
 * Vết thực thi của agent, định dạng message OpenAI.
 *
 * Eval platform vốn chỉ rút được MỘT trường text từ connector, nên bốn evaluator
 * agentic (tool-call-correctness, routing-accuracy, goal-completion,
 * trajectory-efficiency) bị ẩn khỏi luồng tự sinh dữ liệu của nó — trừ khi API của
 * agent tự trả nguyên mảng trajectory. Đây chính là mảng đó.
 *
 * `arguments` phải là CHUỖI JSON chứ không phải object, đúng như hình dạng
 * `tool_calls` của OpenAI mà evaluator đọc.
 */

export interface TrajectoryStep {
  call: ToolCall;
  result: unknown;
}

export type TrajectoryMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; name: string; content: string };

export function buildTrajectory(
  question: string,
  steps: TrajectoryStep[],
  answer: string,
): TrajectoryMessage[] {
  const messages: TrajectoryMessage[] = [{ role: "user", content: question }];

  steps.forEach((step, index) => {
    messages.push({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: `call_${index + 1}`,
          type: "function",
          function: {
            name: step.call.name,
            arguments: JSON.stringify(step.call.args ?? {}),
          },
        },
      ],
    });
    messages.push({
      role: "tool",
      name: step.call.name,
      content: JSON.stringify(step.result ?? null),
    });
  });

  messages.push({ role: "assistant", content: answer });
  return messages;
}

/** Kết quả tool phẳng ra thành chuỗi, dùng làm `contexts` cho faithfulness. */
export function buildContexts(steps: TrajectoryStep[]): string[] {
  return steps.map((s) => `${s.call.name}: ${JSON.stringify(s.result ?? null)}`);
}
