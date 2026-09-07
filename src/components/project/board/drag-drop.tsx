"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Badge } from "@/components/ui";
import {
  isFilterActive,
  type StageView,
  type TaskCard,
  type TaskFilter,
} from "@/components/project/rules";
import { TaskCardView } from "./task-card";

export interface BoardDragDropState {
  dragging: string | null;
  dragOver: string | null;
  setDragging: Dispatch<SetStateAction<string | null>>;
  setDragOver: Dispatch<SetStateAction<string | null>>;
}

export function useBoardDragDrop(): BoardDragDropState {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  return { dragging, dragOver, setDragging, setDragOver };
}

export function BoardColumns({
  projectId,
  columns,
  visible,
  filter,
  now,
  canWrite,
  pending,
  nameOf,
  dragDrop,
  onMove,
  onStatus,
}: {
  projectId: string;
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
  visible: TaskCard[];
  filter: TaskFilter;
  now: Date;
  canWrite: boolean;
  pending: boolean;
  nameOf: (id: string | null) => string;
  dragDrop: BoardDragDropState;
  onMove: (taskId: string, stageId: string, currentStageId: string) => void;
  onStatus: (taskId: string, status: string) => void;
}) {
  const { dragging, dragOver, setDragging, setDragOver } = dragDrop;

  return (
    <div
      className={`grid gap-4 overflow-x-auto pb-2 lg:grid-flow-col lg:auto-cols-[minmax(17.5rem,1fr)] ${
        pending ? "opacity-70" : ""
      }`}
    >
      {columns.map(({ stage }) => {
        const tasks = visible.filter((task) => task.stageId === stage.id);
        return (
          <section
            key={stage.id}
            aria-label={`Bước ${stage.ordinal}: ${stage.title}`}
            onDragOver={(event) => {
              if (!canWrite || !dragging) return;
              event.preventDefault();
              setDragOver(stage.id);
            }}
            onDragLeave={() => setDragOver((value) => (value === stage.id ? null : value))}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(null);
              const taskId = event.dataTransfer.getData("text/plain") || dragging;
              const from = columns.find((column) => column.tasks.some((task) => task.id === taskId));
              if (taskId && from) onMove(taskId, stage.id, from.stage.id);
              setDragging(null);
            }}
            className={`flex min-w-[17.5rem] flex-col rounded-xl border bg-soil-100/60 p-3 transition ${
              dragOver === stage.id ? "border-leaf-500 bg-leaf-50" : "border-soil-200"
            }`}
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-soil-900">
                <span className="mr-1.5 text-leaf-700">{stage.ordinal}</span>
                {stage.title}
              </h3>
              <span className="flex items-center gap-1.5">
                {stage.approvedAt && <Badge tone="leaf">Đã duyệt</Badge>}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums text-soil-600">
                  {tasks.length}
                </span>
              </span>
            </header>

            <ul className="flex flex-1 flex-col gap-2">
              {tasks.map((task) => (
                <li key={task.id}>
                  <TaskCardView
                    task={task}
                    stage={stage}
                    columns={columns}
                    now={now}
                    canWrite={canWrite}
                    pending={pending}
                    projectId={projectId}
                    assigneeName={nameOf(task.assigneeId)}
                    dragging={dragging === task.id}
                    onDragStart={() => setDragging(task.id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setDragOver(null);
                    }}
                    onMove={(stageId) => onMove(task.id, stageId, stage.id)}
                    onStatus={(status) => onStatus(task.id, status)}
                  />
                </li>
              ))}

              {tasks.length === 0 && (
                <li className="rounded-lg border border-dashed border-soil-300 px-3 py-6 text-center text-xs text-soil-500">
                  {isFilterActive(filter) ? "Không có việc khớp bộ lọc" : "Chưa có công việc"}
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
