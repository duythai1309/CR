"use client";

import { useCallback, type ReactNode } from "react";
import { Alert } from "@/components/ui";
import {
  columnDeleteBlocker,
  type BoardColumnView,
  type BoardTaskCard,
  type StageView,
  type TaskFilter,
} from "@/components/project/rules";
import { BoardHint, BoardNotices, NewTaskToggle } from "@/components/project/board/board-chrome";
import { AddColumn } from "@/components/project/board/column-manager";
import { BoardColumns, useBoardDragDrop } from "@/components/project/board/drag-drop";
import { useFilteredSortedTasks } from "@/components/project/board/filter-sort";
import { TaskList, useTaskSelection } from "@/components/project/board/multi-select";
import { ShortcutHelp } from "@/components/project/board/shortcut-help";
import { TaskQuickPanel } from "@/components/project/board/task-panel";
import { BoardToolbar } from "@/components/project/board/toolbar";
import { useBoardActions } from "@/components/project/board/use-board-actions";
import { useBoardSession } from "@/components/project/board/use-board-session";

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
 * Tệp này chỉ LẮP RÁP. Ba phần việc nằm ở chỗ khác: `useBoardSession` giữ trạng thái phiên
 * làm việc, `useBoardActions` giữ mọi đường ghi, `board-chrome` giữ phần khung.
 *
 * **Kéo-thả không bao giờ là đường duy nhất.** Hai ô chọn trên mỗi card — mục hồ sơ và cột
 * — làm được đúng việc mà kéo-thả làm; panel sửa nhanh mở bằng chuột lẫn bàn phím; và chế
 * độ danh sách cộng thao tác hàng loạt là một đường thứ ba hoàn toàn bằng bàn phím.
 */
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
  const session = useBoardSession({ initialFilter, hasNewTaskForm: Boolean(newTaskForm) });

  const { allTasks, hidden, listRows, nameOf, now, stageOf, visible } = useFilteredSortedTasks({
    tasks,
    stages,
    members,
    filter: session.filter,
    sort: session.sort,
    viewerId,
  });

  const board = useBoardActions({ projectId, boardColumns, allTasks, visible, canWrite });
  const { selected, setSelected, toggle } = useTaskSelection(visible);
  const dragDrop = useBoardDragDrop();

  const { closePanel } = session;
  const { refresh } = board;
  const onPanelSaved = useCallback(() => {
    closePanel();
    refresh();
  }, [closePanel, refresh]);

  const openTask = session.openTaskId
    ? (allTasks.find((task) => task.id === session.openTaskId) ?? null)
    : null;

  return (
    <div className="space-y-4">
      {board.error && <Alert tone="error">{board.error}</Alert>}
      {board.notice && <Alert tone="ok">{board.notice}</Alert>}

      <BoardNotices canWrite={canWrite} columnCount={boardColumns.length} />

      {newTaskForm && (
        <NewTaskToggle
          open={session.showNewTask}
          onToggle={session.toggleNewTask}
          panelRef={session.newTaskRef}
        >
          {newTaskForm}
        </NewTaskToggle>
      )}

      <BoardToolbar
        view={session.view}
        filter={session.filter}
        sort={session.sort}
        stages={stages}
        members={members}
        viewerId={viewerId}
        visibleCount={visible.length}
        totalCount={allTasks.length}
        hiddenCount={hidden}
        searchRef={session.searchRef}
        onViewChange={session.changeView}
        onFilterChange={session.changeFilter}
        onSortChange={session.setSort}
        onToggleHelp={session.toggleHelp}
        onClearFilter={session.clearFilter}
      />

      {session.showHelp && <ShortcutHelp />}

      {session.view === "board" ? (
        <BoardColumns
          columns={board.shownBoard.columns}
          fullColumns={board.fullBoard.columns}
          orphans={board.shownBoard.orphans}
          stages={stages}
          filter={session.filter}
          now={now}
          canWrite={canWrite}
          pending={board.pending}
          nameOf={nameOf}
          dragDrop={dragDrop}
          onMoveStage={board.moveToStage}
          onColumn={board.moveToColumn}
          onDropTask={board.dropTask}
          onDropColumn={board.dropColumn}
          onOpenTask={session.setOpenTaskId}
          onRenameColumn={board.renameColumn}
          onDeleteColumn={board.deleteColumn}
          deleteBlockerOf={(columnId) =>
            columnDeleteBlocker(columnId, allTasks, boardColumns.length)
          }
          trailing={
            canWrite ? <AddColumn pending={board.pending} onAdd={board.addColumn} /> : null
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
          pending={board.pending}
          selected={selected}
          onToggle={toggle}
          onToggleAll={(checked) =>
            setSelected(checked ? new Set(listRows.map((task) => task.id)) : new Set())
          }
          onStatus={(taskId, status) => board.moveToStatus(taskId, status)}
          onMove={board.moveToStage}
          onBulk={board.bulk}
        />
      )}

      {openTask && (
        <TaskQuickPanel
          projectId={projectId}
          task={openTask}
          stages={stages}
          members={assignableMembers}
          canWrite={canWrite}
          onClose={session.closePanel}
          onSaved={onPanelSaved}
        />
      )}

      {canWrite && session.view === "board" && (
        <BoardHint onSwitchToList={session.changeView} />
      )}
    </div>
  );
}
