import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectMembers, requireProjectMember } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  abilitiesFor,
  assignableMembers,
  isTaskStatus,
  toStageView,
} from "@/components/project/rules";
import {
  getProject,
  getStages,
  getTask,
  getTaskAttachments,
  getTaskComments,
} from "../../../data";
import { AttachForm, CommentForm, DeleteTaskButton, EditTaskForm } from "./forms";

export const metadata: Metadata = { title: "Công việc" };

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  const { role, profile } = await requireProjectMember(id);

  const [project, task, stages, members, comments, attachments] = await Promise.all([
    getProject(id),
    getTask(id, taskId),
    getStages(id),
    getProjectMembers(id),
    getTaskComments(taskId),
    getTaskAttachments(taskId),
  ]);
  if (!project || !task) notFound();

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const status = isTaskStatus(task.status) ? task.status : "todo";
  const stage = stages.map(toStageView).find((s) => s.id === task.stage_id);
  const memberName = new Map(members.map((m) => [m.userId, m.fullName]));

  return (
    <div className="space-y-6">
      <Link href={`/du-an/${id}`} className="text-sm text-soil-600 hover:text-soil-900">
        ← Về bảng công việc
      </Link>

      <Card
        title={task.title}
        description={
          stage ? `Bước ${stage.ordinal}: ${stage.title}` : "Không xác định được bước"
        }
        action={<Badge tone={TASK_STATUS_TONE[status]}>{TASK_STATUS_LABEL[status]}</Badge>}
      >
        {abilities.canWriteTasks ? (
          <EditTaskForm
            projectId={id}
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              status,
              assigneeId: task.assignee_id,
              dueAt: task.due_at,
            }}
            members={assignableMembers(members).map((m) => ({
              userId: m.userId,
              fullName: m.fullName,
            }))}
          />
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-soil-600">Mô tả</dt>
              <dd className="text-soil-900">{task.description || "—"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-soil-600">Giao cho</dt>
              <dd className="text-soil-900">
                {task.assignee_id ? (memberName.get(task.assignee_id) ?? "—") : "Chưa giao"}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-soil-600">Hạn</dt>
              <dd className="text-soil-900">
                {task.due_at ? new Date(task.due_at).toLocaleDateString("vi-VN") : "Không đặt"}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      <Card
        title="Tệp đính kèm"
        description="Tệp đã tải lên là bất biến. Cần thay thì tải bản mới rồi gỡ liên kết cũ."
      >
        {attachments.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {attachments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3">
                <span className="text-soil-900">{a.originalName}</span>
                <span className="text-xs text-soil-500">
                  {(a.sizeBytes / 1024).toFixed(0)} KB
                </span>
                {abilities.canUploadFiles && (
                  <DeleteTaskButton
                    kind="detach"
                    projectId={id}
                    targetId={a.id}
                    label="Gỡ"
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-soil-600">Chưa có tệp nào.</p>
        )}

        {abilities.canUploadFiles && (
          <div className="mt-4 border-t border-soil-100 pt-4">
            <AttachForm projectId={id} taskId={taskId} />
          </div>
        )}
      </Card>

      <Card title={`Bình luận (${comments.length})`}>
        {comments.length > 0 ? (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="border-b border-soil-100 pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-soil-600">
                  <span className="font-medium text-soil-900">
                    {memberName.get(c.author_id) ?? "Thành viên đã rời dự án"}
                  </span>
                  <span>{new Date(c.created_at).toLocaleString("vi-VN")}</span>
                  {(c.author_id === profile.id || role === "owner") &&
                    abilities.canComment && (
                      <DeleteTaskButton
                        kind="comment"
                        projectId={id}
                        targetId={c.id}
                        label="Xoá"
                      />
                    )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-soil-800">{c.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-soil-600">Chưa có bình luận nào.</p>
        )}

        {abilities.canComment && (
          <div className="mt-4 border-t border-soil-100 pt-4">
            <CommentForm projectId={id} taskId={taskId} />
          </div>
        )}
      </Card>

      {abilities.canWriteTasks && (
        <Card title="Xoá công việc">
          <p className="mb-3 text-sm text-soil-600">
            Công việc còn bình luận hoặc tệp đính kèm sẽ không xoá được — gỡ chúng trước.
          </p>
          <DeleteTaskButton kind="task" projectId={id} targetId={taskId} label="Xoá công việc" />
        </Card>
      )}
    </div>
  );
}
