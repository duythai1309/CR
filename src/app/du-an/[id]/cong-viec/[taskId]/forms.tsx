"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { TASK_STATUSES, TASK_STATUS_LABEL, type TaskStatus } from "@/components/project/rules";
import {
  addComment,
  attachFileToTask,
  deleteComment,
  deleteTask,
  detachFile,
  updateTask,
} from "../../actions";

export function EditTaskForm({
  projectId,
  task,
  members,
}: {
  projectId: string;
  task: {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assigneeId: string | null;
    dueAt: string | null;
  };
  members: Array<{ userId: string; fullName: string }>;
}) {
  const [error, action, pending] = useActionState(updateTask, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="task_id" value={task.id} />

      <Field label="Tên công việc">
        <Input name="title" defaultValue={task.title} required maxLength={300} />
      </Field>

      <Field label="Mô tả">
        <Textarea name="description" rows={4} defaultValue={task.description} />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Trạng thái">
          <Select name="status" defaultValue={task.status}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Giao cho"
          hint={members.length === 0 ? "Dự án chưa có thành viên nào." : undefined}
        >
          <Select name="assignee_id" defaultValue={task.assigneeId ?? ""}>
            <option value="">Chưa giao</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hạn hoàn thành">
          <Input
            name="due_at"
            type="date"
            defaultValue={task.dueAt ? task.dueAt.slice(0, 10) : ""}
          />
        </Field>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu…" : "Lưu thay đổi"}
      </Button>
    </form>
  );
}

export function CommentForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [error, action, pending] = useActionState(addComment, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="task_id" value={taskId} />
      <Field label="Bình luận">
        <Textarea name="body" rows={3} required placeholder="Viết bình luận…" />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Đang gửi…" : "Gửi bình luận"}
      </Button>
    </form>
  );
}

export function AttachForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [error, action, pending] = useActionState(attachFileToTask, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="task_id" value={taskId} />
      <Field
        label="Tệp đính kèm cho công việc"
        hint="Nhận PDF, Word (.docx), Excel (.xlsx), CSV hoặc ảnh; tối đa 4 MB."
      >
        <input
          type="file"
          name="file"
          accept=".pdf,.docx,.xlsx,.csv,image/jpeg,image/png,image/webp"
          required
          className="text-sm text-soil-700 file:mr-3 file:rounded-lg file:border file:border-soil-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-soil-800"
        />
      </Field>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Đang tải lên…" : "Đính kèm"}
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </form>
  );
}

/** Ba đường xoá dùng chung một nút, khác nhau ở server action được gọi. */
export function DeleteTaskButton({
  kind,
  projectId,
  targetId,
  label,
}: {
  kind: "task" | "comment" | "detach";
  projectId: string;
  targetId: string;
  label: string;
}) {
  const router = useRouter();
  const handler = kind === "task" ? deleteTask : kind === "comment" ? deleteComment : detachFile;
  const [error, action, pending] = useActionState(handler, null);
  const field =
    kind === "task" ? "task_id" : kind === "comment" ? "comment_id" : "attachment_id";

  return (
    <>
      <form
        action={async (formData) => {
          await action(formData);
          if (kind === "task") router.push(`/du-an/${projectId}`);
        }}
        className="inline"
      >
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name={field} value={targetId} />
        <button
          type="submit"
          disabled={pending}
          onClick={(e) => {
            if (!confirm(`${label}? Thao tác này không hoàn lại được.`)) e.preventDefault();
          }}
          className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
        >
          {pending ? "Đang xoá…" : label}
        </button>
      </form>
      {error && <span className="ml-2 text-xs text-red-700">{error}</span>}
    </>
  );
}
