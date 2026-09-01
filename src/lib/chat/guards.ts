/**
 * Các chặn kỹ thuật quanh một lượt hỏi. Gọi model là thao tác tốn tiền và có thể
 * chạy rất lâu, nên mọi giới hạn đặt ở một chỗ để dễ chỉnh và dễ kiểm thử.
 */

/** Câu hỏi dài hơn mức này gần như chắc chắn là dán nhầm cả trang văn bản. */
export const MAX_QUESTION_CHARS = 2000;

/** Số lượt hỏi–đáp gần nhất nạp lại làm ngữ cảnh. */
export const MAX_HISTORY_TURNS = 20;

/**
 * Số vòng gọi công cụ tối đa trong một lượt. Model có thể mắc kẹt gọi đi gọi lại
 * cùng một hàm; không có trần thì một câu hỏi thành hàng chục lượt tính tiền.
 */
export const MAX_TOOL_ROUNDS = 5;

/** Trần số bản ghi mỗi công cụ trả về, để một HTX lớn không làm vỡ cửa sổ ngữ cảnh. */
export const MAX_ROWS_PER_TOOL = 100;

/**
 * Trần cho truy vấn chỉ dùng để cộng dồn. Cao hơn trần trên vì dữ liệu được rút
 * xuống vài con số trước khi đưa cho model, không đi thẳng vào ngữ cảnh.
 */
export const MAX_ROWS_FOR_AGGREGATE = 2000;

export type QuestionCheck = { ok: true; question: string } | { ok: false; error: string };

export function checkQuestion(raw: unknown): QuestionCheck {
  if (typeof raw !== "string") return { ok: false, error: "Câu hỏi phải là văn bản." };
  const question = raw.trim();
  if (!question) return { ok: false, error: "Bạn chưa nhập câu hỏi." };
  if (question.length > MAX_QUESTION_CHARS)
    return {
      ok: false,
      error: `Câu hỏi dài quá ${MAX_QUESTION_CHARS} ký tự. Bạn tách thành vài câu ngắn giúp mình.`,
    };
  return { ok: true, question };
}

/**
 * Giữ lại các lượt gần nhất. Cắt từ cuối lên vì ngữ cảnh gần luôn quan trọng hơn
 * câu chào ở đầu hội thoại.
 */
export function trimHistory<T>(messages: T[], maxTurns: number = MAX_HISTORY_TURNS): T[] {
  const max = maxTurns * 2;
  return messages.length <= max ? messages : messages.slice(messages.length - max);
}

/** Tiêu đề hội thoại lấy từ câu hỏi đầu tiên, cắt ở ranh giới từ cho dễ đọc. */
export function titleFromQuestion(question: string, maxChars = 60): string {
  const flat = question.replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;
  const cut = flat.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
