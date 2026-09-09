import Link from "next/link";

/**
 * Trục hành trình của một dự án carbon: Thiết kế → Giám sát → Báo cáo.
 *
 * Thiết kế là danh mục bảy hồ sơ thông tin cần xây dựng, không phải chuỗi bảy đầu việc.
 * Vì vậy tiến độ ở đây đếm hồ sơ đã có nội dung; trạng thái duyệt tuần tự là một trục
 * riêng và không được dùng để khoá việc điền hồ sơ.
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

const DOSSIER_KEYS: Array<keyof DossierPresence> = [
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

export async function JourneyRail({
  projectId,
  approved: _legacyApproved,
  methodologyLocked,
}: {
  projectId: string;
  /** Giữ prop cũ để layout không phải đổi; tiến độ không còn dùng số lượt duyệt này. */
  approved: number;
  methodologyLocked: boolean;
}) {
  const [{ getDocuments, getProject }, { getProjectSetup }] = await Promise.all([
    import("@/app/du-an/data"),
    import("@/app/du-an/[id]/thiet-lap/data"),
  ]);
  const [project, documents, setup] = await Promise.all([
    getProject(projectId),
    getDocuments(projectId),
    getProjectSetup(projectId),
  ]);
  const present = dossierPresence({
    setup,
    standardId: project?.standard_id ?? null,
    methodologyId: project?.methodology_id ?? null,
    baseline: project?.baseline,
    documentKinds: documents.map((document) => document.kind),
  });
  const phases = journeyPhases({
    dossierCount: countPresentDossiers(present),
    methodologyLocked,
  });

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
