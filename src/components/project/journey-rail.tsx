import Link from "next/link";

/**
 * Trục hành trình của một dự án carbon: Thiết kế → Giám sát → Báo cáo.
 *
 * Thiết kế là danh mục bảy hồ sơ thông tin cần xây dựng, không phải chuỗi bảy đầu việc.
 * Vì vậy tiến độ ở đây đếm hồ sơ đã có nội dung. Nền tảng đã bỏ hẳn bước duyệt (0028),
 * nên không còn trục nào khác để nhầm lẫn với trục này.
 */

type PhaseState = "done" | "active" | "available" | "locked";

interface Phase {
  slug: string;
  label: string;
  detail: string;
  state: PhaseState;
}

export interface DossierPresence {
  idea: boolean;
  feasibility: boolean;
  standard: boolean;
  methodology: boolean;
  baseline: boolean;
  additionality: boolean;
  pdd: boolean;
}

/** Bảy khoá theo đúng thứ tự ordinal 1..7 của `project_stages`. */
export const DOSSIER_KEYS: Array<keyof DossierPresence> = [
  "idea",
  "feasibility",
  "standard",
  "methodology",
  "baseline",
  "additionality",
  "pdd",
];

const TOTAL_DOSSIERS = DOSSIER_KEYS.length;

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (value && typeof value === "object")
    return Object.values(value as Record<string, unknown>).some(hasMeaningfulValue);
  return false;
}

/** Suy ra trạng thái nội dung từ đúng các trường mà màn Thiết kế đang hiển thị. */
export function dossierPresence({
  setup,
  standardId,
  methodologyId,
  baseline,
  documentKinds,
}: {
  setup: {
    idea?: unknown;
    description?: unknown;
    feasibility?: unknown;
  };
  standardId: string | null;
  methodologyId: string | null;
  baseline: unknown;
  documentKinds: string[];
}): DossierPresence {
  const documents = new Set(documentKinds);
  return {
    idea: hasMeaningfulValue(setup.idea) || hasMeaningfulValue(setup.description),
    feasibility: hasMeaningfulValue(setup.feasibility) || documents.has("feasibility"),
    standard: Boolean(standardId),
    methodology: Boolean(methodologyId),
    baseline: hasMeaningfulValue(baseline) || documents.has("baseline"),
    additionality: documents.has("additionality"),
    pdd: documents.has("pdd"),
  };
}

export function countPresentDossiers(presence: DossierPresence): number {
  return DOSSIER_KEYS.filter((key) => presence[key]).length;
}

/**
 * Đi trọn một mạch từ dữ liệu thô của dự án tới con số hiện trên thanh tiến độ.
 *
 * Layout gọi đúng hàm này, nên đường dây "tải tài liệu lên → số hồ sơ tăng" kiểm được
 * bằng test mà không cần dựng React hay cơ sở dữ liệu. Trước đây phần đếm nằm rải giữa
 * layout và component nên không có chỗ nào canh được cả mạch.
 */
export function dossierCountFor(input: Parameters<typeof dossierPresence>[0]): number {
  return countPresentDossiers(dossierPresence(input));
}

/** Ba giai đoạn suy ra từ số hồ sơ đã có và phụ thuộc thật để mở Module B. */
export function journeyPhases({
  dossierCount,
  methodologyLocked,
}: {
  dossierCount: number;
  methodologyLocked: boolean;
}): Phase[] {
  const boundedCount = Math.min(TOTAL_DOSSIERS, Math.max(0, Math.trunc(dossierCount)));
  const designDone = boundedCount >= TOTAL_DOSSIERS;

  return [
    {
      slug: "quy-trinh",
      label: "Thiết kế",
      detail: designDone
        ? `Đã có đủ ${TOTAL_DOSSIERS}/${TOTAL_DOSSIERS} hồ sơ`
        : `${boundedCount}/${TOTAL_DOSSIERS} hồ sơ đã có`,
      state: designDone ? "done" : "active",
    },
    {
      slug: "giam-sat",
      label: "Giám sát",
      detail: methodologyLocked
        ? "Nhập dữ liệu theo kỳ"
        : "Mở sau khi khoá Methodology để cố định metric_schema",
      state: methodologyLocked ? (designDone ? "active" : "available") : "locked",
    },
    {
      slug: "bao-cao",
      label: "Báo cáo",
      detail: methodologyLocked
        ? "Sinh báo cáo MRV từ kỳ đã khoá"
        : "Mở sau khi khoá Methodology để cố định metric_schema",
      state: methodologyLocked ? "available" : "locked",
    },
  ];
}

const TONE: Record<PhaseState, { bar: string; label: string; detail: string }> = {
  done: {
    bar: "bg-leaf-500",
    label: "text-soil-900",
    detail: "text-soil-600",
  },
  active: {
    bar: "bg-leaf-600",
    label: "text-soil-900 font-medium",
    detail: "text-leaf-800",
  },
  available: {
    bar: "bg-leaf-200",
    label: "text-soil-700",
    detail: "text-soil-600",
  },
  locked: {
    bar: "bg-soil-200",
    label: "text-soil-400",
    detail: "text-soil-400",
  },
};

/**
 * Thanh tiến độ. Chỉ VẼ — số hồ sơ do layout tính rồi truyền xuống.
 *
 * Không còn prop `approved`. Nó là số lượt duyệt stage, hết được dùng từ khi Thiết kế
 * chuyển sang đếm hồ sơ, nhưng vẫn nằm trong chữ ký nên layout cứ truyền và không ai thấy
 * là nó rơi vào hư không. Một prop chết mà vẫn nhận chính là cái bẫy đó, nên gỡ hẳn thay
 * vì đổi tên thành `_legacy`.
 *
 * Component này cũng thôi tự đi lấy dữ liệu: layout đã có `project` trong tay, tự truy vấn
 * lại ở đây là lặp một vòng trên MỌI trang con của dự án.
 */
export function JourneyRail({
  projectId,
  dossierCount,
  methodologyLocked,
}: {
  projectId: string;
  /** Số hồ sơ đã có nội dung, do `dossierCountFor` tính ở layout. */
  dossierCount: number;
  methodologyLocked: boolean;
}) {
  const phases = journeyPhases({ dossierCount, methodologyLocked });

  return (
    <ol className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Giai đoạn của dự án">
      {phases.map((phase) => {
        const tone = TONE[phase.state];
        const body = (
          <>
            <span className={`block h-1 rounded-full ${tone.bar}`} aria-hidden="true" />
            <span className={`mt-2 block text-sm ${tone.label}`}>
              {phase.state === "locked" && (
                <span aria-hidden="true" className="mr-1.5">
                  ◌
                </span>
              )}
              {phase.label}
            </span>
            <span className={`mt-0.5 block text-xs ${tone.detail}`}>{phase.detail}</span>
          </>
        );

        if (phase.state === "locked") {
          return (
            <li key={phase.slug} aria-disabled="true" title={phase.detail}>
              {body}
            </li>
          );
        }

        return (
          <li key={phase.slug}>
            <Link
              href={`/du-an/${projectId}/${phase.slug}`}
              className="block rounded-sm transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-600"
            >
              {body}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
