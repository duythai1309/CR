"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  groupTasksByColumn,
  nextPosition,
  placeIntoColumn,
  reorderColumns,
  reorderWithinColumn,
  type BoardColumnView,
  type BoardTaskCard,
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

/**
 * Mọi đường GHI của bảng công việc.
 *
 * Gom về một chỗ vì chúng chia chung ba thứ: `run` (bọc transition, dịch lỗi, làm tươi),
 * hai bản gom cột, và điều kiện `canWrite`. Để rải trong `board.tsx` thì mỗi lần thêm một
 * thao tác lại phải nhớ đủ ba thứ đó.
 *
 * Hai bản gom KHÔNG thể thay nhau: bản ĐẦY ĐỦ để tính `position` và chỗ chèn, bản ĐANG
 * HIỆN để vẽ. Tính vị trí trên bản đã bị bộ lọc cắt bớt sẽ đặt card sai chỗ so với card
 * đang bị ẩn.
 */
export function useBoardActions({
  projectId,
  boardColumns,
  allTasks,
  visible,
  canWrite,
}: {
  projectId: string;
  boardColumns: BoardColumnView[];
  allTasks: BoardTaskCard[];
  visible: BoardTaskCard[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fullBoard = useMemo(
    () => groupTasksByColumn(boardColumns, allTasks),
    [boardColumns, allTasks],
  );
  const shownBoard = useMemo(
    () => groupTasksByColumn(boardColumns, visible),
    [boardColumns, visible],
  );

  // `pending` còn bật cho tới khi dữ liệu mới được làm tươi, không chỉ tới lúc action trả lời.
  const run = useCallback(
    (action: () => Promise<string | null>, success?: string) => {
      setError(null);
      setNotice(null);
      startTransition(async () => {
        const message = await action();
        if (message) setError(message);
        else {
          if (success) setNotice(success);
          router.refresh();
        }
      });
    },
    [router],
  );

  function moveToStage(taskId: string, stageId: string, currentStageId: string) {
    if (!canWrite || stageId === currentStageId) return;
    const targetTasks = allTasks.filter((task) => task.stageId === stageId);
    run(() => moveTask(projectId, taskId, stageId, nextPosition(targetTasks)));
  }

  function moveToStatus(taskId: string, status: string, currentStatus?: string) {
    if (!canWrite || status === currentStatus) return;
    run(() => setTaskStatus(projectId, taskId, status));
  }

  /** Thả card: cùng cột thì chỉ đổi thứ tự, khác cột thì đổi `column_id` rồi mới xếp chỗ. */
  function dropTask(taskId: string, columnId: string, index: number) {
    if (!canWrite) return;
    const task = allTasks.find((item) => item.id === taskId);
    const target = fullBoard.columns.find((entry) => entry.column.id === columnId);
    if (!task || !target) return;

    if (task.columnId === columnId) {
      const rows = reorderWithinColumn(target.tasks, taskId, index);
      if (rows.length === 0) return;
      run(() => reorderTasksInColumn(projectId, rows));
      return;
    }

    const rows = placeIntoColumn(target.tasks, task, index);
    run(() => moveTaskToColumn(projectId, taskId, columnId, target.column.name, rows));
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
    run(() => bulkUpdateTasks(projectId, ids, patch), `Đã ${label} cho ${ids.length} công việc.`);
  }

  return {
    pending,
    error,
    notice,
    fullBoard,
    shownBoard,
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
      run(() => deleteBoardColumn(projectId, columnId), "Đã xoá cột."),
    addColumn: (name: string) =>
      run(() => createBoardColumn(projectId, name), "Đã thêm cột."),
  };
}
