"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { MemberWorkload } from "@/components/project/rules";
import type { ProjectMemberEntry } from "@/lib/auth";
import { inviteMember, removeMember } from "./actions";

export function InviteForm({ projectId }: { projectId: string }) {
  const [result, action, pending] = useActionState(inviteMember, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <Field
          label="Email người được mời"
          hint="Người được mời có đầy đủ quyền trong dự án này ngay khi được thêm."
        >
          <Input name="email" type="email" required placeholder="ten@vidu.vn" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang mời…" : "Mời"}
        </Button>
      </div>

      {result && <Alert tone={result.ok ? "ok" : "error"}>{result.message}</Alert>}
    </form>
  );
}

/**
 * Một dòng thành viên: danh tính và khối lượng việc đang giữ.
 *
 * Luôn hiện HỌ TÊN, không bao giờ hiện UUID trần — đó là mục C5 trong
 * `docs/design/schema-review-findings.md`, và là lý do `0015_project_identity.sql` tồn
 * tại.
 *
 * Cột khối lượng liên kết thẳng sang bảng công việc đã lọc sẵn theo người này, để câu
 * "ai đang gánh gì" không phải trả lời bằng cách mở bảng rồi tự chọn lại bộ lọc.
 */
export function MemberRow({
  projectId,
  member,
  canManage,
  isSelf,
  workload,
}: {
  projectId: string;
  member: ProjectMemberEntry;
  canManage: boolean;
  isSelf: boolean;
  workload: MemberWorkload | null;
}) {
  const [message, removeAction, removePending] = useActionState(removeMember, null);
  const columns = canManage ? 3 : 2;

  return (
    <>
      <tr className="border-b border-soil-100 last:border-0">
        <td className="px-3 py-2.5">
          <span className="font-medium text-soil-900">
            {member.fullName || "(chưa đặt họ tên)"}
          </span>
          {isSelf && <span className="ml-2 text-xs text-soil-500">— bạn</span>}
          {canManage && (
            <span className="mt-0.5 block text-xs text-soil-600">{member.email ?? "—"}</span>
          )}
        </td>

        <td className="px-3 py-2.5">
          <Workload projectId={projectId} userId={member.userId} workload={workload} />
        </td>

        {canManage && (
          <td className="px-3 py-2.5 text-right">
            <form action={removeAction}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="user_id" value={member.userId} />
              <Button type="submit" variant="danger" disabled={removePending}>
                Gỡ
              </Button>
            </form>
          </td>
        )}
      </tr>

      {message && canManage && (
        <tr>
          <td colSpan={columns} className="px-3 pb-3">
            <Alert tone={message.ok ? "ok" : "error"}>{message.message}</Alert>
          </td>
        </tr>
      )}
    </>
  );
}

function Workload({
  projectId,
  userId,
  workload,
}: {
  projectId: string;
  userId: string;
  workload: MemberWorkload | null;
}) {
  if (!workload || workload.open + workload.done === 0)
    return <span className="text-xs text-soil-500">Chưa nhận việc nào</span>;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Link
        href={`/du-an/${projectId}?assignee=${userId}`}
        className="font-medium text-leaf-800 hover:underline"
      >
        {workload.open} việc đang mở
      </Link>
      {workload.inProgress > 0 && (
        <span className="rounded-full bg-carbon-100 px-2 py-0.5 text-carbon-700">
          {workload.inProgress} đang làm
        </span>
      )}
      {workload.blocked > 0 && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
          {workload.blocked} vướng
        </span>
      )}
      {workload.overdue > 0 && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
          {workload.overdue} quá hạn
        </span>
      )}
      {workload.done > 0 && (
        <span className="rounded-full bg-soil-100 px-2 py-0.5 text-soil-600">
          {workload.done} xong
        </span>
      )}
    </div>
  );
}
