import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectMembers, projectClient, requireProjectMember } from "@/lib/auth";
import {
  abilitiesFor,
  assignableMembers,
  isTaskStatus,
  sortColumns,
  toStageView,
  toTaskCard,
  type BoardColumnView,
  type BoardTaskCard,
} from "@/components/project/rules";
import type { ProjectTask } from "@/types/project-platform";
import { getProject, getStages, getTasks } from "../data";
import { ProjectBoard } from "./board";
import { NewTaskForm } from "./new-task-form";

export const metadata: Metadata = { title: "Bảng công việc" };

/**
 * `column_id` và bảng `project_board_columns` đến từ migration 0021, sau đợt sinh
 * `src/types/project-platform.ts`. Nới kiểu tại chỗ thay vì sửa tệp types — tệp đó nằm
 * ngoài phạm vi gói này và sẽ được sinh lại khi migration được áp.
 */
type TaskRow = ProjectTask & { column_id?: string | null };

/**
 * Đọc cột kanban của một dự án.
 *
 * Truy vấn nằm ngay đây chứ không ở `src/app/du-an/data.ts` vì tệp đó thuộc gói khác
 * trong đợt này. Chỗ đúng của nó là data.ts; chuyển sang khi hai gói đã nhập lại.
 */
async function getBoardColumns(projectId: string): Promise<BoardColumnView[]> {
  const db = await projectClient();
  const { data } = await db
    .from("project_board_columns")
    .select("id, name, position")
    .eq("project_id", projectId)
    .order("position");

  return sortColumns(
    ((data ?? []) as Array<{ id: string; name: string; position: number | string }>).map(
      (row) => ({
        id: row.id,
        name: row.name,
        position: Number(row.position),
      }),
    ),
  );
}

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

  const [project, stages, tasks, members, boardColumns] = await Promise.all([
    getProject(id),
    getStages(id),
    getTasks(id),
    getProjectMembers(id),
    getBoardColumns(id),
  ]);
  if (!project) notFound();

  const abilities = abilitiesFor(role, project.deleted_at !== null);
  const stageViews = stages.map(toStageView);

  const taskCards: BoardTaskCard[] = (tasks as TaskRow[]).map((row) => ({
    ...toTaskCard(row),
    columnId: row.column_id ?? null,
    description: row.description,
  }));

  const assignable = assignableMembers(members).map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
  }));

  return (
    <ProjectBoard
      // Đổi query string phải dựng lại bảng: `initialFilter` chỉ là giá trị khởi tạo của
      // `useState`, nên không có key thì đi từ `?assignee=u1` sang `?assignee=u2` sẽ giữ
      // nguyên bộ lọc cũ và hiện sai người.
      key={`${query.assignee ?? ""}|${query.status ?? ""}|${query.blocking ?? ""}`}
      projectId={id}
      boardColumns={boardColumns}
      tasks={taskCards}
      stages={stageViews}
      members={members.map((m) => ({ userId: m.userId, fullName: m.fullName }))}
      assignableMembers={assignable}
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
            stages={stageViews.map((stage) => ({
              id: stage.id,
              label: `${stage.ordinal}. ${stage.title}`,
              nextPosition: taskCards.filter((task) => task.stageId === stage.id).length,
            }))}
            members={assignable}
          />
        ) : null
      }
    />
  );
}
