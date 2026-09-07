import Link from "next/link";

/**
 * Trục hành trình của một dự án Carbon: Thiết kế → Giám sát → Báo cáo.
 *
 * Trước đây điều hướng là sáu tab phẳng, mỗi tab ứng với một nhóm bảng trong DB. Người
 * dùng phải tự dựng bản đồ "mình đang ở đâu, còn bao xa" trong đầu. Trục này nói thẳng
 * điều đó ra.
 *
 * Ba giai đoạn KHÔNG phải ba thực thể mới trong DB. Chúng là cách đọc lại trạng thái đã
 * có: `approved` đếm stage đã duyệt, `methodologyLocked` là mốc mở Module B. Không có
 * cột nào được thêm, không có luật nào bị vòng qua.
 *
 * Giai đoạn chưa mở vẫn hiện, kèm lý do. Giấu đi sẽ tiện hơn cho mắt nhưng phá mô hình
 * nghiệp vụ: bảy bước và chu kỳ MRV là chuẩn của Standard, người làm nghề cần thấy đủ
 * bản đồ kể cả phần chưa đi tới.
 */

/**
 * `available` = đã mở nhưng chưa phải việc đang làm. Tách khỏi `done` vì hai thứ đó
 * nhìn giống nhau nhưng nghĩa ngược nhau; gộp lại là nói với người đọc code rằng giai
 * đoạn đã hoàn thành trong khi nó còn chưa bắt đầu.
 */
type PhaseState = "done" | "active" | "available" | "locked";

interface Phase {
  slug: string;
  label: string;
  detail: string;
  state: PhaseState;
}

const TOTAL_STAGES = 7;

/** Ba giai đoạn suy ra từ trạng thái thật, không từ một cột trạng thái riêng. */
export function journeyPhases({
  approved,
  methodologyLocked,
}: {
  approved: number;
  methodologyLocked: boolean;
}): Phase[] {
  const designDone = approved >= TOTAL_STAGES;

  return [
    {
      slug: "quy-trinh",
      label: "Thiết kế",
      detail: designDone
        ? `Đủ ${TOTAL_STAGES}/${TOTAL_STAGES} bước`
        : `${approved}/${TOTAL_STAGES} bước đã duyệt`,
      state: designDone ? "done" : "active",
    },
    {
      slug: "giam-sat",
      label: "Giám sát",
      detail: methodologyLocked
        ? "Nhập dữ liệu theo kỳ"
        : "Mở sau khi khoá Methodology ở bước 4",
      state: methodologyLocked ? (designDone ? "active" : "available") : "locked",
    },
    {
      slug: "bao-cao",
      label: "Báo cáo",
      detail: methodologyLocked
        ? "Sinh báo cáo MRV từ kỳ đã khoá"
        : "Mở sau khi khoá Methodology ở bước 4",
      // Không bao giờ là `active`: trục này không biết đã có kỳ nào khoá chưa, và biết
      // được thì phải truy vấn listPeriods trên mọi trang con. Trang Báo cáo tự nói
      // điều kiện tinh đó bằng `Locked`.
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

export function JourneyRail({
  projectId,
  approved,
  methodologyLocked,
}: {
  projectId: string;
  approved: number;
  methodologyLocked: boolean;
}) {
  const phases = journeyPhases({ approved, methodologyLocked });

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
