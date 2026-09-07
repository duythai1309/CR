"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Alert, Kbd } from "@/components/ui";
import {
  EMPTY_TASK_FILTER,
  columnDeleteBlocker,
  groupTasksByColumn,
  nextPosition,
  placeIntoColumn,
  reorderColumns,
  reorderWithinColumn,
  type BoardColumnView,
  type BoardTaskCard,
  type StageView,
  type TaskFilter,
  type TaskSort,
} from "@/components/project/rules";
import { AddColumn } from "@/components/project/board/column-manager";
import { BoardColumns, useBoardDragDrop } from "@/components/project/board/drag-drop";
import { useFilteredSortedTasks } from "@/components/project/board/filter-sort";
import { TaskList, useTaskSelection } from "@/components/project/board/multi-select";
import { ShortcutHelp, useBoardShortcuts } from "@/components/project/board/shortcut-help";
import { TaskQuickPanel } from "@/components/project/board/task-panel";
import { BoardToolbar, type BoardView } from "@/components/project/board/toolbar";
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
} from "./actions";

export interface BoardMember {
  userId: string;
  fullName: string;
}

/**
 * Bảng công việc của một dự án — cột do người dùng tự tạo.
 *
 * Cột đến từ `project_board_columns` chứ không còn từ `TASK_STATUSES`: người dùng thêm,
 * đổi tên, xoá và kéo sắp xếp tuỳ ý. `status` vẫn còn và vẫn ghi được, nhưng nó KHÔNG còn
 * quyết định card nằm ở cột nào.
 *
 * **Kéo-thả vẫn không bao giờ là đường duy nhất.** Hai ô chọn trên mỗi card vẫn còn, panel
 * sửa nhanh mở bằng chuột lẫn bàn phím, và chế độ danh sách cộng thao tác hàng loạt là một
 * đường thứ ba hoàn toàn bằng bàn phím.
 */

const VIEW_KEY = "acp.board.view";

export function ProjectBoard({
  projectId,
  boardColumns,
  tasks,
  stages,
  members,
  assignableMembers,
  canWrite,
  viewerId,
  initialFilter,
  newTaskForm,
}: {
  projectId: string;
  boardColumns: BoardColumnView[];
  tasks: BoardTaskCard[];
  stages: StageView[];
  members: BoardMember[];
  /** Chỉ Đơn vị phát triển mới nhận được việc — panel sửa nhanh dùng danh sách này. */
  assignableMembers: BoardMember[];
  canWrite: boolean;
  /** Để lọc "việc của tôi" — `assignee_id` được so với chính người đang xem. */
  viewerId: string | null;
  /** Bộ lọc mở sẵn từ query string, để trang Thành viên trỏ thẳng vào đúng người. */
  initialFilter?: Partial<TaskFilter>;
  /** Form thêm việc, do trang truyền vào để phím `c` mở được nó. */
  newTaskForm?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const { allTasks, hidden, listRows, nameOf, now, stageOf, visible } = useFilteredSortedTasks({
    tasks,
    stages,
    members,
    filter,
    sort,
    viewerId,
  });
  const { selected, setSelected, toggle } = useTaskSelection(visible);
  const dragDrop = useBoardDragDrop();

  // Hai lần gom: bản ĐẦY ĐỦ để tính chỗ chèn và `position`, bản ĐANG HIỆN để vẽ.
  // Tính vị trí trên bản đã bị bộ lọc cắt bớt sẽ đặt card sai chỗ so với card đang ẩn.
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

  function dropColumn(columnId: string, index: number) {
    if (!canWrite) return;
    const rows = reorderColumns(boardColumns, columnId, index);
    if (rows.length === 0) return;
    run(() => applyColumnOrder(projectId, rows));
  }

  const changeFilter = <K extends keyof TaskFilter>(key: K, value: TaskFilter[K]) =>
    setFilter((current) => ({ ...current, [key]: value }));

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
  const closeHelp = useCallback(() => setShowHelp(false), []);
  const toggleHelp = useCallback(() => setShowHelp((current) => !current), []);
  const closePanel = useCallback(() => setOpenTaskId(null), []);
  const onPanelSaved = useCallback(() => {
    setOpenTaskId(null);
    router.refresh();
  }, [router]);

  useBoardShortcuts({
    searchRef,
    newTaskRef,
    hasNewTaskForm: Boolean(newTaskForm),
    onViewChange: changeView,
    onClearFilter: clearFilter,
    onToggleMine: toggleMine,
    onToggleBlocking: toggleBlocking,
    onOpenNewTask: openNewTask,
    onCloseHelp: closeHelp,
    onToggleHelp: toggleHelp,
  });

  function bulk(ids: string[], patch: { status?: string; stageId?: string }, label: string) {
    if (ids.length === 0) return;
    run(() => bulkUpdateTasks(projectId, ids, patch), `Đã ${label} cho ${ids.length} công việc.`);
  }

  const openTask = openTaskId
    ? (allTasks.find((task) => task.id === openTaskId) ?? null)
    : null;

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="ok">{notice}</Alert>}

      {!canWrite && (
        <Alert tone="warn" title="Chỉ xem">
          Vai trò của bạn trong dự án này không cho phép sửa công việc. Lọc, sắp xếp và đổi
          chế độ xem vẫn dùng được.
        </Alert>
      )}

      {boardColumns.length === 0 && (
        <Alert tone="warn" title="Bảng chưa có cột nào">
          Thêm cột đầu tiên để bắt đầu xếp việc. Nếu bảng vừa được nâng cấp mà vẫn trống,
          rất có thể migration 0021 chưa được áp lên cơ sở dữ liệu.
        </Alert>
      )}

      {newTaskForm && (
        <div className="rounded-xl border border-soil-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setShowNewTask((current) => !current)}
            aria-expanded={showNewTask}
            className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
          >
            <span className="font-semibold text-soil-900">Thêm công việc</span>
            <span className="flex items-center gap-2 text-xs text-soil-600">
              <Kbd>c</Kbd>
              <span aria-hidden>{showNewTask ? "▲" : "▼"}</span>
            </span>
          </button>
          {showNewTask && (
            <div ref={newTaskRef} className="border-t border-soil-200 px-5 py-4">
              {newTaskForm}
            </div>
          )}
        </div>
      )}

      <BoardToolbar
        view={view}
        filter={filter}
        sort={sort}
        stages={stages}
        members={members}
        viewerId={viewerId}
        visibleCount={visible.length}
        totalCount={allTasks.length}
        hiddenCount={hidden}
        searchRef={searchRef}
        onViewChange={changeView}
        onFilterChange={changeFilter}
        onSortChange={setSort}
        onToggleHelp={toggleHelp}
        onClearFilter={clearFilter}
      />

      {showHelp && <ShortcutHelp />}

      {view === "board" ? (
        <BoardColumns
          columns={shownBoard.columns}
          fullColumns={fullBoard.columns}
          orphans={shownBoard.orphans}
          stages={stages}
          filter={filter}
          now={now}
          canWrite={canWrite}
          pending={pending}
          nameOf={nameOf}
          dragDrop={dragDrop}
          onMoveStage={moveToStage}
          onStatus={moveToStatus}
          onDropTask={dropTask}
          onDropColumn={dropColumn}
          onOpenTask={setOpenTaskId}
          onRenameColumn={(columnId, name) =>
            run(() => renameBoardColumn(projectId, columnId, name))
          }
          onDeleteColumn={(columnId) =>
            run(() => deleteBoardColumn(projectId, columnId), "Đã xoá cột.")
          }
          deleteBlockerOf={(columnId) =>
            columnDeleteBlocker(columnId, allTasks, boardColumns.length)
          }
          trailing={
            canWrite ? (
              <AddColumn
                pending={pending}
                onAdd={(name) => run(() => createBoardColumn(projectId, name), "Đã thêm cột.")}
              />
            ) : null
          }
        />
      ) : (
        <TaskList
          projectId={projectId}
          rows={listRows}
          stages={stages}
          stageOf={stageOf}
          nameOf={nameOf}
          now={now}
          canWrite={canWrite}
          pending={pending}
          selected={selected}
          onToggle={toggle}
          onToggleAll={(checked) =>
            setSelected(checked ? new Set(listRows.map((task) => task.id)) : new Set())
          }
          onStatus={(taskId, status) => moveToStatus(taskId, status)}
          onMove={moveToStage}
          onBulk={bulk}
        />
      )}

      {openTask && (
        <TaskQuickPanel
          projectId={projectId}
          task={openTask}
          stages={stages}
          members={assignableMembers}
          canWrite={canWrite}
          onClose={closePanel}
          onSaved={onPanelSaved}
        />
      )}

      {canWrite && view === "board" && (
        <p className="text-xs text-soil-600">
          Kéo card sang cột khác để chuyển cột, kéo lên xuống trong một cột để đổi thứ tự,
          và kéo tiêu đề cột để sắp xếp lại bảng. Bấm vào tên việc để sửa nhanh tại chỗ. Cần
          đổi nhiều việc một lúc thì sang chế độ{" "}
          <button
            type="button"
            onClick={() => changeView("list")}
            className="font-medium text-leaf-800 hover:underline"
          >
            Danh sách
          </button>
          .
        </p>
      )}
    </div>
  );
}
