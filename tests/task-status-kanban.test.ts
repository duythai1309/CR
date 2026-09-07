import { describe, expect, it } from "vitest";
import {
  TASK_STATUSES,
  groupTasksByStatus,
  type TaskCard,
} from "@/components/project/rules";

const task = (
  id: string,
  status: TaskCard["status"],
  position: number,
  title: string,
): TaskCard => ({
  id,
  stageId: "stage-1",
  title,
  status,
  assigneeId: null,
  dueAt: null,
  position,
});

describe("kanban theo trạng thái công việc", () => {
  it("đưa task vào đúng cột theo status", () => {
    const columns = groupTasksByStatus([
      task("todo-1", "todo", 1000, "Việc A"),
      task("doing-1", "in_progress", 1000, "Việc B"),
      task("done-1", "done", 1000, "Việc C"),
      task("blocked-1", "blocked", 1000, "Việc D"),
    ]);

    expect(columns.map((column) => [column.status, column.tasks.map((item) => item.id)])).toEqual([
      ["todo", ["todo-1"]],
      ["in_progress", ["doing-1"]],
      ["done", ["done-1"]],
      ["blocked", ["blocked-1"]],
    ]);
  });

  it("cột rỗng vẫn xuất hiện đủ bốn trạng thái theo thứ tự chuẩn", () => {
    const columns = groupTasksByStatus([]);

    expect(columns.map((column) => column.status)).toEqual(TASK_STATUSES);
    expect(columns).toHaveLength(4);
    expect(columns.every((column) => column.tasks.length === 0)).toBe(true);
  });

  it("xếp trong cột theo position rồi mới tới title", () => {
    const columns = groupTasksByStatus([
      task("late-b", "todo", 2000, "B"),
      task("same-c", "todo", 1000, "C"),
      task("same-a", "todo", 1000, "A"),
    ]);

    expect(columns[0].tasks.map((item) => item.id)).toEqual(["same-a", "same-c", "late-b"]);
  });
});
