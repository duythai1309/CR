/**
 * Hợp đồng dữ liệu cho luồng khởi tạo dự án Carbon.
 *
 * Bốn bước người dùng đi qua — ý tưởng → mô tả → đánh giá khả thi (AI hỗ trợ) → chọn
 * Standard/Methodology (AI hỗ trợ) — khớp đúng stage 1–4 đã có trong
 * `0013_project_platform.sql`. Luồng này KHÔNG thêm bước mới vào bảy bước; nó chỉ dẫn
 * dắt người dùng đi qua bốn bước đầu thay vì bỏ họ trước một loạt form rời rạc.
 *
 * Toàn bộ khối này lưu ở `projects.setup` (JSONB, thêm bởi `0017_project_setup.sql`)
 * và được `project_validate_setup()` cưỡng chế ở tầng DB.
 */

/** Loại hình dự án — khớp `methodologies.project_type` để lọc catalog. */
export type ProjectTypeHint = "afolu" | "energy" | "biogas" | "waste" | "cookstove" | "other";

/**
 * Bước 1 — ý tưởng dự án.
 *
 * Đây là thứ người làm hồ sơ có trong đầu trước khi có bất cứ tài liệu nào. Các trường
 * đều tuỳ chọn ở tầng kiểu: người dùng điền dần, và chính chỗ còn trống là đầu vào cho
 * phần đánh giá khả thi ở bước 3.
 */
export interface ProjectIdea {
  /** Vấn đề hoặc cơ hội giảm phát thải mà dự án nhắm tới. */
  problem?: string;
  /** Hoạt động cụ thể sẽ triển khai. */
  activity?: string;
  project_type?: ProjectTypeHint;
  /** Địa điểm — quốc gia/tỉnh/vùng, dạng văn xuôi. */
  location?: string;
  /** Quy mô: diện tích, số hộ, công suất... dạng văn xuôi kèm đơn vị. */
  scale?: string;
  /** Năm bắt đầu triển khai. */
  start_year?: number;
  /** Số năm của kỳ tín chỉ dự kiến (crediting period). */
  crediting_years?: number;
  /** Đơn vị đề xuất dự án (project proponent). */
  proponent?: string;
}

/**
 * Một khoảng trống trong hồ sơ khả thi: điều chưa biết và bằng chứng cần thu thập.
 *
 * Cố ý không có trường mức độ nghiêm trọng dạng số — xếp hạng rủi ro của một dự án
 * carbon là việc của chuyên gia, không phải của mô hình.
 */
export interface FeasibilityGap {
  /** Chủ đề, ví dụ "quyền sử dụng đất", "đường cơ sở", "additionality". */
  topic: string;
  /** Điều còn thiếu, diễn đạt cho người đọc. */
  missing: string;
  /** Bằng chứng hoặc tài liệu cần thu thập để lấp khoảng trống này. */
  evidence_needed?: string;
}

/**
 * Bước 3 — phiên đánh giá khả thi có AI hỗ trợ.
 *
 * ⚠️ **Không có trường kết luận.** Không `verdict`, không `feasible`, không `score`.
 * `project_validate_setup()` trong `0017` từ chối những khoá đó ở tầng DB, nên kể cả
 * client bị sửa cũng không ghi vào được.
 *
 * Lý do: trợ lý giúp *cấu trúc hoá* phần đánh giá — nêu điều đã biết, chỉ ra điều còn
 * thiếu, gợi ý bằng chứng cần thu thập. Một phán quyết "dự án này khả thi" do mô hình
 * sinh ra, nằm trong hồ sơ tín chỉ carbon, có thể gây hậu quả ngoài phần mềm. Kết luận
 * là việc của con người và được ghi trong `notes` với tư cách đó.
 */
export interface FeasibilityAssessment {
  /** ISO timestamp của lần chạy gần nhất. */
  assessed_at?: string;
  /** UUID người bấm chạy — trách nhiệm thuộc về người, không thuộc về mô hình. */
  assessed_by?: string;
  /** Điều đã biết, rút từ ý tưởng và mô tả người dùng nhập. */
  known?: string[];
  /** Điều còn thiếu và bằng chứng cần thu thập. */
  gaps?: FeasibilityGap[];
  /** Nhận định của chuyên gia. Đây là chỗ DUY NHẤT được viết kết luận, và do người viết. */
  notes?: string;
}

/** Một ứng viên methodology mà trợ lý gợi ý, luôn kèm cờ dữ liệu mẫu. */
export interface MethodologyCandidate {
  methodology_id: string;
  standard_code: string;
  code: string;
  version: string;
  project_type: string;
  /** Vì sao ứng viên này khớp — dựa trên dữ liệu catalog, không phải kiến thức ngoài. */
  why: string;
  /**
   * `true` nghĩa là methodology này do nhóm tự soạn, CHƯA thẩm định chuyên môn.
   * Cả bốn methodology hiện có trong DB đều là mẫu. Giao diện **phải** hiện cảnh báo
   * khi cờ này bật — không được lặng lẽ bỏ qua.
   */
  is_sample: boolean;
}

/**
 * Bước 4 — gợi ý lựa chọn Standard/Methodology.
 *
 * Chỉ là *gợi ý*: việc chốt và khoá lựa chọn vẫn do người dùng bấm, và vẫn đi qua
 * `projects.standard_locked_at` / `methodology_locked_at` như cũ.
 */
export interface SelectionAdvice {
  generated_at?: string;
  candidates?: MethodologyCandidate[];
  /** Câu cảnh báo hiển thị kèm, không được rỗng khi có ứng viên `is_sample`. */
  disclaimer?: string;
}

/** Một giá trị baseline do trợ lý đề xuất; chưa phải dữ liệu baseline của dự án. */
export interface BaselineDraftValue {
  /** Decimal giữ dạng chuỗi ASCII canonical; integer giữ dạng number như baseline thật. */
  value: string | number;
  /** Vì sao payload từ các handler cho phép suy ra đề xuất này. */
  reason: string;
  /** Dữ liệu nguồn trong payload handler, không phải kiến thức ngoài hệ thống. */
  source: string;
}

/** Bản nháp tách biệt hoàn toàn với `projects.baseline`. */
export interface BaselineDraft {
  generated_at: string;
  generated_by: string;
  generated_by_name?: string;
  disclaimer: string;
  values?: Record<string, BaselineDraftValue>;
}

type BaselineDraftSchemaField = {
  id?: unknown;
  scope?: unknown;
  type?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasHumanValue = (values: Record<string, unknown>, fieldId: string): boolean => {
  if (!Object.hasOwn(values, fieldId)) return false;
  const value = values[fieldId];
  return value !== null && value !== undefined && value !== "";
};

/**
 * Cửa allowlist cho output baseline của model.
 *
 * Hàm cố ý trả object rỗng khi model trả rác. Chỉ field baseline dạng số có trong schema,
 * có giá trị canonical và chưa được con người điền mới đi qua; mọi khoá khác bị bỏ.
 */
export function parseBaselineDraftValues(
  raw: string,
  metricSchema: unknown,
  currentValues: Record<string, unknown>,
): Record<string, BaselineDraftValue> {
  if (typeof raw !== "string" || raw.length > 100_000 || !isRecord(metricSchema)) return {};
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};

  let answer: unknown;
  try {
    answer = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {};
  }
  if (!isRecord(answer) || !isRecord(answer.values) || !Array.isArray(metricSchema.fields))
    return {};

  const allowed = new Map<string, "decimal" | "integer">();
  for (const candidate of metricSchema.fields as BaselineDraftSchemaField[]) {
    if (
      candidate &&
      typeof candidate.id === "string" &&
      candidate.scope === "baseline" &&
      (candidate.type === "decimal" || candidate.type === "integer")
    ) {
      allowed.set(candidate.id, candidate.type);
    }
  }

  const result: Record<string, BaselineDraftValue> = {};
  for (const [fieldId, proposal] of Object.entries(answer.values).slice(0, 200)) {
    const type = allowed.get(fieldId);
    if (!type || hasHumanValue(currentValues, fieldId) || !isRecord(proposal)) continue;

    const reason = typeof proposal.reason === "string" ? proposal.reason.trim() : "";
    const source = typeof proposal.source === "string" ? proposal.source.trim() : "";
    if (!reason || !source || reason.length > 4000 || source.length > 4000) continue;

    if (type === "integer") {
      const text =
        typeof proposal.value === "number" || typeof proposal.value === "string"
          ? String(proposal.value).trim()
          : "";
      if (!/^-?\d+$/.test(text)) continue;
      const value = Number(text);
      if (!Number.isSafeInteger(value)) continue;
      result[fieldId] = { value, reason, source };
      continue;
    }

    const text =
      typeof proposal.value === "number" || typeof proposal.value === "string"
        ? String(proposal.value).trim()
        : "";
    // metric_schema v1 dùng decimal_encoding là chuỗi ASCII, không nhận comma/exponent.
    if (text.length > 100 || !/^-?\d+(\.\d+)?$/.test(text)) continue;
    result[fieldId] = { value: text, reason, source };
  }
  return result;
}

/** Toàn bộ `projects.setup`. Mọi khoá đều tuỳ chọn: người dùng điền dần qua bốn bước. */
export interface ProjectSetup {
  idea?: ProjectIdea;
  /** Mô tả dự án dạng văn xuôi (bước 2). */
  description?: string;
  feasibility?: FeasibilityAssessment;
  selection_advice?: SelectionAdvice;
  /** Nội dung máy sinh chưa thẩm định; người dùng phải tự chép rồi lưu baseline thật. */
  baseline_draft?: BaselineDraft;
}

/** Bốn bước của luồng khởi tạo, ánh xạ sang ordinal của `project_stages`. */
export const SETUP_STEPS = [
  { key: "idea", ordinal: 1, label: "Ý tưởng dự án", en: "Project idea" },
  { key: "description", ordinal: 1, label: "Mô tả dự án", en: "Project description" },
  { key: "feasibility", ordinal: 2, label: "Đánh giá khả thi", en: "Feasibility assessment" },
  { key: "selection", ordinal: 4, label: "Chọn Standard & Methodology", en: "Standard & methodology" },
] as const;

export type SetupStepKey = (typeof SETUP_STEPS)[number]["key"];

/** Khoá bị DB từ chối trong `feasibility` — giữ ở đây để client chặn sớm, báo lỗi tử tế. */
export const FORBIDDEN_FEASIBILITY_KEYS = [
  "verdict",
  "feasible",
  "is_feasible",
  "score",
  "rating",
  "conclusion",
  "decision",
] as const;
