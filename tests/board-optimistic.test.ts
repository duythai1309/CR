import { describe, expect, it, vi } from "vitest";

// Hook nằm cùng tệp với phần thuần, mà tệp đó kéo theo server action ("use server") và
// `next/navigation`. Test này chỉ kiểm phần THUẦN, nên chặn hai nhánh nhập đó lại để không
// phải dựng cả môi trường Next chỉ để gọi một hàm không có tác dụng phụ.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/app/du-an/[id]/actions", () => ({
  applyColumnOrder: async () => null,
  bulkUpdateTasks: async () => null,
  createBoardColumn: async () => null,
  deleteBoardColumn: async () => null,
  moveTask: async () => null,
  moveTaskToColumn: async () => null,
  renameBoardColumn: async () => null,
  reorderTasksInColumn: async () => null,
  setTaskStatus: async () => null,
}));

const {
  applyOptimisticPatch,
  bridgedStatusFor,
  settleWrite,
} = await import("@/components/project/board/use-board-actions");
type BoardTaskCard = import("@/components/project/rules").BoardTaskCard;

const card = (
  id: string,
  columnId: string | null,
  position: number,
  status: BoardTaskCard["status"] = "todo",
): BoardTaskCard => ({
  id,
  stageId: "stage-1",
  title: id,
  status,
  assigneeId: null,
  dueAt: null,
  position,
  columnId,
});

const base = () => [
  card("t1", "col-a", 1000),
  card("t2", "col-a", 2000),
  card("t3", "col-b", 1000, "done"),
];

describe("áp thay đổi lạc quan", () => {
  it("đổi cột đúng card, các card khác giữ nguyên", () => {
    const next = applyOptimisticPatch(base(), { taskId: "t1", columnId: "col-b" });
    expect(next.find((t) => t.id === "t1")?.columnId).toBe("col-b");
    expect(next.find((t) => t.id === "t2")?.columnId).toBe("col-a");
  });

  it("đổi trạng thái đúng card", () => {
    const next = applyOptimisticPatch(base(), { taskId: "t1", status: "blocked" });
    expect(next.find((t) => t.id === "t1")?.status).toBe("blocked");
    expect(next.find((t) => t.id === "t3")?.status).toBe("done");
  });

  it("áp vị trí mới cho nhiều card cùng lúc khi sắp xếp lại", () => {
    const next = applyOptimisticPatch(base(), {
      rows: [
        { id: "t2", position: 500 },
        { id: "t1", position: 1500 },
      ],
    });
    expect(next.find((t) => t.id === "t2")?.position).toBe(500);
    expect(next.find((t) => t.id === "t1")?.position).toBe(1500);
    expect(next.find((t) => t.id === "t3")?.position).toBe(1000);
  });

  it("đổi cột kèm status và vị trí trong một lượt", () => {
    const next = applyOptimisticPatch(base(), {
      taskId: "t1",
      columnId: "col-b",
      status: "done",
      rows: [{ id: "t1", position: 3000 }],
    });
    const moved = next.find((t) => t.id === "t1");
    expect(moved).toMatchObject({ columnId: "col-b", status: "done", position: 3000 });
  });

  it("patch rỗng thì không đổi gì", () => {
    const input = base();
    expect(applyOptimisticPatch(input, {})).toEqual(input);
  });

  it("id lạ thì không đụng card nào", () => {
    const input = base();
    expect(applyOptimisticPatch(input, { taskId: "khong-co", columnId: "col-b" })).toEqual(input);
  });
});

describe("KHÔNG sửa tại chỗ — điều kiện để quay về được trạng thái cũ", () => {
  it("mảng gốc và từng card trong đó không bị đụng", () => {
    const input = base();
    const snapshot = structuredClone(input);

    applyOptimisticPatch(input, {
      taskId: "t1",
      columnId: "col-b",
      status: "blocked",
      rows: [{ id: "t2", position: 9999 }],
    });

    expect(input).toEqual(snapshot);
  });

  it("trả về mảng MỚI, không phải chính mảng truyền vào", () => {
    const input = base();
    expect(applyOptimisticPatch(input, { taskId: "t1", columnId: "col-b" })).not.toBe(input);
  });

  it("card không đổi được dùng lại nguyên object, card đổi thì là object mới", () => {
    const input = base();
    const next = applyOptimisticPatch(input, { taskId: "t1", columnId: "col-b" });
    expect(next[0]).not.toBe(input[0]);
    expect(next[1]).toBe(input[1]);
  });
});

describe("kết cục một lượt ghi", () => {
  it("thành công thì giữ thay đổi và tải lại dữ liệu", () => {
    expect(settleWrite(null)).toEqual({
      kept: true,
      error: null,
      notice: null,
      refresh: true,
    });
  });

  it("thành công kèm lời nhắn thì hiện lời nhắn", () => {
    expect(settleWrite(null, "Đã thêm cột.")).toMatchObject({
      kept: true,
      notice: "Đã thêm cột.",
      refresh: true,
    });
  });

  it("LỖI thì bỏ thay đổi, hiện nguyên văn lỗi, KHÔNG tải lại", () => {
    const outcome = settleWrite("Bạn không có quyền thao tác trên công việc của dự án này.");
    expect(outcome.kept).toBe(false);
    expect(outcome.error).toBe("Bạn không có quyền thao tác trên công việc của dự án này.");
    expect(outcome.notice).toBeNull();
    expect(outcome.refresh).toBe(false);
  });

  it("KHÔNG NUỐT LỖI: mọi thông báo lỗi đều nổi lên giao diện", () => {
    for (const message of [
      "Cột này còn 3 công việc. Kéo chúng sang cột khác rồi mới xoá được.",
      "Đã có cột trùng tên trong bảng này.",
      "Không lưu được công việc: hết thời gian chờ.",
    ]) {
      const outcome = settleWrite(message);
      expect(outcome.error, message).toBe(message);
      expect(outcome.kept, message).toBe(false);
    }
  });

  it("lỗi kèm lời nhắn thành công thì lời nhắn bị bỏ — không báo thành công khi đã hỏng", () => {
    expect(settleWrite("Hỏng rồi.", "Đã xoá cột.")).toMatchObject({
      kept: false,
      error: "Hỏng rồi.",
      notice: null,
    });
  });
});

describe("ĐƯỜNG LỖI: kéo card rồi máy chủ từ chối", () => {
  it("giao diện quay về ĐÚNG trạng thái trước khi kéo, từng trường một", () => {
    const server = base();
    const before = structuredClone(server);

    // 1. Người dùng kéo t1 từ col-a sang col-b — giao diện đổi ngay.
    const shown = applyOptimisticPatch(server, {
      taskId: "t1",
      columnId: "col-b",
      status: "done",
      rows: [{ id: "t1", position: 1500 }],
    });
    expect(shown.find((t) => t.id === "t1")).toMatchObject({
      columnId: "col-b",
      status: "done",
      position: 1500,
    });

    // 2. Server action từ chối.
    const outcome = settleWrite("Bạn không có quyền thao tác trên công việc của dự án này.");
    expect(outcome.kept).toBe(false);

    // 3. `useOptimistic` vứt lớp lạc quan và quay về mảng gốc.
    const after = outcome.kept ? shown : server;

    expect(after).toEqual(before);
    expect(after.find((t) => t.id === "t1")).toMatchObject({
      columnId: "col-a",
      status: "todo",
      position: 1000,
    });
    // Và người dùng được báo, không im lặng.
    expect(outcome.error).not.toBeNull();
  });

  it("sắp xếp lại thất bại thì mọi vị trí cũ còn nguyên", () => {
    const server = base();
    const before = structuredClone(server);

    const shown = applyOptimisticPatch(server, {
      rows: [
        { id: "t1", position: 5000 },
        { id: "t2", position: 6000 },
      ],
    });
    expect(shown.map((t) => t.position)).toEqual([5000, 6000, 1000]);

    const outcome = settleWrite("Cột có quá nhiều công việc để sắp xếp một lượt.");
    const after = outcome.kept ? shown : server;

    expect(after).toEqual(before);
    expect(after.map((t) => t.position)).toEqual([1000, 2000, 1000]);
  });

  it("thành công thì giữ nguyên thay đổi, KHÔNG quay về", () => {
    const server = base();
    const shown = applyOptimisticPatch(server, { taskId: "t1", columnId: "col-b" });
    const outcome = settleWrite(null);
    const after = outcome.kept ? shown : server;

    expect(after.find((t) => t.id === "t1")?.columnId).toBe("col-b");
    expect(outcome.error).toBeNull();
  });
});

describe("cầu status khi thả vào cột mặc định", () => {
  it("bốn cột mặc định suy ra được status, khớp với máy chủ", () => {
    expect(bridgedStatusFor("Chưa làm")).toBe("todo");
    expect(bridgedStatusFor("Đang làm")).toBe("in_progress");
    expect(bridgedStatusFor("Xong")).toBe("done");
    expect(bridgedStatusFor("Vướng")).toBe("blocked");
  });

  it("cột tự tạo thì KHÔNG đặt status — hiển thị lạc quan không được nói khác máy chủ", () => {
    expect(bridgedStatusFor("Đang review")).toBeUndefined();

    const next = applyOptimisticPatch(base(), {
      taskId: "t3",
      columnId: "col-custom",
      status: bridgedStatusFor("Đang review"),
    });
    expect(next.find((t) => t.id === "t3")?.status).toBe("done");
  });
});
