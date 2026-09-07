import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectMembers, requireProjectMember } from "@/lib/auth";
import {
  Alert,
  Badge,
  Card,
  Empty,
  LinkButton,
  Locked,
  Meta,
  SectionHeader,
} from "@/components/ui";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  abilitiesFor,
  assignableMembers,
  isTaskStatus,
  taskFlags,
  toStageView,
  toTaskCard,
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

type TimelineEntry = {
  key: string;
  at: string;
  actorId: string | null;
  kind: "created" | "comment" | "attachment";
  body?: string;
  file?: { name: string; sizeBytes: number; checksum: string };
  action?: React.ReactNode;
};

/**
 * Chi tiết một công việc.
 *
 * Dòng thời gian gộp ba nguồn CÓ THẬT trong cơ sở dữ liệu — lúc tạo việc, bình luận,
 * đính kèm — vào một danh sách theo thứ tự thời gian. Nó **không** phải lịch sử trạng
 * thái: `project_tasks` chỉ có `updated_at` và không có bảng audit nào ghi lại "ai đổi
 * trạng thái từ gì sang gì". Màn hình nói rõ điều đó thay vì để người dùng tưởng mình
 * đang nhìn một audit trail đầy đủ. Xem mục 1 của `docs/design/pages-module-a.md`.
 */
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
  const nameOf = (userId: string | null) =>
    userId === null
      ? "—"
      : (memberName.get(userId) ?? "Thành viên đã rời dự án");

  const flags = taskFlags(toTaskCard(task), new Date());

  const timeline: TimelineEntry[] = [
    {
      key: `created-${task.id}`,
      at: task.created_at,
      actorId: task.created_by,
      kind: "created" as const,
    },
    ...comments.map((c): TimelineEntry => ({
      key: `comment-${c.id}`,
      at: c.created_at,
      actorId: c.author_id,
      kind: "comment",
      body: c.body,
      action:
        (c.author_id === profile.id || role === "owner") && abilities.canComment ? (
          <DeleteTaskButton kind="comment" projectId={id} targetId={c.id} label="Xoá" />
        ) : null,
    })),
    ...attachments.map((a): TimelineEntry => ({
      key: `file-${a.id}`,
      at: a.createdAt,
      actorId: a.uploadedBy,
      kind: "attachment",
      file: { name: a.originalName, sizeBytes: a.sizeBytes, checksum: a.checksum },
      action: abilities.canUploadFiles ? (
        <DeleteTaskButton kind="detach" projectId={id} targetId={a.id} label="Gỡ" />
      ) : null,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-5">
      <Link href={`/du-an/${id}`} className="inline-block text-sm text-soil-600 hover:text-soil-900">
        ← Về bảng công việc
      </Link>

      {/* Thanh thuộc tính: mọi thứ cần biết về việc này trong một lần nhìn */}
      <section>
        <SectionHeader
          title={task.title}
          description="Chi tiết, người phụ trách và tiến độ của công việc trong bước thiết kế."
          aside={<Badge tone={TASK_STATUS_TONE[status]}>{TASK_STATUS_LABEL[status]}</Badge>}
        />
        <Card>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Thuộc bước">
              {stage ? `${stage.ordinal}. ${stage.title}` : "Không xác định"}
            </Meta>
            <Meta label="Giao cho">
              {task.assignee_id ? nameOf(task.assignee_id) : <span className="italic text-soil-500">Chưa giao</span>}
            </Meta>
            <Meta label="Hạn hoàn thành">
              {task.due_at ? (
                <span className={flags.overdue ? "font-medium text-red-700" : undefined}>
                  {new Date(task.due_at).toLocaleDateString("vi-VN")}
                  {flags.overdue && ` · quá ${flags.overdueDays} ngày`}
                </span>
              ) : (
                <span className="italic text-soil-500">Không đặt</span>
              )}
            </Meta>
            <Meta label="Sửa lần cuối">{new Date(task.updated_at).toLocaleString("vi-VN")}</Meta>
          </dl>
        </Card>
      </section>

      <section>
        <SectionHeader
          title={abilities.canWriteTasks ? "Sửa công việc" : "Mô tả công việc"}
          description={
            abilities.canWriteTasks
              ? "Cập nhật nội dung, trạng thái, người nhận và hạn hoàn thành."
              : "Nội dung do người có quyền quản lý công việc trong dự án cập nhật."
          }
        />
        <Card>
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
          ) : task.description ? (
            <p className="whitespace-pre-wrap text-sm text-soil-800">{task.description}</p>
          ) : (
            <Empty
              title="Công việc chưa có mô tả"
              hint="Người quản lý công việc chưa bổ sung phạm vi hoặc kết quả cần hoàn thành."
              action={
                stage ? (
                  <LinkButton
                    href={`/du-an/${id}/quy-trinh#buoc-${stage.ordinal}`}
                    variant="secondary"
                  >
                    Xem bước thiết kế liên quan
                  </LinkButton>
                ) : (
                  <LinkButton href={`/du-an/${id}`} variant="secondary">
                    Về bảng công việc
                  </LinkButton>
                )
              }
            />
          )}
        </Card>
      </section>

      <section>
        <SectionHeader
          title="Dòng thời gian"
          description="Tạo việc, bình luận và tệp đính kèm, xếp theo thứ tự thời gian."
          aside={<Badge tone="soil">{timeline.length} sự kiện</Badge>}
        />
        <Card>
        <ol className="relative space-y-5 border-l border-soil-200 pl-5">
          {timeline.map((entry) => (
            <li key={entry.key} className="relative">
              <span
                className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                  entry.kind === "created"
                    ? "bg-leaf-500"
                    : entry.kind === "comment"
                      ? "bg-soil-400"
                      : "bg-carbon-500"
                }`}
                aria-hidden
              />
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-soil-600">
                <span className="font-medium text-soil-900">{nameOf(entry.actorId)}</span>
                <span>
                  {entry.kind === "created"
                    ? "tạo công việc"
                    : entry.kind === "comment"
                      ? "bình luận"
                      : "đính kèm tệp"}
                </span>
                <time dateTime={entry.at}>{new Date(entry.at).toLocaleString("vi-VN")}</time>
                {entry.action}
              </div>

              {entry.kind === "comment" && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-soil-800">{entry.body}</p>
              )}

              {entry.kind === "attachment" && entry.file && (
                <div className="mt-1 text-sm">
                  <p className="text-soil-900">{entry.file.name}</p>
                  <p className="mt-0.5 text-xs text-soil-500">
                    {(entry.file.sizeBytes / 1024).toFixed(0)} KB
                    {entry.file.checksum && (
                      <>
                        {" · "}
                        <span className="font-mono" title={`sha256:${entry.file.checksum}`}>
                          sha256 {entry.file.checksum.slice(0, 16)}…
                        </span>
                      </>
                    )}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ol>

        <p className="mt-5 border-t border-soil-100 pt-3 text-xs text-soil-600">
          Đây <strong>không</strong> phải lịch sử trạng thái. Schema chỉ giữ{" "}
          <code className="font-mono">updated_at</code> trên công việc; không có bảng nào ghi
          lại ai đổi trạng thái, người nhận hay hạn — và ai lúc nào. Muốn có audit trail đầy
          đủ cho VVB thì cần thêm bảng sự kiện, xem{" "}
          <code className="font-mono">docs/design/pages-module-a.md</code>.
        </p>
        </Card>
      </section>

      <section>
        <SectionHeader
          title="Thêm vào dòng thời gian"
          description="Ghi lại trao đổi và đính kèm bằng chứng liên quan trực tiếp đến công việc."
        />
        {abilities.canComment ? (
          <Card>
          <div className="space-y-5">
            <CommentForm projectId={id} taskId={taskId} />
            <div className="border-t border-soil-100 pt-4">
              <p className="mb-2 text-sm text-soil-700">
                Tệp đã tải lên là <strong>bất biến</strong>: trigger chặn mọi lượt sửa hay xoá
                bytes, nên checksum luôn còn đúng với thứ đã nộp. Cần thay thì tải bản mới rồi
                gỡ liên kết cũ.
              </p>
              <AttachForm projectId={id} taskId={taskId} />
            </div>
          </div>
          </Card>
        ) : (
          <Locked
            title="Bạn chưa thể thêm bình luận hoặc tệp"
            reason="Vai trò hiện tại chỉ được xem công việc. Khối này mở khi chủ dự án đổi vai trò của bạn sang Đơn vị phát triển hoặc Chủ dự án."
          />
        )}
      </section>

      {abilities.canWriteTasks && (
        <section>
          <SectionHeader
            title="Xoá công việc"
            description="Thao tác này chỉ dùng khi công việc không còn cần thiết trong kế hoạch."
          />
          <Card>
            <Alert tone="warn">
              Công việc còn bình luận hoặc tệp đính kèm sẽ không xoá được — khoá ngoại là{" "}
              <code className="font-mono text-xs">on delete restrict</code>, cố ý, để bằng chứng
              không biến mất cùng một cú bấm nhầm. Gỡ chúng trước.
            </Alert>
            <div className="mt-3">
              <DeleteTaskButton kind="task" projectId={id} targetId={taskId} label="Xoá công việc" />
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
