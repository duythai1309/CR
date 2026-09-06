import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectMembers, requireProjectMember } from "@/lib/auth";
import { Card } from "@/components/ui";
import {
  abilitiesFor,
  assignableMembers,
  groupTasksByStage,
  toStageView,
  toTaskCard,
} from "@/components/project/rules";
import { getProject, getStages, getTasks } from "../data";
import { ProjectBoard } from "./board";
import { NewTaskForm } from "./new-task-form";

export const metadata: Metadata = { title: "Bảng công việc" };

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await requireProjectMember(id);

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
    <div className="space-y-6">
      {abilities.canWriteTasks && (
        <Card
          title="Thêm công việc"
          description="Chọn bước, đặt tên việc, giao cho một Đơn vị phát triển trong dự án."
        >
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
        </Card>
      )}

      <ProjectBoard
        projectId={id}
        columns={columns}
        members={members.map((m) => ({ userId: m.userId, fullName: m.fullName }))}
        canWrite={abilities.canWriteTasks}
      />
    </div>
  );
}
