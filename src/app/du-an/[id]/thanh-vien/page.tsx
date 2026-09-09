import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectMembers, requireProjectMember } from "@/lib/auth";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
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
      <SectionHeader
        title="Đội ngũ dự án"
        description="Quản lý vai trò và theo dõi khối lượng công việc của từng thành viên."
        aside={<Badge tone="soil">{members.length} thành viên</Badge>}
      />

      {developers.length === 0 && (
        <Locked
          title="Chưa thể giao công việc"
          reason="Dự án chưa có thành viên giữ vai trò Đơn vị phát triển. Khối giao việc mở khi chủ dự án mời thêm người hoặc đổi vai trò một thành viên hiện có sang Đơn vị phát triển."
        />
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
            title="Bạn chưa thể quản lý thành viên"
            reason="Chỉ Chủ dự án được mời, gỡ hoặc đổi vai trò thành viên. Khối này mở khi một Chủ dự án cấp vai trò Chủ dự án cho bạn."
          />
        )}
      </section>

      <section>
        <SectionHeader
          title="Thành viên dự án"
          description={
            abilities.canManageMembers
              ? "Đổi vai trò có hiệu lực ngay và chỉ trong dự án này; một người có thể là chủ dự án ở đây và người xem ở dự án khác."
              : "Bạn có thể xem vai trò và khối lượng việc; chỉ Chủ dự án mới thay đổi thành viên."
          }
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

      <section>
        <SectionHeader
          title="Ba vai trò làm được gì"
          description="Quyền có hiệu lực theo từng dự án, tách khỏi vai trò tài khoản trên nền tảng."
        />
        <Card>
        <ul className="space-y-3 text-sm text-soil-700">
          {(
            [
              [
                "owner",
                "Quản lý thành viên, chọn và khoá Standard/Methodology, duyệt hồ sơ, tạo và khoá monitoring period, xoá dự án.",
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
      </section>
    </div>
  );
}
