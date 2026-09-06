import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectMembers, requireProjectMember } from "@/lib/auth";
import {
  abilitiesFor,
  assignableMembers,
  groupTasksByStage,
  isTaskStatus,
  toStageView,
  toTaskCard,
} from "@/components/project/rules";
import { getProject, getStages, getTasks } from "../data";
import { ProjectBoard } from "./board";
import { NewTaskForm } from "./new-task-form";

export const metadata: Metadata = { title: "Bảng công việc" };

/**
 * Bảng công việc. Trang server chỉ đọc và xếp dữ liệu; toàn bộ lọc, sắp xếp, chọn nhiều
 * và phím tắt nằm trong `board.tsx` vì chúng là trạng thái của phiên làm việc, không phải
 * của dự án.
 *
 * Form thêm việc được truyền XUỐNG bảng thay vì đặt cạnh nó, để phím tắt `c` mở được nó
 * và để nó không chiếm chỗ vĩnh viễn ở đầu màn hình — người dùng đọc bảng nhiều hơn nhập.
 */
export default async function ProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `?assignee=`, `?status=`, `?blocking=1` — để trang Thành viên trỏ thẳng vào đúng bộ lọc. */
  searchParams: Promise<{ assignee?: string; status?: string; blocking?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { role, profile } = await requireProjectMember(id);

  const [project, stages, tasks, members] = await Promise.all([
    getProject(id),
    getStages(id),
    getTasks(id),
    getProjectMembers(id),
  ]);
  if (!project) notFound();

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const columns = groupTasksByStage(stages.map(toStageView), tasks.map(toTaskCard));

  return (
    <ProjectBoard
      // Đổi query string phải dựng lại bảng: `initialFilter` chỉ là giá trị khởi tạo của
      // `useState`, nên không có key thì đi từ `?assignee=u1` sang `?assignee=u2` sẽ giữ
      // nguyên bộ lọc cũ và hiện sai người.
      key={`${query.assignee ?? ""}|${query.status ?? ""}|${query.blocking ?? ""}`}
      projectId={id}
      columns={columns}
      members={members.map((m) => ({ userId: m.userId, fullName: m.fullName }))}
      canWrite={abilities.canWriteTasks}
      viewerId={profile.id}
      initialFilter={{
        assigneeId: members.some((m) => m.userId === query.assignee) ? (query.assignee ?? "") : "",
        status: isTaskStatus(query.status) ? query.status : "",
        onlyBlocking: query.blocking === "1",
      }}
      newTaskForm={
        abilities.canWriteTasks ? (
          <NewTaskForm
            projectId={id}
            stages={columns.map((c) => ({
              id: c.stage.id,
              label: `${c.stage.ordinal}. ${c.stage.title}`,
              nextPosition: c.tasks.length,
            }))}
            members={assignableMembers(members).map((m) => ({
              userId: m.userId,
              fullName: m.fullName,
            }))}
          />
        ) : null
      }
    />
  );
}
