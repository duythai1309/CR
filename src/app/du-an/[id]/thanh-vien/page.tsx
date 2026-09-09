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
  SectionHeader,
  Table,
} from "@/components/ui";
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
 * Thành viên dự án — ai ở trong dự án, và ai đang gánh việc gì.
 *
 * Không còn cột vai trò: mọi thành viên có cùng quyền và ai cũng nhận được việc
 * (0022 ở tầng hàm, 0025 ở tầng bảng). Câu hỏi thật của người quản lý một đội làm hồ sơ
 * nhiều tháng vốn cũng không phải "ai là developer" mà là "ai đang quá tải" và "việc này
 * còn ai nhận". Khối lượng đọc từ `project_tasks` chứ không phải một bảng thống kê nào —
 * không có bảng đó.
 *
 * Không chỗ nào hiện UUID trần (mục C5 trong `schema-review-findings.md`). Tên lấy từ
 * `project_member_directory` (`0015`), email chỉ có khi người xem là chủ dự án vì RPC chỉ
 * trả email cho owner.
 */
export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProjectMember(id);

  const [project, members, tasks] = await Promise.all([
    getProject(id),
    getProjectMembers(id),
    getTasks(id),
  ]);
  if (!project) notFound();

  const abilities = abilitiesFor(project.deleted_at !== null);

  const cards = tasks.map(toTaskCard);
  const workload = workloadByAssignee(cards, new Date());
  const orphans = orphanedAssignments(
    cards,
    members.map((m) => m.userId),
  );
  const unassigned = cards.filter((t) => t.assigneeId === null && t.status !== "done").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Đội ngũ dự án"
        description="Mời người vào dự án và theo dõi khối lượng công việc của từng người."
        aside={<Badge tone="soil">{members.length} thành viên</Badge>}
      />

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

      <section id="moi-thanh-vien" className="scroll-mt-6">
        <SectionHeader
          title="Mời thành viên"
          description="Người được mời phải đã có tài khoản trên hệ thống. Nhập đúng địa chỉ họ đã đăng ký."
        />
        {abilities.canManageMembers ? (
          <Card>
            <InviteForm projectId={id} />
          </Card>
        ) : (
          <Locked
            title="Dự án đã bị xoá"
            reason="Dự án ở trạng thái xoá mềm: lịch sử vẫn đọc được nhưng mọi đường ghi, kể cả mời thành viên, đã đóng lại."
          />
        )}
      </section>

      <section>
        <SectionHeader
          title="Thành viên dự án"
          description="Mọi thành viên có cùng quyền trong dự án này và ai cũng nhận được việc."
        />
        <Card>
          {members.length === 0 ? (
            <Empty
              title="Không đọc được danh sách thành viên"
              hint="Nếu tình trạng này kéo dài, hãy báo quản trị nền tảng. Bạn vẫn có thể quay lại bảng công việc của dự án."
              action={
                <LinkButton href={`/du-an/${id}`} variant="secondary">
                  Về bảng công việc
                </LinkButton>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[44rem]">
                <Table
                  head={
                    abilities.canManageMembers
                      ? ["Thành viên", "Việc đang giữ", ""]
                      : ["Thành viên", "Việc đang giữ"]
                  }
                >
                  {members.map((m) => (
                    <MemberRow
                      key={m.userId}
                      projectId={id}
                      member={m}
                      canManage={abilities.canManageMembers}
                      isSelf={m.userId === profile.id}
                      workload={workload.get(m.userId) ?? null}
                    />
                  ))}
                </Table>
              </div>
            </div>
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
      </section>

    </div>
  );
}
