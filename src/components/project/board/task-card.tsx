"use client";

import { Badge } from "@/components/ui";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  taskFlags,
  type BoardColumnView,
  type StageView,
  type TaskCard,
} from "@/components/project/rules";

// Vòng focus rõ ràng theo đúng `controlClass` của `ui.tsx` — ô chọn nhỏ vẫn là chỗ thao
// tác bằng bàn phím, không được mảnh hơn ô chọn thường.
const MICRO =
  "w-full rounded border border-soil-200 bg-white px-1.5 py-1 text-xs text-soil-900 outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1
    ? parts[0].slice(0, 2)
    : parts[parts.length - 2][0] + parts[parts.length - 1][0]
  ).toLocaleUpperCase("vi");
}

export function DueLabel({ task, now }: { task: TaskCard; now: Date }) {
  if (!task.dueAt) return null;
  const flags = taskFlags(task, now);
  const text = new Date(task.dueAt).toLocaleDateString("vi-VN");
  if (flags.overdue)
    return (
      <span className="text-xs font-medium text-red-700">
        Quá hạn {flags.overdueDays} ngày · {text}
      </span>
    );
  return (
    <span className={`text-xs ${flags.dueSoon ? "font-medium text-carbon-700" : "text-soil-600"}`}>
      Hạn {text}
    </span>
  );
}

/**
 * Một card trên bảng.
 *
 * Hai ô chọn dưới card là **đường bàn phím** cho hai thao tác mà chuột làm bằng kéo-thả:
 * đổi mục hồ sơ và CHUYỂN CỘT. WCAG 2.2 "Dragging Movements" (AA) đòi mọi thao tác kéo
 * phải có lối đi không-kéo; ô chọn cột chính là lối đó, nên không được bỏ.
 *
 * Ô thứ hai cố ý liệt kê CỘT của dự án chứ không phải bốn `TASK_STATUSES` cứng: cột trên
 * bảng đọc `column_id`, nên một ô "Trạng thái" ở đây sẽ đổi `status` mà card đứng yên —
 * người dùng bấm rồi không thấy gì xảy ra. `status` vẫn sửa được trong panel sửa nhanh.
 */
export function TaskCardView({
  task,
  stage,
  stages,
  columns,
  now,
  canWrite,
  pending,
  assigneeName,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onMove,
  onColumn,
}: {
  task: TaskCard & { columnId: string | null };
  stage: StageView | undefined;
  stages: StageView[];
  /** Cột của CHÍNH dự án này, theo thứ tự đang hiện trên bảng. */
  columns: BoardColumnView[];
  now: Date;
  canWrite: boolean;
  pending: boolean;
  assigneeName: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** Bấm vào tiêu đề mở panel sửa nhanh ngay trên bảng. */
  onOpen: () => void;
  onMove: (stageId: string) => void;
  /** Chuyển card sang cột khác — cùng đường ghi với kéo-thả. */
  onColumn: (columnId: string) => void;
}) {
  const flags = taskFlags(task, now);
  const edge = flags.blocked
    ? "border-l-red-400"
    : flags.overdue
      ? "border-l-carbon-500"
      : task.status === "done"
        ? "border-l-leaf-400"
        : "border-l-soil-200";

  return (
    <article
      draggable={canWrite}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`rounded-lg border border-l-4 border-soil-200 bg-white p-3 shadow-sm ${edge} ${
        canWrite ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragging ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left text-sm font-medium text-soil-900 hover:text-leaf-800"
      >
        {task.title}
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
        <Badge tone="soil">
          {stage ? `${stage.ordinal}. ${stage.title}` : "Mục hồ sơ không xác định"}
        </Badge>
        <DueLabel task={task} now={now} />
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-soil-600">
        {task.assigneeId ? (
          <>
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-soil-200 text-[10px] font-semibold text-soil-700"
              aria-hidden
            >
              {initials(assigneeName)}
            </span>
            {assigneeName}
          </>
        ) : (
          <span className="italic">Chưa giao cho ai</span>
        )}
      </p>

      {canWrite && (
        <div className="mt-3 grid gap-1.5 border-t border-soil-100 pt-2.5">
          <label className="flex items-center gap-2 text-xs text-soil-600">
            <span className="w-16 shrink-0">Mục hồ sơ</span>
            <select
              value={task.stageId}
              disabled={pending}
              onChange={(event) => onMove(event.target.value)}
              className={MICRO}
            >
              {stages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.ordinal}. {item.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-soil-600">
            <span className="w-16 shrink-0">Cột</span>
            <select
              value={task.columnId ?? ""}
              disabled={pending || columns.length === 0}
              onChange={(event) => onColumn(event.target.value)}
              className={MICRO}
            >
              {task.columnId === null && <option value="">Chưa xếp cột</option>}
              {columns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </article>
  );
}
