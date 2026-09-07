"use client";

import { useEffect, type RefObject } from "react";
import { Kbd } from "@/components/ui";
import { type BoardView } from "./toolbar";

const SHORTCUTS: Array<[string, string]> = [
  ["/", "Nhảy vào ô tìm"],
  ["b", "Chế độ bảng"],
  ["l", "Chế độ danh sách"],
  ["m", "Chỉ việc giao cho tôi"],
  ["x", "Chỉ việc đang chặn"],
  ["c", "Mở form thêm công việc"],
  ["Esc", "Xoá bộ lọc, đóng bảng phím tắt"],
  ["?", "Bật/tắt bảng phím tắt"],
];

export function useBoardShortcuts({
  searchRef,
  newTaskRef,
  hasNewTaskForm,
  onViewChange,
  onClearFilter,
  onToggleMine,
  onToggleBlocking,
  onOpenNewTask,
  onCloseHelp,
  onToggleHelp,
}: {
  searchRef: RefObject<HTMLInputElement | null>;
  newTaskRef: RefObject<HTMLDivElement | null>;
  hasNewTaskForm: boolean;
  onViewChange: (view: BoardView) => void;
  onClearFilter: () => void;
  onToggleMine: () => void;
  onToggleBlocking: () => void;
  onOpenNewTask: () => void;
  onCloseHelp: () => void;
  onToggleHelp: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if (event.key === "Escape") {
        if (typing) target?.blur();
        onCloseHelp();
        onClearFilter();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case "/":
          event.preventDefault();
          searchRef.current?.focus();
          break;
        case "b":
          onViewChange("board");
          break;
        case "l":
          onViewChange("list");
          break;
        case "m":
          onToggleMine();
          break;
        case "x":
          onToggleBlocking();
          break;
        case "c":
          if (hasNewTaskForm) {
            event.preventDefault();
            onOpenNewTask();
            requestAnimationFrame(() => {
              const first = newTaskRef.current?.querySelector<HTMLElement>("input, textarea, select");
              first?.focus();
            });
          }
          break;
        case "?":
          onToggleHelp();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    hasNewTaskForm,
    newTaskRef,
    onClearFilter,
    onCloseHelp,
    onOpenNewTask,
    onToggleBlocking,
    onToggleHelp,
    onToggleMine,
    onViewChange,
    searchRef,
  ]);
}

export function ShortcutHelp() {
  return (
    <div className="rounded-xl border border-soil-200 bg-white px-5 py-4 shadow-sm">
      <h3 className="text-sm font-semibold text-soil-900">Phím tắt</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {SHORTCUTS.map(([key, meaning]) => (
          <div key={key} className="flex items-center gap-3">
            <dt className="w-12 shrink-0">
              <Kbd>{key}</Kbd>
            </dt>
            <dd className="text-soil-700">{meaning}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-soil-600">
        Phím tắt tự nhường khi con trỏ đang ở trong một ô nhập. Mọi việc mà kéo-thả làm
        được đều làm được bằng bàn phím: ô chọn <em>Mục hồ sơ</em> và <em>Trạng thái</em> trên
        từng card, hoặc chọn nhiều rồi đổi hàng loạt ở chế độ danh sách.
      </p>
    </div>
  );
}
