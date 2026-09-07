"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Alert, Kbd } from "@/components/ui";
import {
  EMPTY_TASK_FILTER,
  nextPosition,
  type StageView,
  type TaskCard,
  type TaskFilter,
  type TaskSort,
} from "@/components/project/rules";
import { BoardColumns, useBoardDragDrop } from "@/components/project/board/drag-drop";
import { useFilteredSortedTasks } from "@/components/project/board/filter-sort";
import { TaskList, useTaskSelection } from "@/components/project/board/multi-select";
import { ShortcutHelp, useBoardShortcuts } from "@/components/project/board/shortcut-help";
import { BoardToolbar, type BoardView } from "@/components/project/board/toolbar";
import { bulkUpdateTasks, moveTask, setTaskStatus } from "./actions";

export interface BoardMember {
  userId: string;
  fullName: string;
}

/**
 * Bảng công việc của một dự án.
 *
 * Mô hình giữ nguyên từ Module A: **cột là bước**, `status` là trục riêng của card. Thứ
 * được làm lại là cách dùng — người quen Jira cần lọc, sắp xếp, chọn nhiều, thao tác hàng
 * loạt và phím tắt, chứ không chỉ một bảng kéo-thả.
 *
 * **Kéo-thả vẫn không bao giờ là đường duy nhất.** Hai ô chọn trên mỗi card vẫn còn, và
 * chế độ danh sách cộng thao tác hàng loạt là một đường thứ ba hoàn toàn bằng bàn phím.
 * Phím tắt tự nhường khi con trỏ đang ở trong một ô nhập.
 */

const VIEW_KEY = "acp.board.view";

export function ProjectBoard({
  projectId,
  columns,
  members,
  canWrite,
  viewerId,
  initialFilter,
  newTaskForm,
}: {
  projectId: string;
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
  members: BoardMember[];
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

  const { allTasks, hidden, listRows, nameOf, now, stageOf, visible } =
    useFilteredSortedTasks({ columns, members, filter, sort, viewerId });
  const { selected, setSelected, toggle } = useTaskSelection(visible);
  const dragDrop = useBoardDragDrop();

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

  function moveTo(taskId: string, stageId: string, currentStageId: string) {
    if (!canWrite || stageId === currentStageId) return;
    const target = columns.find((column) => column.stage.id === stageId);
    run(() => moveTask(projectId, taskId, stageId, nextPosition(target?.tasks ?? [])));
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

  function bulk(
    ids: string[],
    patch: { status?: string; stageId?: string },
    label: string,
  ) {
    if (ids.length === 0) return;
    run(
      () => bulkUpdateTasks(projectId, ids, patch),
      `Đã ${label} cho ${ids.length} công việc.`,
    );
  }

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
        columns={columns}
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
          projectId={projectId}
          columns={columns}
          visible={visible}
          filter={filter}
          now={now}
          canWrite={canWrite}
          pending={pending}
          nameOf={nameOf}
          dragDrop={dragDrop}
          onMove={moveTo}
          onStatus={(taskId, status) => run(() => setTaskStatus(projectId, taskId, status))}
        />
      ) : (
        <TaskList
          projectId={projectId}
          rows={listRows}
          columns={columns}
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
          onStatus={(taskId, status) => run(() => setTaskStatus(projectId, taskId, status))}
          onMove={moveTo}
          onBulk={bulk}
        />
      )}

      {canWrite && view === "board" && (
        <p className="text-xs text-soil-600">
          Kéo card sang cột khác để đổi bước, hoặc dùng ô chọn <em>Bước</em> ngay trên card —
          hai cách cho cùng một kết quả. Cần đổi nhiều việc một lúc thì sang chế độ{" "}
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
