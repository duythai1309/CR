"use client";

import { useActionState } from "react";
import { Alert, Badge, Button, Field, Input, Select } from "@/components/ui";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
import type { ProjectMemberEntry } from "@/lib/auth";
import { changeMemberRole, inviteMember, removeMember } from "./actions";

export function InviteForm({ projectId }: { projectId: string }) {
  const [result, action, pending] = useActionState(inviteMember, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
        <Field label="Email người được mời">
          <Input name="email" type="email" required placeholder="ten@vidu.vn" />
        </Field>
        <Field label="Vai trò">
          <Select name="role" defaultValue="developer">
            <option value="developer">{PROJECT_ROLE_LABEL.developer}</option>
            <option value="viewer">{PROJECT_ROLE_LABEL.viewer}</option>
            <option value="owner">{PROJECT_ROLE_LABEL.owner}</option>
          </Select>
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
 * Một dòng thành viên.
 *
 * Luôn hiện HỌ TÊN, không bao giờ hiện UUID trần — đó là mục C5 trong
 * `docs/design/schema-review-findings.md`, và là lý do `0015_project_identity.sql` tồn
 * tại. Email chỉ có khi người đang xem là chủ dự án, vì RPC chỉ trả email cho owner.
 */
export function MemberRow({
  projectId,
  member,
  canManage,
  isSelf,
  isLastOwner,
}: {
  projectId: string;
  member: ProjectMemberEntry;
  canManage: boolean;
  isSelf: boolean;
  isLastOwner: boolean;
}) {
  const [roleResult, roleAction, rolePending] = useActionState(changeMemberRole, null);
  const [removeResult, removeAction, removePending] = useActionState(removeMember, null);
  const message = roleResult ?? removeResult;

  return (
    <>
      <tr className="border-b border-soil-100 last:border-0">
        <td className="px-3 py-2.5">
          <span className="font-medium text-soil-900">
            {member.fullName || "(chưa đặt họ tên)"}
          </span>
          {isSelf && <span className="ml-2 text-xs text-soil-500">— bạn</span>}
        </td>

        {canManage && (
          <td className="px-3 py-2.5 text-soil-600">{member.email ?? "—"}</td>
        )}

        <td className="px-3 py-2.5">
          {canManage ? (
            <form action={roleAction} className="flex items-center gap-2">
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="user_id" value={member.userId} />
              <Select
                name="role"
                defaultValue={member.role}
                disabled={rolePending || isLastOwner}
                className="w-44"
              >
                <option value="owner">{PROJECT_ROLE_LABEL.owner}</option>
                <option value="developer">{PROJECT_ROLE_LABEL.developer}</option>
                <option value="viewer">{PROJECT_ROLE_LABEL.viewer}</option>
              </Select>
              <Button type="submit" variant="secondary" disabled={rolePending || isLastOwner}>
                Lưu
              </Button>
            </form>
          ) : (
            <Badge tone={member.role === "owner" ? "leaf" : "soil"}>
              {PROJECT_ROLE_LABEL[member.role]}
            </Badge>
          )}
        </td>

        {canManage && (
          <td className="px-3 py-2.5 text-right">
            <form action={removeAction}>
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="user_id" value={member.userId} />
              <Button type="submit" variant="danger" disabled={removePending || isLastOwner}>
                Gỡ
              </Button>
            </form>
          </td>
        )}
      </tr>

      {(message || isLastOwner) && canManage && (
        <tr>
          <td colSpan={4} className="px-3 pb-3">
            {isLastOwner && !message && (
              <p className="text-xs text-soil-600">
                Đây là chủ dự án duy nhất. Chỉ định thêm một chủ dự án nữa trước khi đổi
                vai trò hoặc gỡ người này.
              </p>
            )}
            {message && (
              <Alert tone={message.ok ? "ok" : "error"}>{message.message}</Alert>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
