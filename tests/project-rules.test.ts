import { describe, expect, it } from "vitest";
import {
  TASK_STATUSES,
  abilitiesFor,
  approvalBlockers,
  approvedCount,
  assignableMembers,
  groupTasksByStage,
  isDocumentKind,
  isTaskStatus,
  nextPosition,
  nextStageToApprove,
  parseDueDate,
  toStageView,
  toTaskCard,
  validateCommentBody,
  validateProjectName,
  validateTaskTitle,
  type StageView,
  type TaskCard,
} from "@/components/project/rules";

/**
 * Logic thuần của Module A. Đây là lớp cho GIAO DIỆN biết nên khoá gì — lớp chặn thật là
 * RLS và RPC trong `0013_project_platform.sql`, đã kiểm riêng bằng `tests/db/`.
 */

const stages = (approved: number[]): StageView[] =>
  Array.from({ length: 7 }, (_, i) => ({
    id: `s${i + 1}`,
    ordinal: i + 1,
    title: `Bước ${i + 1}`,
    approvedAt: approved.includes(i + 1) ? "2026-09-06T00:00:00.000Z" : null,
  }));

const OPEN = {
  standardId: null,
  methodologyId: null,
  standardLockedAt: null,
  methodologyLockedAt: null,
};
const LOCKED = {
  standardId: "std",
  methodologyId: "meth",
  standardLockedAt: "2026-09-01T00:00:00.000Z",
  methodologyLockedAt: "2026-09-02T00:00:00.000Z",
};

describe("quyền trong dự án — không còn vai trò (chính sách 09/09/2026)", () => {
  it("thành viên có đủ mọi quyền, gồm duyệt bước, quản lý thành viên và xoá dự án", () => {
    const a = abilitiesFor();
    expect(Object.values(a).every(Boolean)).toBe(true);
  });

  // Ràng buộc còn lại DUY NHẤT sau khi bỏ phân quyền — phải có test canh.
  it("dự án đã xoá mềm thì mọi đường ghi đóng lại", () => {
    const a = abilitiesFor(true);
    expect(Object.values(a).some(Boolean)).toBe(false);
  });

  // Hàm không còn nhận vai trò: nếu ai đó thêm lại tham số đó, ca này gãy chứ không
  // âm thầm cho phép giao diện phân biệt vai trò trở lại.
  it("không nhận vai trò làm tham số nữa", () => {
    expect(abilitiesFor.length).toBe(0);
  });
});

describe("duyệt bước — chép đúng điều kiện của approve_project_stage", () => {
  it("bước 1 duyệt được ngay", () => {
    expect(approvalBlockers(stages([]), 1, OPEN)).toEqual([]);
  });

  it("không nhảy cóc: bước 2 cần bước 1 xong", () => {
    expect(approvalBlockers(stages([]), 2, OPEN)).toContain("Cần duyệt bước 1 trước.");
  });

  it("bước 3 trở đi cần khoá Standard", () => {
    const blockers = approvalBlockers(stages([1, 2]), 3, OPEN);
    expect(blockers).toContain("Chưa khoá Standard (bước 3).");
  });

  it("bước 4 trở đi cần khoá cả Methodology", () => {
    const partial = { ...OPEN, standardId: "std", standardLockedAt: "2026-09-01T00:00:00.000Z" };
    expect(approvalBlockers(stages([1, 2, 3]), 4, partial)).toEqual([
      "Chưa khoá Methodology (bước 4).",
    ]);
  });

  it("đủ điều kiện thì không còn rào nào", () => {
    expect(approvalBlockers(stages([1, 2, 3, 4]), 5, LOCKED)).toEqual([]);
  });

  it("bước đã duyệt không duyệt lại", () => {
    expect(approvalBlockers(stages([1]), 1, OPEN)).toEqual(["Bước này đã được duyệt."]);
  });

  it("gộp nhiều lý do cùng lúc", () => {
    expect(approvalBlockers(stages([]), 5, OPEN)).toHaveLength(3);
  });

  it("bước kế tiếp và số bước đã duyệt", () => {
    expect(nextStageToApprove(stages([1, 2]))?.ordinal).toBe(3);
    expect(nextStageToApprove(stages([1, 2, 3, 4, 5, 6, 7]))).toBeNull();
    expect(approvedCount(stages([1, 2, 5]))).toBe(3);
  });
});

describe("hợp lệ hoá đầu vào — khớp ràng buộc check của 0013", () => {
  it("tên công việc 1–300 ký tự", () => {
    expect(validateTaskTitle("  Thu thập dữ liệu  ")).toEqual({ ok: true, value: "Thu thập dữ liệu" });
    expect(validateTaskTitle("   ").ok).toBe(false);
    expect(validateTaskTitle("x".repeat(301)).ok).toBe(false);
    expect(validateTaskTitle("x".repeat(300)).ok).toBe(true);
  });

  it("tên dự án 1–200 ký tự", () => {
    expect(validateProjectName("x".repeat(200)).ok).toBe(true);
    expect(validateProjectName("x".repeat(201)).ok).toBe(false);
    expect(validateProjectName(42).ok).toBe(false);
  });

  it("bình luận 1–20.000 ký tự", () => {
    expect(validateCommentBody("ok").ok).toBe(true);
    expect(validateCommentBody("x".repeat(20001)).ok).toBe(false);
  });

  it("hạn hoàn thành: rỗng là bỏ hạn, sai định dạng bị chặn", () => {
    expect(parseDueDate("")).toEqual({ ok: true, value: null });
    expect(parseDueDate("2026-09-30")).toEqual({
      ok: true,
      value: "2026-09-30T00:00:00.000Z",
    });
    expect(parseDueDate("30/09/2026").ok).toBe(false);
    expect(parseDueDate("2026-13-45").ok).toBe(false);
  });
});

describe("bảng kanban", () => {
  const cards: TaskCard[] = [
    { id: "t1", stageId: "s2", title: "B", status: "todo", assigneeId: null, dueAt: null, position: 2000 },
    { id: "t2", stageId: "s1", title: "A", status: "done", assigneeId: "u1", dueAt: null, position: 1000 },
    { id: "t3", stageId: "s1", title: "C", status: "blocked", assigneeId: null, dueAt: null, position: 500 },
  ];

  it("đủ bảy cột đúng thứ tự kể cả cột rỗng", () => {
    const columns = groupTasksByStage(stages([]), cards);
    expect(columns).toHaveLength(7);
    expect(columns.map((c) => c.stage.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(columns[6].tasks).toEqual([]);
  });

  it("card xếp theo position rồi tới tên", () => {
    const columns = groupTasksByStage(stages([]), cards);
    expect(columns[0].tasks.map((t) => t.id)).toEqual(["t3", "t2"]);
  });

  it("card trỏ vào stage lạ bị bỏ qua, không làm hỏng bảng", () => {
    const orphan: TaskCard = { ...cards[0], id: "t9", stageId: "khong-ton-tai" };
    const columns = groupTasksByStage(stages([]), [...cards, orphan]);
    expect(columns.flatMap((c) => c.tasks).map((t) => t.id)).not.toContain("t9");
  });

  it("position kế tiếp luôn lớn hơn mọi card đang có", () => {
    expect(nextPosition([])).toBe(1000);
    expect(nextPosition(cards)).toBe(3000);
  });
});

describe("giao việc cho mọi thành viên", () => {
  // 0025 thay khoá ngoại ba cột `(project_id, assignee_id, assignee_role)` bằng khoá
  // ngoại hai cột tới `project_members(project_id, user_id)`. Điều kiện còn lại đúng
  // bằng "là thành viên", nên danh sách người nhận việc không được lọc bớt ai.
  it("không lọc bớt ai khỏi danh sách người nhận việc", () => {
    const members = [
      { userId: "u1", role: "owner" as const },
      { userId: "u2", role: "developer" as const },
      { userId: "u3", role: "viewer" as const },
    ];
    expect(assignableMembers(members).map((m) => m.userId)).toEqual(["u1", "u2", "u3"]);
  });
});

describe("chuyển đổi hàng cơ sở dữ liệu", () => {
  it("stage sang hình dạng giao diện", () => {
    expect(toStageView({ id: "s1", ordinal: 1, title: "T", approved_at: null })).toEqual({
      id: "s1",
      ordinal: 1,
      title: "T",
      approvedAt: null,
    });
  });

  it("trạng thái lạ rơi về todo thay vì làm vỡ giao diện", () => {
    const card = toTaskCard({
      id: "t1",
      stage_id: "s1",
      title: "X",
      status: "khong-biet",
      assignee_id: null,
      due_at: null,
      position: 0,
    });
    expect(card.status).toBe("todo");
  });

  it("bốn trạng thái khớp check của 0013", () => {
    expect([...TASK_STATUSES]).toEqual(["todo", "in_progress", "done", "blocked"]);
    expect(isTaskStatus("done")).toBe(true);
    expect(isTaskStatus("archived")).toBe(false);
  });

  it("loại tài liệu khớp check của 0013", () => {
    expect(isDocumentKind("pdd")).toBe(true);
    expect(isDocumentKind("nothing")).toBe(false);
  });
});
