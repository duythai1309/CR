import { describe, expect, it } from "vitest";
import {
  EMPTY_PORTFOLIO_FILTER,
  EMPTY_TASK_FILTER,
  baselineGateErrors,
  filterProjects,
  filterTasks,
  isFilterActive,
  orphanedAssignments,
  projectAttention,
  sortProjects,
  sortTasks,
  taskFlags,
  workloadByAssignee,
  type PortfolioRow,
  type TaskCard,
} from "@/components/project/rules";

/**
 * Logic thuần đứng sau các màn hình Module A: lọc lỗi baseline, cờ công việc, bộ lọc và
 * sắp xếp của bảng công việc và của danh mục dự án.
 */

describe("lọc lệch giữa hai bộ kiểm baseline", () => {
  const fields = [
    { id: "area_ha", required: true },
    { id: "species", required: false },
  ];

  it("bỏ lỗi required_if vì SQL không cưỡng chế nó", () => {
    const errors = baselineGateErrors(
      [{ field: "species", message: "Required field" }],
      fields,
    );
    expect(errors).toEqual([]);
  });

  it("giữ lỗi required trên field khai required — SQL có kiểm", () => {
    const errors = baselineGateErrors([{ field: "area_ha", message: "Required field" }], fields);
    expect(errors).toHaveLength(1);
  });

  it("giữ mọi lỗi khác trên field điều kiện: kiểu, biên, enum đều khớp hai bên", () => {
    const errors = baselineGateErrors([{ field: "species", message: "Unknown enum code" }], fields);
    expect(errors).toHaveLength(1);
  });
});

describe("cờ công việc", () => {
  const now = new Date("2026-09-07T10:00:00.000Z");
  const card = (over: Partial<TaskCard>): TaskCard => ({
    id: "t",
    stageId: "s1",
    title: "T",
    status: "todo",
    assigneeId: null,
    dueAt: null,
    position: 0,
    ...over,
  });

  it("quá hạn tính theo ngày, không theo giờ", () => {
    const flags = taskFlags(card({ dueAt: "2026-09-04T00:00:00.000Z" }), now);
    expect(flags.overdue).toBe(true);
    expect(flags.overdueDays).toBe(3);
  });

  it("hạn đúng hôm nay chưa phải quá hạn", () => {
    expect(taskFlags(card({ dueAt: "2026-09-07T00:00:00.000Z" }), now).overdue).toBe(false);
  });

  it("việc đã xong không bao giờ quá hạn", () => {
    const flags = taskFlags(card({ dueAt: "2026-01-01T00:00:00.000Z", status: "done" }), now);
    expect(flags.overdue).toBe(false);
    expect(flags.blocking).toBe(false);
  });

  it("sắp tới hạn là trong bảy ngày", () => {
    expect(taskFlags(card({ dueAt: "2026-09-12T00:00:00.000Z" }), now).dueSoon).toBe(true);
    expect(taskFlags(card({ dueAt: "2026-09-30T00:00:00.000Z" }), now).dueSoon).toBe(false);
  });

  it("đang chặn gộp việc vướng và việc quá hạn", () => {
    expect(taskFlags(card({ status: "blocked" }), now).blocking).toBe(true);
    expect(taskFlags(card({ dueAt: "2026-08-01T00:00:00.000Z" }), now).blocking).toBe(true);
    expect(taskFlags(card({}), now).blocking).toBe(false);
  });
});

describe("bộ lọc bảng công việc", () => {
  const now = new Date("2026-09-07T10:00:00.000Z");
  const tasks: TaskCard[] = [
    { id: "t1", stageId: "s1", title: "Đo trữ lượng", status: "todo", assigneeId: "u1", dueAt: null, position: 1 },
    { id: "t2", stageId: "s2", title: "Khảo sát ranh giới", status: "blocked", assigneeId: "u2", dueAt: null, position: 2 },
    { id: "t3", stageId: "s1", title: "Soạn PDD", status: "done", assigneeId: "u1", dueAt: "2026-01-01T00:00:00.000Z", position: 3 },
  ];
  const ctx = { viewerId: "u1", now };

  it("bộ lọc rỗng không lọc gì", () => {
    expect(filterTasks(tasks, EMPTY_TASK_FILTER, ctx)).toHaveLength(3);
    expect(isFilterActive(EMPTY_TASK_FILTER)).toBe(false);
  });

  it("tìm theo tên bỏ qua dấu tiếng Việt", () => {
    const found = filterTasks(tasks, { ...EMPTY_TASK_FILTER, text: "tru luong" }, ctx);
    expect(found.map((t) => t.id)).toEqual(["t1"]);
  });

  it("lọc theo người nhận, trạng thái và bước", () => {
    expect(filterTasks(tasks, { ...EMPTY_TASK_FILTER, assigneeId: "u2" }, ctx)).toHaveLength(1);
    expect(filterTasks(tasks, { ...EMPTY_TASK_FILTER, status: "done" }, ctx)).toHaveLength(1);
    expect(filterTasks(tasks, { ...EMPTY_TASK_FILTER, stageId: "s1" }, ctx)).toHaveLength(2);
  });

  it("'việc của tôi' so với người đang xem", () => {
    const mine = filterTasks(tasks, { ...EMPTY_TASK_FILTER, onlyMine: true }, ctx);
    expect(mine.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("'đang chặn' giữ việc vướng, bỏ việc đã xong dù quá hạn", () => {
    const blocking = filterTasks(tasks, { ...EMPTY_TASK_FILTER, onlyBlocking: true }, ctx);
    expect(blocking.map((t) => t.id)).toEqual(["t2"]);
  });

  it("nhiều điều kiện cùng lúc là phép AND", () => {
    const none = filterTasks(
      tasks,
      { ...EMPTY_TASK_FILTER, assigneeId: "u1", status: "blocked" },
      ctx,
    );
    expect(none).toEqual([]);
  });

  it("isFilterActive nhận ra mọi trục lọc", () => {
    expect(isFilterActive({ ...EMPTY_TASK_FILTER, text: "  " })).toBe(false);
    expect(isFilterActive({ ...EMPTY_TASK_FILTER, onlyBlocking: true })).toBe(true);
    expect(isFilterActive({ ...EMPTY_TASK_FILTER, stageId: "s1" })).toBe(true);
  });
});

describe("sắp xếp danh sách công việc", () => {
  const tasks: TaskCard[] = [
    { id: "a", stageId: "s2", title: "B", status: "done", assigneeId: "u2", dueAt: "2026-10-01T00:00:00.000Z", position: 1 },
    { id: "b", stageId: "s1", title: "A", status: "blocked", assigneeId: null, dueAt: null, position: 2 },
    { id: "c", stageId: "s1", title: "C", status: "todo", assigneeId: "u1", dueAt: "2026-09-01T00:00:00.000Z", position: 1 },
  ];
  const ctx = {
    stageOrdinal: (id: string) => (id === "s1" ? 1 : 2),
    memberName: (id: string | null) => (id === "u1" ? "An" : id === "u2" ? "Bình" : "￿"),
  };

  it("theo bước rồi position", () => {
    expect(sortTasks(tasks, "stage", ctx).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("theo trạng thái: vướng lên đầu, xong xuống cuối", () => {
    expect(sortTasks(tasks, "status", ctx).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("theo hạn: việc không đặt hạn xuống cuối, không lên đầu", () => {
    expect(sortTasks(tasks, "due", ctx).map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("theo người nhận, chưa giao xuống cuối", () => {
    expect(sortTasks(tasks, "assignee", ctx).map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("không đụng vào mảng gốc", () => {
    const before = tasks.map((t) => t.id);
    sortTasks(tasks, "title", ctx);
    expect(tasks.map((t) => t.id)).toEqual(before);
  });
});

describe("danh mục nhiều dự án", () => {
  const row = (over: Partial<PortfolioRow>): PortfolioRow => ({
    id: "p1",
    name: "Dự án A",
    description: "",
    deletedAt: null,
    standardCode: "VCS",
    methodologyCode: null,
    methodologyVersion: null,
    methodologySchemaHash: null,
    methodologyIsSample: false,
    standardLockedAt: null,
    methodologyLockedAt: null,
    dossierCount: 2,
    openTasks: 0,
    blockedTasks: 0,
    overdueTasks: 0,
    myOpenTasks: 0,
    latestPeriod: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  });

  it("lý do cần chú ý gộp việc vướng, việc quá hạn và lựa chọn chưa khoá", () => {
    const reasons = projectAttention(row({ blockedTasks: 2, overdueTasks: 1 }));
    expect(reasons).toEqual(["2 việc đang vướng", "1 việc quá hạn", "Chưa khoá Standard"]);
  });

  // Ngưỡng cũ là "bước đang duyệt đã tới số 3 chưa". Bỏ bước duyệt thì điều kiện thay
  // thế đọc thẳng từ hai cột và chính xác hơn: chưa CHỌN thì không có gì để khoá.
  it("chưa chọn Standard thì không nhắc chuyện khoá", () => {
    expect(projectAttention(row({ standardCode: null }))).toEqual([]);
  });

  it("nêu Methodology khi Standard đã khoá và Methodology đã chọn nhưng chưa khoá", () => {
    const reasons = projectAttention(
      row({
        standardLockedAt: "2026-09-01T00:00:00.000Z",
        methodologyCode: "DEMO-1",
      }),
    );
    expect(reasons).toEqual(["Chưa khoá Methodology"]);
  });

  it("dự án đã xoá không sinh lý do nào", () => {
    expect(projectAttention(row({ deletedAt: "2026-09-02T00:00:00.000Z", blockedTasks: 5 }))).toEqual([]);
  });

  it("mặc định ẩn dự án đã xoá, bật lên thì hiện", () => {
    const rows = [row({}), row({ id: "p2", deletedAt: "2026-09-02T00:00:00.000Z" })];
    expect(filterProjects(rows, EMPTY_PORTFOLIO_FILTER)).toHaveLength(1);
    expect(filterProjects(rows, { ...EMPTY_PORTFOLIO_FILTER, includeDeleted: true })).toHaveLength(2);
  });

  it("lọc theo Standard và tiến độ", () => {
    const rows = [
      row({ id: "p1", dossierCount: 7 }),
      row({ id: "p2", standardCode: "GS" }),
    ];
    expect(filterProjects(rows, { ...EMPTY_PORTFOLIO_FILTER, standard: "GS" })).toHaveLength(1);
    expect(filterProjects(rows, { ...EMPTY_PORTFOLIO_FILTER, progress: "designed" })).toHaveLength(1);
    expect(filterProjects(rows, { ...EMPTY_PORTFOLIO_FILTER, progress: "planning" })).toHaveLength(1);
  });

  it("tìm được cả trong mô tả và bỏ qua dấu", () => {
    const rows = [row({ description: "Rừng ngập mặn Cà Mau" })];
    expect(filterProjects(rows, { ...EMPTY_PORTFOLIO_FILTER, text: "ngap man" })).toHaveLength(1);
  });

  it("'đang có việc chặn' dùng đúng projectAttention", () => {
    const rows = [row({ id: "p1", standardCode: null }), row({ id: "p2", blockedTasks: 1 })];
    const found = filterProjects(rows, { ...EMPTY_PORTFOLIO_FILTER, onlyAttention: true });
    expect(found.map((r) => r.id)).toEqual(["p2"]);
  });

  it("sắp xếp theo tiến độ, theo việc chặn và theo kỳ giám sát", () => {
    const rows = [
      row({ id: "p1", dossierCount: 1, blockedTasks: 0 }),
      row({ id: "p2", dossierCount: 5, blockedTasks: 3 }),
      row({
        id: "p3",
        dossierCount: 3,
        latestPeriod: { name: "K1", startDate: "2026-01-01", endDate: "2026-06-30", version: 1, status: "open" },
      }),
    ];
    expect(sortProjects(rows, "progress").map((r) => r.id)).toEqual(["p2", "p3", "p1"]);
    expect(sortProjects(rows, "attention")[0].id).toBe("p2");
    expect(sortProjects(rows, "period")[0].id).toBe("p3");
  });
});

describe("khối lượng theo người và việc mồ côi", () => {
  const now = new Date("2026-09-07T10:00:00.000Z");
  const tasks: TaskCard[] = [
    { id: "t1", stageId: "s1", title: "A", status: "in_progress", assigneeId: "u1", dueAt: "2026-08-01T00:00:00.000Z", position: 1 },
    { id: "t2", stageId: "s1", title: "B", status: "done", assigneeId: "u1", dueAt: null, position: 2 },
    { id: "t3", stageId: "s1", title: "C", status: "blocked", assigneeId: "u9", dueAt: null, position: 3 },
    { id: "t4", stageId: "s1", title: "D", status: "todo", assigneeId: null, dueAt: null, position: 4 },
  ];

  it("đếm theo trạng thái, và việc đã xong không tính vào 'đang mở'", () => {
    const w = workloadByAssignee(tasks, now).get("u1");
    expect(w).toEqual({ todo: 0, inProgress: 1, blocked: 0, overdue: 1, done: 1, open: 1 });
  });

  it("việc chưa giao không thuộc về ai", () => {
    expect(workloadByAssignee(tasks, now).has("")).toBe(false);
    expect([...workloadByAssignee(tasks, now).keys()].sort()).toEqual(["u1", "u9"]);
  });

  it("nhận ra việc còn giao cho người đã rời dự án", () => {
    const orphans = orphanedAssignments(tasks, ["u1"]);
    expect(orphans.map((t) => t.id)).toEqual(["t3"]);
  });

  it("việc chưa giao không phải việc mồ côi", () => {
    expect(orphanedAssignments(tasks, ["u1", "u9"])).toEqual([]);
  });
});
