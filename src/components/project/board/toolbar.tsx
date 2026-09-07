"use client";

import type { RefObject } from "react";
import { Kbd, Toolbar } from "@/components/ui";
import {
  TASK_SORTS,
  TASK_SORT_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  isFilterActive,
  type StageView,
  type TaskCard,
  type TaskFilter,
  type TaskSort,
} from "@/components/project/rules";

const CONTROL =
  "rounded-lg border border-soil-200 bg-white px-2.5 py-1.5 text-sm text-soil-900 outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100";

export type BoardView = "board" | "list";

export function BoardToolbar({
  view,
  filter,
  sort,
  columns,
  members,
  viewerId,
  visibleCount,
  totalCount,
  hiddenCount,
  searchRef,
  onViewChange,
  onFilterChange,
  onSortChange,
  onToggleHelp,
  onClearFilter,
}: {
  view: BoardView;
  filter: TaskFilter;
  sort: TaskSort;
  columns: Array<{ stage: StageView; tasks: TaskCard[] }>;
  members: Array<{ userId: string; fullName: string }>;
  viewerId: string | null;
  visibleCount: number;
  totalCount: number;
  hiddenCount: number;
  searchRef: RefObject<HTMLInputElement | null>;
  onViewChange: (view: BoardView) => void;
  onFilterChange: <K extends keyof TaskFilter>(key: K, value: TaskFilter[K]) => void;
  onSortChange: (sort: TaskSort) => void;
  onToggleHelp: () => void;
  onClearFilter: () => void;
}) {
  const set = <K extends keyof TaskFilter>(key: K, value: TaskFilter[K]) =>
    onFilterChange(key, value);

  return (
    <Toolbar
      note={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Hiện <strong className="font-medium text-soil-800">{visibleCount}</strong>/
            {totalCount} công việc
            {hiddenCount > 0 && <> · {hiddenCount} bị bộ lọc ẩn</>}
          </span>
          <button
            type="button"
            onClick={onToggleHelp}
            className="font-medium text-leaf-800 hover:underline"
          >
            Phím tắt <Kbd>?</Kbd>
          </button>
          {isFilterActive(filter) && (
            <button
              type="button"
              onClick={onClearFilter}
              className="font-medium text-leaf-800 hover:underline"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>
      }
    >
      <div className="flex rounded-lg border border-soil-200 p-0.5" role="group" aria-label="Chế độ xem">
        {(["board", "list"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewChange(mode)}
            aria-pressed={view === mode}
            className={`rounded px-2.5 py-1 text-sm font-medium transition ${
              view === mode ? "bg-leaf-700 text-white" : "text-soil-600 hover:bg-soil-100"
            }`}
          >
            {mode === "board" ? "Bảng" : "Danh sách"}
          </button>
        ))}
      </div>

      <input
        ref={searchRef}
        type="search"
        value={filter.text}
        onChange={(event) => set("text", event.target.value)}
        placeholder="Tìm công việc…"
        aria-label="Tìm công việc"
        className={`${CONTROL} min-w-[12rem] flex-1`}
      />

      <select
        value={filter.stageId}
        onChange={(event) => set("stageId", event.target.value)}
        aria-label="Lọc theo bước"
        className={CONTROL}
      >
        <option value="">Mọi bước</option>
        {columns.map((column) => (
          <option key={column.stage.id} value={column.stage.id}>
            {column.stage.ordinal}. {column.stage.title}
          </option>
        ))}
      </select>

      <select
        value={filter.assigneeId}
        onChange={(event) => set("assigneeId", event.target.value)}
        aria-label="Lọc theo người nhận"
        className={CONTROL}
      >
        <option value="">Mọi người nhận</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.fullName}
          </option>
        ))}
      </select>

      <select
        value={filter.status}
        onChange={(event) => set("status", event.target.value)}
        aria-label="Lọc theo trạng thái"
        className={CONTROL}
      >
        <option value="">Mọi trạng thái</option>
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {TASK_STATUS_LABEL[status]}
          </option>
        ))}
      </select>

      {viewerId && (
        <label className="flex items-center gap-1.5 text-sm text-soil-700">
          <input
            type="checkbox"
            checked={filter.onlyMine}
            onChange={(event) => set("onlyMine", event.target.checked)}
            className="h-4 w-4 rounded border-soil-300"
          />
          Việc của tôi
        </label>
      )}

      <label className="flex items-center gap-1.5 text-sm text-soil-700">
        <input
          type="checkbox"
          checked={filter.onlyBlocking}
          onChange={(event) => set("onlyBlocking", event.target.checked)}
          className="h-4 w-4 rounded border-soil-300"
        />
        Đang chặn
      </label>

      {view === "list" && (
        <label className="ml-auto flex items-center gap-2 text-sm text-soil-600">
          Sắp xếp
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as TaskSort)}
            aria-label="Sắp xếp danh sách"
            className={CONTROL}
          >
            {TASK_SORTS.map((key) => (
              <option key={key} value={key}>
                {TASK_SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      )}
    </Toolbar>
  );
}
