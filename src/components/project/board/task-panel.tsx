"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type BoardTaskCard,
  type StageView,
} from "@/components/project/rules";
import { updateTask } from "@/app/du-an/[id]/actions";

/**
 * Sửa nhanh một card ngay trên bảng.
 *
 * Dùng lại `updateTask` — cùng một đường ghi với trang chi tiết, nên không có bộ quy tắc
 * thứ hai để lệch nhau. Panel này KHÔNG thay trang `/du-an/[id]/cong-viec/[taskId]`: bình
 * luận, tệp đính kèm và lịch sử vẫn chỉ có ở đó, và nút dẫn sang nằm ngay đầu panel.
 */
export function TaskQuickPanel({
  projectId,
  task,
  stages,
  members,
  canWrite,
  onClose,
  onSaved,
}: {
  projectId: string;
  task: BoardTaskCard;
  stages: StageView[];
  members: Array<{ userId: string; fullName: string }>;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, action, pending] = useActionState(updateTask, null);
  const [submitted, setSubmitted] = useState(false);

  // `useActionState` trả về void, nên "lưu xong chưa" phải đọc từ `pending` hạ xuống:
  // hết pending mà không có lỗi nghĩa là đã ghi được.
  useEffect(() => {
    if (!submitted || pending) return;
    setSubmitted(false);
    if (error === null) onSaved();
  }, [submitted, pending, error, onSaved]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stage = stages.find((item) => item.id === task.stageId);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-soil-900/20" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`Sửa nhanh: ${task.title}`}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-soil-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-soil-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-soil-900">{task.title}</h2>
            <p className="mt-0.5 text-xs text-soil-600">
              {stage ? `${stage.ordinal}. ${stage.title}` : "Mục hồ sơ không xác định"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded px-2 py-1 text-soil-600 hover:bg-soil-100"
          >
            ✕
          </button>
        </header>

        <div className="border-b border-soil-100 px-5 py-3">
          <Link
            href={`/du-an/${projectId}/cong-viec/${task.id}`}
            className="text-sm font-medium text-leaf-800 hover:underline"
          >
            Mở trang chi tiết — bình luận, tệp đính kèm →
          </Link>
        </div>

        {!canWrite ? (
          <div className="px-5 py-4">
            <Alert tone="warn" title="Chỉ xem">
              Vai trò của bạn trong dự án này không cho phép sửa công việc.
            </Alert>
          </div>
        ) : (
          <form
            action={(formData) => {
              setSubmitted(true);
              action(formData);
            }}
            className="space-y-4 px-5 py-4"
          >
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="task_id" value={task.id} />

            {error && <Alert tone="error">{error}</Alert>}

            <Field label="Tên công việc">
              <Input name="title" required maxLength={300} defaultValue={task.title} />
            </Field>

            <Field label="Mô tả">
              <Textarea name="description" rows={4} defaultValue={task.description ?? ""} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trạng thái">
                <Select name="status" defaultValue={task.status}>
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {TASK_STATUS_LABEL[status]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Hạn hoàn thành">
                <Input
                  type="date"
                  name="due_at"
                  defaultValue={task.dueAt ? task.dueAt.slice(0, 10) : ""}
                />
              </Field>
            </div>

            <Field label="Người nhận">
              <Select name="assignee_id" defaultValue={task.assigneeId ?? ""}>
                <option value="">Chưa giao cho ai</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.fullName}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu…" : "Lưu"}
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm text-soil-600 hover:bg-soil-100"
              >
                Huỷ
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
