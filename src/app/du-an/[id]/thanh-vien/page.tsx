import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectMembers, requireProjectMember } from "@/lib/auth";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
import { Alert, Badge, Card, Table } from "@/components/ui";
import {
  abilitiesFor,
  orphanedAssignments,
  toTaskCard,
  workloadByAssignee,
} from "@/components/project/rules";
import { getProject, getTasks } from "../../data";
import { InviteForm, MemberRow } from "./forms";

export const metadata: Metadata = { title: "Thành viên" };

/**
 * Thành viên dự án — ai giữ vai trò gì, và ai đang gánh việc gì.
 *
 * Hai cột đó phải nằm cạnh nhau: người quản lý một đội làm hồ sơ nhiều tháng không hỏi
 * "ai là developer", họ hỏi "ai đang quá tải" và "việc này còn ai nhận". Khối lượng đọc
 * từ `project_tasks` chứ không phải một bảng thống kê nào — không có bảng đó.
 *
 * Không chỗ nào hiện UUID trần (mục C5 trong `schema-review-findings.md`). Tên lấy từ
 * `project_member_directory` (`0015`), email chỉ có khi người xem là chủ dự án vì RPC chỉ
 * trả email cho owner.
 */
export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, profile } = await requireProjectMember(id);

  const [project, members, tasks] = await Promise.all([
    getProject(id),
    getProjectMembers(id),
    getTasks(id),
  ]);
  if (!project) notFound();

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const owners = members.filter((m) => m.role === "owner").length;
  const developers = members.filter((m) => m.role === "developer");

  const cards = tasks.map(toTaskCard);
  const workload = workloadByAssignee(cards, new Date());
  const orphans = orphanedAssignments(
    cards,
    members.map((m) => m.userId),
  );
  const unassigned = cards.filter((t) => t.assigneeId === null && t.status !== "done").length;

  return (
    <div className="space-y-6">
      {developers.length === 0 && (
        <Alert tone="warn" title="Dự án chưa có Đơn vị phát triển nào">
          Không giao được việc cho ai cả: khoá ngoại ba cột{" "}
          <code className="font-mono text-xs">(project_id, assignee_id, assignee_role)</code> chỉ
          chấp nhận thành viên giữ vai trò <strong>Đơn vị phát triển</strong>. Mời thêm người,
          hoặc đổi vai trò một thành viên hiện có.
        </Alert>
      )}

      {orphans.length > 0 && (
        <Alert tone="warn" title={`${orphans.length} công việc đang giao cho người đã rời dự án`}>
          Gỡ thành viên không gỡ việc họ đang giữ, nên những việc này hiện không ai nhận.
          Giao lại chúng ở bảng công việc:
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {orphans.slice(0, 8).map((task) => (
              <li key={task.id}>
                <Link
                  href={`/du-an/${id}/cong-viec/${task.id}`}
                  className="font-medium underline decoration-dotted"
                >
                  {task.title}
                </Link>
              </li>
            ))}
            {orphans.length > 8 && <li>… và {orphans.length - 8} việc nữa.</li>}
          </ul>
        </Alert>
      )}

      {abilities.canManageMembers && (
        <Card
          title="Mời thành viên"
          description="Người được mời phải đã có tài khoản trên hệ thống — chưa có bảng lời mời qua email. Nhập đúng địa chỉ họ đã đăng ký."
        >
          <InviteForm projectId={id} />
        </Card>
      )}

      <Card
        title={`Thành viên dự án (${members.length})`}
        description={
          abilities.canManageMembers
            ? "Đổi vai trò có hiệu lực ngay và chỉ trong dự án này; một người có thể là chủ dự án ở đây và người xem ở dự án khác."
            : "Chỉ chủ dự án mới thêm, gỡ hoặc đổi vai trò thành viên."
        }
      >
        <Table
          head={
            abilities.canManageMembers
              ? ["Thành viên", "Vai trò", "Việc đang giữ", ""]
              : ["Thành viên", "Vai trò", "Việc đang giữ"]
          }
        >
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              projectId={id}
              member={m}
              canManage={abilities.canManageMembers}
              isSelf={m.userId === profile.id}
              isLastOwner={m.role === "owner" && owners === 1}
              workload={workload.get(m.userId) ?? null}
            />
          ))}
        </Table>

        {members.length === 0 && (
          <p className="mt-3 text-sm text-soil-600">
            Không đọc được danh sách thành viên. Nếu tình trạng này kéo dài, báo quản trị
            nền tảng.
          </p>
        )}

        {unassigned > 0 && (
          <p className="mt-4 border-t border-soil-100 pt-3 text-sm text-soil-600">
            Ngoài ra còn{" "}
            <Link href={`/du-an/${id}`} className="font-medium text-leaf-800 hover:underline">
              {unassigned} việc đang mở chưa giao cho ai
            </Link>
            .
          </p>
        )}
      </Card>

      <Card
        title="Ba vai trò làm được gì"
        description="Trục quyền này nằm trong project_members và có hiệu lực theo từng dự án — tách hẳn khỏi vai trò tài khoản trên nền tảng."
      >
        <ul className="space-y-3 text-sm text-soil-700">
          {(
            [
              [
                "owner",
                "Quản lý thành viên, chọn và khoá Standard/Methodology, duyệt bước, tạo và khoá monitoring period, xoá dự án.",
              ],
              [
                "developer",
                "Quản lý công việc, bình luận, đính kèm, nhập observation data và chuẩn bị báo cáo. Người duy nhất nhận được việc.",
              ],
              ["viewer", "Chỉ đọc dữ liệu của dự án. Không ghi được gì, kể cả bình luận."],
            ] as const
          ).map(([r, what]) => (
            <li key={r} className="flex gap-3">
              <span className="w-36 shrink-0">
                <Badge tone={r === "owner" ? "leaf" : "soil"}>{PROJECT_ROLE_LABEL[r]}</Badge>
              </span>
              <span>{what}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-soil-100 pt-3 text-xs text-soil-600">
          Ẩn nút theo vai trò ở đây chỉ phục vụ trải nghiệm. Lớp chặn thật là RLS trong
          PostgreSQL: bỏ qua giao diện thì policy vẫn giới hạn người dùng vào đúng dự án họ
          là thành viên.
        </p>
      </Card>
    </div>
  );
}
