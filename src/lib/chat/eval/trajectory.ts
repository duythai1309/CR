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

/**
 * Căn cứ mà câu trả lời được phép dựa vào, dùng làm `contexts` cho faithfulness.
 *
 * Không chỉ có kết quả công cụ: danh tính người hỏi và tên hợp tác xã nằm trong
 * system prompt, và trợ lý nhắc lại chúng một cách chính đáng. Thiếu dòng đó thì
 * evaluator coi "HTX Nông nghiệp Tân Phú" là thông tin bịa và trừ điểm một hành vi
 * đúng — đo sai chứ không phải trợ lý sai.
 */
export function buildContexts(steps: TrajectoryStep[], nguoiHoi?: string): string[] {
  const base = nguoiHoi ? [`ngữ cảnh người hỏi: ${nguoiHoi}`] : [];
  return [...base, ...steps.map((s) => `${s.call.name}: ${JSON.stringify(s.result ?? null)}`)];
}
