"use client";

import { useState } from "react";
import { COLUMN_NAME_MAX, type BoardColumnView } from "@/components/project/rules";

const MICRO =
  "w-full rounded border border-soil-200 bg-white px-1.5 py-1 text-sm text-soil-900 outline-none focus:border-leaf-500";

/**
 * Đầu cột: tên, số việc, tay cầm để kéo, và hai thao tác đổi tên / xoá.
 *
 * Nút xoá bị vô hiệu kèm `title` nói rõ lý do khi cột còn việc — người dùng thấy TRƯỚC vì
 * sao không bấm được, thay vì bấm rồi nhận một lỗi khoá ngoại.
 */
export function ColumnHeader({
  column,
  count,
  canWrite,
  pending,
  deleteBlocker,
  onDragStart,
  onRename,
  onDelete,
}: {
  column: BoardColumnView;
  count: number;
  canWrite: boolean;
  pending: boolean;
  deleteBlocker: string | null;
  onDragStart: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);

  function commit() {
    const value = draft.trim();
    setEditing(false);
    if (value && value !== column.name) onRename(value);
    else setDraft(column.name);
  }

  if (editing)
    return (
      <header className="mb-3">
        <input
          autoFocus
          value={draft}
          maxLength={COLUMN_NAME_MAX}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") {
              setDraft(column.name);
              setEditing(false);
            }
          }}
          aria-label={`Đổi tên cột ${column.name}`}
          className={MICRO}
        />
      </header>
    );

  return (
    <header
      draggable={canWrite}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", column.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className={`mb-3 flex items-start justify-between gap-2 ${
        canWrite ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-soil-900">
        {canWrite && (
          <span aria-hidden className="shrink-0 text-soil-400">
            ⠿
          </span>
        )}
        <span className="truncate" title={column.name}>
          {column.name}
        </span>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs tabular-nums font-normal text-soil-600">
          {count}
        </span>
      </h3>

      {canWrite && (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setDraft(column.name);
              setEditing(true);
            }}
            disabled={pending}
            aria-label={`Đổi tên cột ${column.name}`}
            title="Đổi tên cột"
            className="rounded px-1 text-xs text-soil-600 hover:bg-white hover:text-soil-900"
          >
            Sửa
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending || deleteBlocker !== null}
            aria-label={`Xoá cột ${column.name}`}
            title={deleteBlocker ?? "Xoá cột"}
            className="rounded px-1 text-xs text-soil-600 hover:bg-white hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Xoá
          </button>
        </span>
      )}
    </header>
  );
}

/** Ô thêm cột mới, đứng cuối bảng như Jira. */
export function AddColumn({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    const value = name.trim();
    if (!value) return;
    onAdd(value);
    setName("");
    setOpen(false);
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-fit w-[18rem] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-soil-300 bg-white/50 px-3 py-3 text-sm font-medium text-soil-600 transition hover:border-leaf-500 hover:text-leaf-800"
      >
        <span aria-hidden>+</span> Thêm cột
      </button>
    );

  return (
    <div className="flex h-fit w-[18rem] shrink-0 flex-col gap-2 rounded-xl border border-soil-200 bg-white p-3">
      <input
        autoFocus
        value={name}
        maxLength={COLUMN_NAME_MAX}
        disabled={pending}
        placeholder="Tên cột mới…"
        aria-label="Tên cột mới"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
          if (event.key === "Escape") {
            setName("");
            setOpen(false);
          }
        }}
        className={MICRO}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || name.trim().length === 0}
          className="rounded-lg bg-leaf-700 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          Thêm
        </button>
        <button
          type="button"
          onClick={() => {
            setName("");
            setOpen(false);
          }}
          className="rounded-lg px-3 py-1 text-sm text-soil-600 hover:bg-soil-100"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
