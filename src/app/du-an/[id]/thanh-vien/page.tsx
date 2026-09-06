import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectMembers, requireProjectMember } from "@/lib/auth";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
import { Badge, Card, Table } from "@/components/ui";
import { abilitiesFor } from "@/components/project/rules";
import { getProject } from "../../data";
import { InviteForm, MemberRow } from "./forms";

export const metadata: Metadata = { title: "Thành viên" };

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, profile } = await requireProjectMember(id);

  const [project, members] = await Promise.all([getProject(id), getProjectMembers(id)]);
  if (!project) notFound();

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const owners = members.filter((m) => m.role === "owner").length;

  return (
    <div className="space-y-6">
      {abilities.canManageMembers && (
        <Card
          title="Mời thành viên"
          description="Người được mời cần đã có tài khoản trên hệ thống. Nhập đúng email họ đã đăng ký."
        >
          <InviteForm projectId={id} />
        </Card>
      )}

      <Card
        title="Thành viên dự án"
        description={
          abilities.canManageMembers
            ? "Chủ dự án toàn quyền; Đơn vị phát triển thao tác công việc và nhập số liệu; Người xem chỉ đọc."
            : "Chỉ chủ dự án mới thêm, gỡ hoặc đổi vai trò thành viên."
        }
      >
        <Table
          head={
            abilities.canManageMembers
              ? ["Họ tên", "Email", "Vai trò", ""]
              : ["Họ tên", "Vai trò"]
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
            />
          ))}
        </Table>

        {members.length === 0 && (
          <p className="mt-3 text-sm text-soil-600">
            Không đọc được danh sách thành viên. Nếu tình trạng này kéo dài, báo quản trị
            nền tảng.
          </p>
        )}
      </Card>

      <Card title="Vai trò làm được gì">
        <ul className="space-y-2 text-sm text-soil-700">
          {(["owner", "developer", "viewer"] as const).map((r) => (
            <li key={r} className="flex gap-3">
              <Badge tone={r === "owner" ? "leaf" : "soil"}>{PROJECT_ROLE_LABEL[r]}</Badge>
              <span>
                {r === "owner" &&
                  "Toàn quyền: mời thành viên, chọn và khoá Standard/Methodology, duyệt bước, xoá dự án."}
                {r === "developer" &&
                  "Thao tác công việc, bình luận, tải tệp, nhập số liệu giám sát. Không xoá được dự án."}
                {r === "viewer" && "Chỉ xem. Không sửa được gì."}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
