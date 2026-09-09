"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_TASK_FILTER, type TaskFilter, type TaskSort } from "@/components/project/rules";
import { useBoardShortcuts } from "./shortcut-help";
import type { BoardView } from "./toolbar";

const VIEW_KEY = "acp.board.view";

/**
 * Trạng thái của PHIÊN LÀM VIỆC trên bảng — không thuộc về dự án, không lưu lên máy chủ.
 *
 * Chế độ xem, bộ lọc, sắp xếp, panel nào đang mở: tất cả chỉ sống trong tab này. Tách khỏi
 * `useBoardActions` vì hai nhóm đổi vì lý do khác hẳn nhau — nhóm kia đổi khi đường ghi
 * xuống cơ sở dữ liệu đổi, nhóm này đổi khi cách người dùng nhìn bảng đổi.
 *
 * Phím tắt nối luôn ở đây vì mọi thứ chúng điều khiển đều nằm trong nhóm này.
 */
export function useBoardSession({
  initialFilter,
  hasNewTaskForm,
}: {
  initialFilter?: Partial<TaskFilter>;
  hasNewTaskForm: boolean;
}) {
  const [view, setView] = useState<BoardView>("board");
  const [filter, setFilter] = useState<TaskFilter>({ ...EMPTY_TASK_FILTER, ...initialFilter });
  const [sort, setSort] = useState<TaskSort>("stage");
  const [showHelp, setShowHelp] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const newTaskRef = useRef<HTMLDivElement>(null);

  // Chế độ xem là sở thích cá nhân trên máy này; lỗi localStorage không được làm hỏng màn hình.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === "board" || saved === "list") setView(saved);
    } catch {
      /* không có localStorage thì giữ mặc định */
    }
  }, []);

  const changeView = useCallback((next: BoardView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* chế độ xem không đáng để làm hỏng màn hình */
    }
  }, []);

  const changeFilter = useCallback(
    <K extends keyof TaskFilter>(key: K, value: TaskFilter[K]) =>
      setFilter((current) => ({ ...current, [key]: value })),
    [],
  );

  const clearFilter = useCallback(() => setFilter(EMPTY_TASK_FILTER), []);
  const toggleMine = useCallback(
    () => setFilter((current) => ({ ...current, onlyMine: !current.onlyMine })),
    [],
  );
  const toggleBlocking = useCallback(
    () => setFilter((current) => ({ ...current, onlyBlocking: !current.onlyBlocking })),
    [],
  );
  const openNewTask = useCallback(() => setShowNewTask(true), []);
  const toggleNewTask = useCallback(() => setShowNewTask((current) => !current), []);
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const toggleHelp = useCallback(() => setShowHelp((current) => !current), []);
  const closePanel = useCallback(() => setOpenTaskId(null), []);

  useBoardShortcuts({
    searchRef,
    newTaskRef,
    hasNewTaskForm,
    onViewChange: changeView,
    onClearFilter: clearFilter,
    onToggleMine: toggleMine,
    onToggleBlocking: toggleBlocking,
    onOpenNewTask: openNewTask,
    onCloseHelp: closeHelp,
    onToggleHelp: toggleHelp,
  });

  return {
    view,
    filter,
    sort,
    showHelp,
    showNewTask,
    openTaskId,
    searchRef,
    newTaskRef,
    setSort,
    setOpenTaskId,
    changeView,
    changeFilter,
    clearFilter,
    toggleNewTask,
    toggleHelp,
    closePanel,
  };
}
