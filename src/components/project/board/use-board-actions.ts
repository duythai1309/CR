"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useOptimistic, useState, useTransition } from "react";
import {
  groupTasksByColumn,
  nextPosition,
  placeIntoColumn,
  reorderColumns,
  reorderWithinColumn,
  statusForColumnName,
  type BoardColumnView,
  type BoardTaskCard,
  type TaskStatus,
} from "@/components/project/rules";
import {
  applyColumnOrder,
  bulkUpdateTasks,
  createBoardColumn,
  deleteBoardColumn,
  moveTask,
  moveTaskToColumn,
  renameBoardColumn,
  reorderTasksInColumn,
  setTaskStatus,
} from "@/app/du-an/[id]/actions";

/* ------------------------------------------------------- phần thuần, kiểm thử được */

/** Vị trí mới cần ghi, do `reorderWithinColumn` / `placeIntoColumn` tính ra. */
export interface PositionRow {
  id: string;
  position: number;
}

/**
 * Thay đổi hiển thị NGAY, trước khi máy chủ trả lời.
 *
 * Ba thao tác card đều quy về đây: đổi cột (`taskId` + `columnId`, kèm `status` khi cột
 * đích ánh xạ được), đổi trạng thái (`taskId` + `status`), và sắp xếp lại (`rows`).
 */
export interface OptimisticPatch {
  taskId?: string;
  columnId?: string;
  status?: TaskStatus;
  rows?: PositionRow[];
}

/**
 * Áp thay đổi lạc quan lên danh sách card.
 *
 * **Không được sửa tại chỗ.** `useOptimistic` khôi phục trạng thái cũ bằng cách vứt lớp
 * lạc quan đi và quay về đúng mảng gốc — nếu hàm này sửa thẳng vào mảng hay vào object
 * card, mảng gốc đã hỏng và "quay về" sẽ trả người dùng về một trạng thái sai. Đó chính
 * là chỗ cập nhật lạc quan hay hỏng nhất, nên nó có test riêng.
 */
export function applyOptimisticPatch(
  tasks: BoardTaskCard[],
  patch: OptimisticPatch,
): BoardTaskCard[] {
  const positions = new Map((patch.rows ?? []).map((row) => [row.id, row.position]));

  return tasks.map((task) => {
    const isTarget = patch.taskId === task.id;
    const nextPos = positions.get(task.id);
    if (!isTarget && nextPos === undefined) return task;

    return {
      ...task,
      ...(isTarget && patch.columnId !== undefined ? { columnId: patch.columnId } : {}),
      ...(isTarget && patch.status !== undefined ? { status: patch.status } : {}),
      ...(nextPos !== undefined ? { position: nextPos } : {}),
    };
  });
}

/** Kết cục của một lượt ghi: giữ hay bỏ thay đổi lạc quan, và nói gì với người dùng. */
export interface WriteOutcome {
  /** `false` nghĩa là vứt lớp lạc quan, giao diện quay về đúng dữ liệu máy chủ đang có. */
  kept: boolean;
  error: string | null;
  notice: string | null;
  /** Chỉ tải lại khi thật sự có gì đó đã đổi ở máy chủ. */
  refresh: boolean;
}

/**
 * Quyết định sau khi server action trả lời.
 *
 * Server action ở dự án này trả `string | null`: một chuỗi là THÔNG BÁO LỖI, `null` là
 * thành công. Có lỗi thì bỏ thay đổi lạc quan VÀ hiện nguyên văn lỗi — tuyệt đối không
 * nuốt. Đây là hồ sơ tín chỉ carbon: để người dùng tưởng đã lưu trong khi chưa lưu là
 * hỏng nặng hơn hẳn việc thao tác chậm.
 */
export function settleWrite(message: string | null, success?: string): WriteOutcome {
  if (message !== null && message !== "")
    return { kept: false, error: message, notice: null, refresh: false };
  return { kept: true, error: null, notice: success ?? null, refresh: true };
}

/**
 * Trạng thái mà `status` sẽ mang sau khi thả vào một cột — chép đúng cầu tạm của
 * `moveTaskToColumn` phía máy chủ, để hiển thị lạc quan không nói khác kết quả thật.
 */
export function bridgedStatusFor(columnName: string): TaskStatus | undefined {
  return statusForColumnName(columnName) ?? undefined;
}

/* --------------------------------------------------------------------------- hook */

/** Gom card đang HIỆN theo cột — tách riêng để `board.tsx` chỉ còn việc lắp ráp. */
export function useShownBoard(boardColumns: BoardColumnView[], visible: BoardTaskCard[]) {
  return useMemo(() => groupTasksByColumn(boardColumns, visible), [boardColumns, visible]);
}

/**
 * Mọi đường GHI của bảng công việc, kèm lớp hiển thị lạc quan.
 *
 * Ba thao tác card — đổi cột, đổi trạng thái, sắp xếp lại — hiện kết quả NGAY rồi mới gọi
 * server action ở nền. `useOptimistic` giữ lớp đó cho tới khi transition kết thúc; lúc đó
 * hoặc dữ liệu mới đã về (thành công), hoặc lớp bị vứt và giao diện quay lại đúng dữ liệu
 * cũ (lỗi). Không có đường nào giữ lại thay đổi mà chưa ghi được.
 */
export function useBoardActions({
  projectId,
  boardColumns,
  tasks,
  canWrite,
}: {
  projectId: string;
  boardColumns: BoardColumnView[];
  /** Card như máy chủ đang thấy — nguồn sự thật mà lớp lạc quan quay về khi lỗi. */
  tasks: BoardTaskCard[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [optimisticTasks, addOptimistic] = useOptimistic(tasks, applyOptimisticPatch);

  const fullBoard = useMemo(
    () => groupTasksByColumn(boardColumns, optimisticTasks),
    [boardColumns, optimisticTasks],
  );

  /**
   * Chạy một server action.
   *
   * `patch` được áp NGAY trong transition nên giao diện nhúc nhích trước khi đi mạng.
   * `router.refresh()` nằm trong cùng transition, nên lớp lạc quan còn nguyên tới khi dữ
   * liệu thật về — không có nháy giữa chừng.
   */
  const run = useCallback(
    (
      action: () => Promise<string | null>,
      options: { patch?: OptimisticPatch; success?: string } = {},
    ) => {
      setError(null);
      setNotice(null);
      startTransition(async () => {
        if (options.patch) addOptimistic(options.patch);

        const outcome = settleWrite(await action(), options.success);
        if (outcome.error) setError(outcome.error);
        if (outcome.notice) setNotice(outcome.notice);
        if (outcome.refresh) router.refresh();
      });
    },
    [router, addOptimistic],
  );

  function moveToStage(taskId: string, stageId: string, currentStageId: string) {
    if (!canWrite || stageId === currentStageId) return;
    const targetTasks = optimisticTasks.filter((task) => task.stageId === stageId);
    run(() => moveTask(projectId, taskId, stageId, nextPosition(targetTasks)));
  }

  function moveToStatus(taskId: string, status: string, currentStatus?: string) {
    if (!canWrite || status === currentStatus) return;
    run(() => setTaskStatus(projectId, taskId, status), {
      patch: { taskId, status: status as TaskStatus },
    });
  }

  /** Thả card: cùng cột thì chỉ đổi thứ tự, khác cột thì đổi `column_id` rồi mới xếp chỗ. */
  function dropTask(taskId: string, columnId: string, index: number) {
    if (!canWrite) return;
    const task = optimisticTasks.find((item) => item.id === taskId);
    const target = fullBoard.columns.find((entry) => entry.column.id === columnId);
    if (!task || !target) return;

    if (task.columnId === columnId) {
      const rows = reorderWithinColumn(target.tasks, taskId, index);
      if (rows.length === 0) return;
      run(() => reorderTasksInColumn(projectId, rows), { patch: { rows } });
      return;
    }

    const rows = placeIntoColumn(target.tasks, task, index);
    run(() => moveTaskToColumn(projectId, taskId, columnId, target.column.name, rows), {
      patch: { taskId, columnId, status: bridgedStatusFor(target.column.name), rows },
    });
  }

  /**
   * Chuyển cột bằng ô chọn trên card — card đi xuống CUỐI cột đích.
   *
   * Đi qua đúng `dropTask` như kéo-thả, nên hai lối chỉ có một đường ghi và một chỗ để
   * sai. WCAG 2.2 "Dragging Movements" đòi lối không-kéo này.
   */
  function moveToColumn(taskId: string, columnId: string, currentColumnId: string | null) {
    if (!canWrite || !columnId || columnId === currentColumnId) return;
    const target = fullBoard.columns.find((entry) => entry.column.id === columnId);
    if (!target) return;
    dropTask(taskId, columnId, target.tasks.length);
  }

  function dropColumn(columnId: string, index: number) {
    if (!canWrite) return;
    const rows = reorderColumns(boardColumns, columnId, index);
    if (rows.length === 0) return;
    run(() => applyColumnOrder(projectId, rows));
  }

  function bulk(ids: string[], patch: { status?: string; stageId?: string }, label: string) {
    if (ids.length === 0) return;
    run(() => bulkUpdateTasks(projectId, ids, patch), {
      success: `Đã ${label} cho ${ids.length} công việc.`,
    });
  }

  return {
    /** Card kèm lớp lạc quan — lọc và vẽ đều phải đi từ đây, không từ prop gốc. */
    tasks: optimisticTasks,
    pending,
    error,
    notice,
    fullBoard,
    refresh: router.refresh,
    moveToStage,
    moveToStatus,
    moveToColumn,
    dropTask,
    dropColumn,
    bulk,
    renameColumn: (columnId: string, name: string) =>
      run(() => renameBoardColumn(projectId, columnId, name)),
    deleteColumn: (columnId: string) =>
      run(() => deleteBoardColumn(projectId, columnId), { success: "Đã xoá cột." }),
    addColumn: (name: string) =>
      run(() => createBoardColumn(projectId, name), { success: "Đã thêm cột." }),
  };
}
