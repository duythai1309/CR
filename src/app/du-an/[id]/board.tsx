"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge } from "@/components/ui";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  nextPosition,
  type StageView,
  type TaskCard,
} from "@/components/project/rules";
import { moveTask, setTaskStatus } from "./actions";

export interface BoardMember {
  userId: string;
  fullName: string;
}

/**
 * Bảng kanban bảy cột.
 *
 * `PLAN.md` §3 nói "mỗi Stage là 1 cột, Task là card", nên **cột là bước**, và kéo card
 * sang cột khác đổi `stage_id`. `status` (`todo|in_progress|done|blocked`) là thuộc tính
 * riêng của card, đổi bằng ô chọn ngay trên card.
 *
 * Kéo-thả dùng HTML5 thuần, không thư viện ngoài. Kéo-thả **không bao giờ là đường duy
 * nhất**: mỗi card có hai ô chọn (bước và trạng thái) làm được đúng việc đó bằng bàn
 * phím. Người dùng bàn phím, đọc màn hình, hoặc màn hình cảm ứng không mất chức năng nào.
 */
export function ProjectBoard({
  projectId,
  columns,
  members,
  canWrite,
}: {
  projectId: string;
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
  members: BoardMember[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const memberName = new Map(members.map((m) => [m.userId, m.fullName]));

  function run(action: () => Promise<string | null>) {
    setError(null);
    startTransition(async () => {
      const message = await action();
      if (message) setError(message);
      else router.refresh();
    });
  }

  function moveTo(taskId: string, stageId: string, currentStageId: string) {
    if (!canWrite || stageId === currentStageId) return;
    const target = columns.find((c) => c.stage.id === stageId);
    run(() => moveTask(projectId, taskId, stageId, nextPosition(target?.tasks ?? [])));
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}

      {!canWrite && (
        <Alert tone="warn" title="Chỉ xem">
          Vai trò của bạn trong dự án này không cho phép sửa công việc.
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-soil-200 bg-soil-50 px-3 py-2">
        <label className="text-xs text-soil-600">Lọc assignee
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="ml-2 rounded border border-soil-200 bg-white px-2 py-1 text-xs text-soil-900">
            <option value="all">Tất cả</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
          </select>
        </label>
        <label className="text-xs text-soil-600">Lọc status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ml-2 rounded border border-soil-200 bg-white px-2 py-1 text-xs text-soil-900">
            <option value="all">Tất cả</option>
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <span className="text-xs text-soil-500">Tab để đi qua card và các ô chọn; Enter để mở công việc.</span>
      </div>

      <div
        className={`grid gap-4 overflow-x-auto pb-2 lg:grid-flow-col lg:auto-cols-[minmax(17rem,1fr)] ${
          pending ? "opacity-70" : ""
        }`}
      >
        {columns.map(({ stage, tasks: stageTasks }) => {
          const tasks = stageTasks.filter((task) => (assigneeFilter === "all" || task.assigneeId === assigneeFilter) && (statusFilter === "all" || task.status === statusFilter));
          return (
          <section
            key={stage.id}
            aria-label={`Bước ${stage.ordinal}: ${stage.title}`}
            onDragOver={(e) => {
              if (!canWrite || !dragging) return;
              e.preventDefault();
              setDragOver(stage.id);
            }}
            onDragLeave={() => setDragOver((v) => (v === stage.id ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const taskId = e.dataTransfer.getData("text/plain") || dragging;
              const from = columns.find((c) => c.tasks.some((t) => t.id === taskId));
              if (taskId && from) moveTo(taskId, stage.id, from.stage.id);
              setDragging(null);
            }}
            className={`flex min-w-[17rem] flex-col rounded-xl border bg-soil-100/60 p-3 transition ${
              dragOver === stage.id ? "border-leaf-500 bg-leaf-50" : "border-soil-200"
            }`}
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-soil-900">
                <span className="mr-1.5 text-leaf-700">{stage.ordinal}</span>
                {stage.title}
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-soil-600">
                {tasks.length}
              </span>
            </header>

            <ul className="flex flex-1 flex-col gap-2">
              {tasks.map((task) => (
                <li key={task.id}>
                  <article
                    draggable={canWrite}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(task.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setDragOver(null);
                    }}
                    className={`rounded-lg border border-soil-200 bg-white p-3 shadow-sm ${
                      canWrite ? "cursor-grab active:cursor-grabbing" : ""
                    } ${dragging === task.id ? "opacity-50" : ""}`}
                  >
                    <Link
                      href={`/du-an/${projectId}/cong-viec/${task.id}`}
                      className="block text-sm font-medium text-soil-900 hover:text-leaf-800"
                    >
                      {task.title}
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={TASK_STATUS_TONE[task.status]}>
                        {TASK_STATUS_LABEL[task.status]}
                      </Badge>
                      {task.dueAt && (
                        <span className="text-xs text-soil-600">
                          Hạn {new Date(task.dueAt).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-xs text-soil-600">
                      {task.assigneeId
                        ? (memberName.get(task.assigneeId) ?? "Thành viên đã rời dự án")
                        : "Chưa giao cho ai"}
                    </p>

                    {canWrite && (
                      <div className="mt-3 grid gap-1.5 border-t border-soil-100 pt-2.5">
                        <label className="flex items-center gap-2 text-xs text-soil-600">
                          <span className="w-14 shrink-0">Bước</span>
                          <select
                            value={stage.id}
                            disabled={pending}
                            onChange={(e) => moveTo(task.id, e.target.value, stage.id)}
                            className="w-full rounded border border-soil-200 bg-white px-1.5 py-1 text-xs text-soil-900"
                          >
                            {columns.map((c) => (
                              <option key={c.stage.id} value={c.stage.id}>
                                {c.stage.ordinal}. {c.stage.title}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-soil-600">
                          <span className="w-14 shrink-0">Trạng thái</span>
                          <select
                            value={task.status}
                            disabled={pending}
                            onChange={(e) =>
                              run(() => setTaskStatus(projectId, task.id, e.target.value))
                            }
                            className="w-full rounded border border-soil-200 bg-white px-1.5 py-1 text-xs text-soil-900"
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {TASK_STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </article>
                </li>
              ))}

              {tasks.length === 0 && (
                <li className="rounded-lg border border-dashed border-soil-300 px-3 py-6 text-center text-xs text-soil-500">
                  Chưa có công việc
                </li>
              )}
            </ul>
          </section>
          );
        })}
      </div>

      {canWrite && (
        <p className="text-xs text-soil-600">
          Kéo card sang cột khác để đổi bước, hoặc dùng ô chọn <em>Bước</em> ngay trên card —
          hai cách cho cùng một kết quả.
        </p>
      )}
    </div>
  );
}
