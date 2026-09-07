"use client";

import { Fragment, useState, type Dispatch, type SetStateAction } from "react";
import {
  insertIndexFor,
  isFilterActive,
  type BoardColumnView,
  type BoardTaskCard,
  type StageView,
  type TaskFilter,
} from "@/components/project/rules";
import { ColumnHeader } from "./column-manager";
import { TaskCardView } from "./task-card";

/** Thứ đang được kéo — card hay cả một cột. */
export type BoardDragItem = { kind: "task" | "column"; id: string } | null;

/** Chỗ sắp thả card: cột nào, và chèn vào vị trí thứ mấy của cột đó. */
export interface TaskDropSpot {
  columnId: string;
  /** Đếm trên danh sách ĐÃ BỎ card đang kéo ra — đúng thứ `reorderWithinColumn` cần. */
  index: number;
}

export interface BoardDragDropState {
  drag: BoardDragItem;
  taskDrop: TaskDropSpot | null;
  columnDrop: number | null;
  setDrag: Dispatch<SetStateAction<BoardDragItem>>;
  setTaskDrop: Dispatch<SetStateAction<TaskDropSpot | null>>;
  setColumnDrop: Dispatch<SetStateAction<number | null>>;
  reset: () => void;
}

export function useBoardDragDrop(): BoardDragDropState {
  const [drag, setDrag] = useState<BoardDragItem>(null);
  const [taskDrop, setTaskDrop] = useState<TaskDropSpot | null>(null);
  const [columnDrop, setColumnDrop] = useState<number | null>(null);

  const reset = () => {
    setDrag(null);
    setTaskDrop(null);
    setColumnDrop(null);
  };

  return { drag, taskDrop, columnDrop, setDrag, setTaskDrop, setColumnDrop, reset };
}

export function BoardColumns({
  columns,
  fullColumns,
  orphans,
  stages,
  filter,
  now,
  canWrite,
  pending,
  nameOf,
  dragDrop,
  onMoveStage,
  onColumn,
  onDropTask,
  onDropColumn,
  onOpenTask,
  onRenameColumn,
  onDeleteColumn,
  deleteBlockerOf,
  trailing,
}: {
  /** Card đang hiện sau bộ lọc, đã gom theo cột. */
  columns: Array<{ column: BoardColumnView; tasks: BoardTaskCard[] }>;
  /** Toàn bộ card theo cột, kể cả card bị lọc ẩn — dùng để tính chỗ chèn. */
  fullColumns: Array<{ column: BoardColumnView; tasks: BoardTaskCard[] }>;
  orphans: BoardTaskCard[];
  stages: StageView[];
  filter: TaskFilter;
  now: Date;
  canWrite: boolean;
  pending: boolean;
  nameOf: (id: string | null) => string;
  dragDrop: BoardDragDropState;
  onMoveStage: (taskId: string, stageId: string, currentStageId: string) => void;
  /** Chuyển card sang cột khác bằng ô chọn — lối đi không-kéo cho cùng thao tác. */
  onColumn: (taskId: string, columnId: string, currentColumnId: string | null) => void;
  onDropTask: (taskId: string, columnId: string, index: number) => void;
  onDropColumn: (columnId: string, index: number) => void;
  onOpenTask: (taskId: string) => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onDeleteColumn: (columnId: string) => void;
  deleteBlockerOf: (columnId: string) => string | null;
  /** Ô "Thêm cột" — nằm TRONG dải cuộn ngang để nó trôi cùng các cột, như Jira. */
  trailing?: React.ReactNode;
}) {
  const { drag, taskDrop, columnDrop, setDrag, setTaskDrop, setColumnDrop, reset } = dragDrop;

  const fullOf = (columnId: string) =>
    fullColumns.find((entry) => entry.column.id === columnId)?.tasks ?? [];

  // Ô chọn cột trên mỗi card cần danh sách cột phẳng, theo đúng thứ tự đang hiện.
  const columnList = fullColumns.map((entry) => entry.column);

  /** Danh sách của một cột sau khi bỏ card đang kéo — hệ toạ độ mà `taskDrop.index` dùng. */
  const restOf = (columnId: string) =>
    drag?.kind === "task"
      ? fullOf(columnId).filter((task) => task.id !== drag.id)
      : fullOf(columnId);

  const restIndexOf = (columnId: string, taskId: string) =>
    restOf(columnId).findIndex((task) => task.id === taskId);

  /** Chỗ thả card, tính từ nửa trên / nửa dưới của card đang di chuột qua. */
  function hoverCard(
    event: React.DragEvent,
    columnId: string,
    shown: BoardTaskCard[],
    shownIndex: number,
  ) {
    if (!canWrite || drag?.kind !== "task") return;
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.getBoundingClientRect();
    const d = event.clientY < box.top + box.height / 2 ? shownIndex : shownIndex + 1;
    setTaskDrop({ columnId, index: insertIndexFor(fullOf(columnId), shown, d, drag.id) });
  }

  /** Thả vào khoảng trống của cột — đi xuống cuối. */
  function hoverColumnBody(event: React.DragEvent, columnId: string, shown: BoardTaskCard[]) {
    if (!canWrite || drag?.kind !== "task") return;
    event.preventDefault();
    event.stopPropagation();
    setTaskDrop({
      columnId,
      index: insertIndexFor(fullOf(columnId), shown, shown.length, drag.id),
    });
  }

  /**
   * Chỗ thả cột, đổi sang danh sách ĐÃ BỎ cột đang kéo ra — đúng hệ toạ độ mà
   * `reorderColumns` dùng. Không đổi thì kéo sang phải luôn lệch một ô.
   */
  function restColumnIndex(movingId: string, shownIndex: number): number {
    const current = columns.findIndex((entry) => entry.column.id === movingId);
    return current >= 0 && shownIndex > current ? shownIndex - 1 : shownIndex;
  }

  function dropHere() {
    if (drag?.kind === "task" && taskDrop) onDropTask(drag.id, taskDrop.columnId, taskDrop.index);
    reset();
  }

  const indicator = (
    <li aria-hidden className="h-0.5 rounded-full bg-leaf-600" />
  );

  return (
    <div
      className={`flex gap-4 overflow-x-auto pb-2 ${pending ? "opacity-70" : ""}`}
      onDragEnd={reset}
    >
      {columns.map(({ column, tasks }, columnIndex) => {
        const isDraggingColumn = drag?.kind === "column" && drag.id === column.id;
        const dropping = taskDrop?.columnId === column.id;

        return (
          <section
            key={column.id}
            aria-label={`Cột ${column.name}`}
            onDragOver={(event) => {
              if (!canWrite) return;
              if (drag?.kind === "column") {
                event.preventDefault();
                const box = event.currentTarget.getBoundingClientRect();
                setColumnDrop(
                  event.clientX < box.left + box.width / 2 ? columnIndex : columnIndex + 1,
                );
                return;
              }
              // Kéo card qua phần ngoài danh sách (đầu cột, khoảng đệm): coi như thả xuống
              // cuối cột này. Không có nhánh này thì thả ở đầu cột rơi vào cột hover trước đó.
              if (drag?.kind === "task") {
                event.preventDefault();
                setTaskDrop({ columnId: column.id, index: restOf(column.id).length });
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (drag?.kind === "column" && columnDrop !== null) {
                onDropColumn(drag.id, restColumnIndex(drag.id, columnDrop));
                reset();
                return;
              }
              dropHere();
            }}
            className={`flex w-[18rem] shrink-0 flex-col rounded-xl border bg-soil-100/60 p-3 transition ${
              dropping ? "border-leaf-500 bg-leaf-50" : "border-soil-200"
            } ${isDraggingColumn ? "opacity-50" : ""} ${
              columnDrop === columnIndex && drag?.kind === "column"
                ? "border-l-4 border-l-leaf-600"
                : ""
            }`}
          >
            <ColumnHeader
              column={column}
              count={tasks.length}
              canWrite={canWrite}
              pending={pending}
              deleteBlocker={deleteBlockerOf(column.id)}
              onDragStart={() => setDrag({ kind: "column", id: column.id })}
              onRename={(name) => onRenameColumn(column.id, name)}
              onDelete={() => onDeleteColumn(column.id)}
            />

            <ul
              className="flex flex-1 flex-col gap-2"
              onDragOver={(event) => hoverColumnBody(event, column.id, tasks)}
            >
              {tasks.map((task, shownIndex) => (
                <Fragment key={task.id}>
                  {dropping && taskDrop.index === restIndexOf(column.id, task.id) && indicator}
                  <li onDragOver={(event) => hoverCard(event, column.id, tasks, shownIndex)}>
                    <TaskCardView
                      task={task}
                      stage={stages.find((stage) => stage.id === task.stageId)}
                      stages={stages}
                      columns={columnList}
                      now={now}
                      canWrite={canWrite}
                      pending={pending}
                      assigneeName={nameOf(task.assigneeId)}
                      dragging={drag?.kind === "task" && drag.id === task.id}
                      onDragStart={() => setDrag({ kind: "task", id: task.id })}
                      onDragEnd={reset}
                      onOpen={() => onOpenTask(task.id)}
                      onMove={(stageId) => onMoveStage(task.id, stageId, task.stageId)}
                      onColumn={(next) => onColumn(task.id, next, task.columnId)}
                    />
                  </li>
                </Fragment>
              ))}

              {dropping && taskDrop.index >= restOf(column.id).length && indicator}

              {tasks.length === 0 && (
                <li className="rounded-lg border border-dashed border-soil-300 px-3 py-6 text-center text-xs text-soil-500">
                  {isFilterActive(filter) ? "Không có việc khớp bộ lọc" : "Kéo việc vào đây"}
                </li>
              )}
            </ul>
          </section>
        );
      })}

      {orphans.length > 0 && (
        <section
          aria-label="Chưa xếp cột"
          className="flex w-[18rem] shrink-0 flex-col rounded-xl border border-dashed border-carbon-400 bg-carbon-50/60 p-3"
        >
          <header className="mb-3">
            <h3 className="text-sm font-semibold text-soil-900">Chưa xếp cột</h3>
            <p className="mt-1 text-xs text-soil-600">
              {orphans.length} việc chưa thuộc cột nào. Kéo sang một cột để xếp chỗ.
            </p>
          </header>
          <ul className="flex flex-1 flex-col gap-2">
            {orphans.map((task) => (
              <li key={task.id}>
                <TaskCardView
                  task={task}
                  stage={stages.find((stage) => stage.id === task.stageId)}
                  stages={stages}
                  columns={columnList}
                  now={now}
                  canWrite={canWrite}
                  pending={pending}
                  assigneeName={nameOf(task.assigneeId)}
                  dragging={drag?.kind === "task" && drag.id === task.id}
                  onDragStart={() => setDrag({ kind: "task", id: task.id })}
                  onDragEnd={reset}
                  onOpen={() => onOpenTask(task.id)}
                  onMove={(stageId) => onMoveStage(task.id, stageId, task.stageId)}
                  onColumn={(next) => onColumn(task.id, next, task.columnId)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {trailing}
    </div>
  );
}
