"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  taskFlags,
  type StageView,
  type TaskCard,
} from "@/components/project/rules";
import { DueLabel } from "./task-card";

const CONTROL =
  "rounded-lg border border-soil-200 bg-white px-2.5 py-1.5 text-sm text-soil-900 outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100";
const MICRO =
  "w-full rounded border border-soil-200 bg-white px-1.5 py-1 text-xs text-soil-900 outline-none focus:border-leaf-500";

export function useTaskSelection(visible: TaskCard[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visibleIds = useMemo(() => new Set(visible.map((task) => task.id)), [visible]);

  // Không cho thao tác hàng loạt chạm vào công việc vừa bị bộ lọc ẩn.
  useEffect(() => {
    setSelected((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleIds]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return { selected, setSelected, toggle };
}

export function TaskList({
  projectId,
  rows,
  columns,
  stageOf,
  nameOf,
  now,
  canWrite,
  pending,
  selected,
  onToggle,
  onToggleAll,
  onStatus,
  onMove,
  onBulk,
}: {
  projectId: string;
  rows: TaskCard[];
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
  stageOf: Map<string, StageView>;
  nameOf: (id: string | null) => string;
  now: Date;
  canWrite: boolean;
  pending: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onStatus: (taskId: string, status: string) => void;
  onMove: (taskId: string, stageId: string, from: string) => void;
  onBulk: (
    ids: string[],
    patch: { status?: string; stageId?: string },
    label: string,
  ) => void;
}) {
  function bulk(patch: { status?: string; stageId?: string }, label: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    onBulk(ids, patch, label);
    onToggleAll(false);
  }

  const allChecked = rows.length > 0 && rows.every((task) => selected.has(task.id));

  return (
    <div className="space-y-3">
      {canWrite && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-2.5">
          <span className="text-sm font-medium text-leaf-900">
            Đã chọn {selected.size} công việc
          </span>

          <label className="flex items-center gap-2 text-sm text-leaf-900">
            Đổi trạng thái
            <select
              defaultValue=""
              disabled={pending}
              onChange={(event) => {
                if (event.target.value) bulk({ status: event.target.value }, "đổi trạng thái");
                event.target.value = "";
              }}
              className={CONTROL}
            >
              <option value="">— chọn —</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-leaf-900">
            Chuyển bước
            <select
              defaultValue=""
              disabled={pending}
              onChange={(event) => {
                if (event.target.value) bulk({ stageId: event.target.value }, "chuyển bước");
                event.target.value = "";
              }}
              className={CONTROL}
            >
              <option value="">— chọn —</option>
              {columns.map((column) => (
                <option key={column.stage.id} value={column.stage.id}>
                  {column.stage.ordinal}. {column.stage.title}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => onToggleAll(false)}
            className="ml-auto text-sm font-medium text-leaf-800 hover:underline"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      <div className={`overflow-x-auto rounded-xl border border-soil-200 bg-white shadow-sm ${pending ? "opacity-70" : ""}`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-soil-200 bg-soil-50 text-[11px] uppercase tracking-wide text-soil-600">
              {canWrite && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(event) => onToggleAll(event.target.checked)}
                    aria-label="Chọn tất cả công việc đang hiện"
                    className="h-4 w-4 rounded border-soil-300"
                  />
                </th>
              )}
              <th className="px-3 py-2 font-medium">Công việc</th>
              <th className="px-3 py-2 font-medium">Bước</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Người nhận</th>
              <th className="px-3 py-2 font-medium">Hạn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-soil-100">
            {rows.map((task) => {
              const stage = stageOf.get(task.stageId);
              const flags = taskFlags(task, now);
              return (
                <tr key={task.id} className={selected.has(task.id) ? "bg-leaf-50/60" : undefined}>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(task.id)}
                        onChange={() => onToggle(task.id)}
                        aria-label={`Chọn ${task.title}`}
                        className="h-4 w-4 rounded border-soil-300"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <Link
                      href={`/du-an/${projectId}/cong-viec/${task.id}`}
                      className="font-medium text-soil-900 hover:text-leaf-800"
                    >
                      {task.title}
                    </Link>
                    {flags.blocking && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        đang chặn
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <select
                        value={task.stageId}
                        disabled={pending}
                        onChange={(event) => onMove(task.id, event.target.value, task.stageId)}
                        aria-label={`Bước của ${task.title}`}
                        className={MICRO}
                      >
                        {columns.map((column) => (
                          <option key={column.stage.id} value={column.stage.id}>
                            {column.stage.ordinal}. {column.stage.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-soil-700">
                        {stage ? `${stage.ordinal}. ${stage.title}` : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <select
                        value={task.status}
                        disabled={pending}
                        onChange={(event) => onStatus(task.id, event.target.value)}
                        aria-label={`Trạng thái của ${task.title}`}
                        className={MICRO}
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {TASK_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone={TASK_STATUS_TONE[task.status]}>
                        {TASK_STATUS_LABEL[task.status]}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-soil-700">
                    {task.assigneeId ? nameOf(task.assigneeId) : <span className="italic text-soil-500">Chưa giao</span>}
                  </td>
                  <td className="px-3 py-2">
                    <DueLabel task={task} now={now} /> {!task.dueAt && <span className="text-soil-500">—</span>}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-3 py-10 text-center text-sm text-soil-600">
                  Không có công việc nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
