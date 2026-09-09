import { describe, expect, it } from "vitest";
import {
  columnDeleteBlocker,
  groupTasksByColumn,
  insertIndexFor,
  nextColumnPosition,
  nextPosition,
  placeIntoColumn,
  positionBetween,
  reorderColumns,
  reorderWithinColumn,
  sortColumns,
  statusForColumnName,
  validateColumnName,
  type BoardColumnView,
  type BoardTaskCard,
} from "@/components/project/rules";

const col = (id: string, name: string, position: number): BoardColumnView => ({
  id,
  name,
  position,
});

const card = (
  id: string,
  columnId: string | null,
  position: number,
  title = id,
): BoardTaskCard => ({
  id,
  stageId: "stage-1",
  title,
  status: "todo",
  assigneeId: null,
  dueAt: null,
  position,
  columnId,
});

describe("thứ tự cột", () => {
  it("xếp theo position, hoà thì theo tên để không đảo giữa hai lần render", () => {
    const ordered = sortColumns([
      col("c", "Ghi", 2000),
      col("b", "Beta", 1000),
      col("a", "Alpha", 1000),
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("cột mới đi vào cuối bảng theo bậc thang 1000", () => {
    expect(nextColumnPosition([])).toBe(1000);
    expect(nextColumnPosition([col("a", "A", 1000), col("b", "B", 2000)])).toBe(3000);
  });
});

describe("gom card theo cột", () => {
  it("card rơi đúng cột, cột rỗng vẫn xuất hiện", () => {
    const result = groupTasksByColumn(
      [col("a", "Chưa làm", 1000), col("b", "Đang làm", 2000), col("c", "Trống", 3000)],
      [card("t1", "a", 1000), card("t2", "b", 1000)],
    );

    expect(result.columns.map((c) => [c.column.id, c.tasks.map((t) => t.id)])).toEqual([
      ["a", ["t1"]],
      ["b", ["t2"]],
      ["c", []],
    ]);
    expect(result.orphans).toEqual([]);
  });

  it("xếp trong cột theo position rồi mới tới title", () => {
    const result = groupTasksByColumn(
      [col("a", "A", 1000)],
      [card("late", "a", 2000, "B"), card("z", "a", 1000, "Z"), card("m", "a", 1000, "M")],
    );
    expect(result.columns[0].tasks.map((t) => t.id)).toEqual(["m", "z", "late"]);
  });

  it("card chưa xếp cột hoặc trỏ vào cột lạ rơi vào orphans, KHÔNG bị mất", () => {
    const result = groupTasksByColumn(
      [col("a", "A", 1000)],
      [card("t1", "a", 1000), card("chua-xep", null, 1000), card("cot-la", "khong-ton-tai", 1000)],
    );

    expect(result.columns[0].tasks.map((t) => t.id)).toEqual(["t1"]);
    expect(result.orphans.map((t) => t.id).sort()).toEqual(["chua-xep", "cot-la"]);
  });
});

describe("chèn giữa bằng bậc thang 1000", () => {
  it("hai đầu trống, chèn đầu, chèn cuối, chèn giữa", () => {
    expect(positionBetween(null, null)).toBe(1000);
    expect(positionBetween(null, 1000)).toBe(0);
    expect(positionBetween(3000, null)).toBe(4000);
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it("dùng chung bậc thang với nextPosition đang có", () => {
    expect(nextPosition([])).toBe(1000);
    expect(positionBetween(nextPosition([]), null)).toBe(2000);
  });
});

describe("kéo sắp xếp card trong cùng một cột", () => {
  const ordered = [card("a", "col", 1000), card("b", "col", 2000), card("c", "col", 3000)];

  it("thả lại đúng chỗ cũ thì không ghi gì", () => {
    expect(reorderWithinColumn(ordered, "b", 1)).toEqual([]);
  });

  it("kéo card cuối lên đầu chỉ ghi một dòng", () => {
    expect(reorderWithinColumn(ordered, "c", 0)).toEqual([{ id: "c", position: 0 }]);
  });

  it("kéo card đầu xuống giữa lấy điểm giữa hai hàng xóm", () => {
    expect(reorderWithinColumn(ordered, "a", 1)).toEqual([{ id: "a", position: 2500 }]);
  });

  it("kéo xuống cuối thì nối tiếp bậc thang", () => {
    expect(reorderWithinColumn(ordered, "a", 2)).toEqual([{ id: "a", position: 4000 }]);
  });

  it("index vượt biên bị kẹp về cuối danh sách", () => {
    expect(reorderWithinColumn(ordered, "a", 99)).toEqual([{ id: "a", position: 4000 }]);
  });

  it("hàng xóm trùng position thì đánh số lại cả cột theo bậc thang 1000", () => {
    const tied = [card("x", "col", 0), card("y", "col", 0), card("z", "col", 0)];
    expect(reorderWithinColumn(tied, "z", 1)).toEqual([
      { id: "x", position: 1000 },
      { id: "z", position: 2000 },
      { id: "y", position: 3000 },
    ]);
  });

  it("id lạ thì không ghi gì", () => {
    expect(reorderWithinColumn(ordered, "khong-co", 0)).toEqual([]);
  });
});

describe("kéo đổi thứ tự cột", () => {
  const columns = [col("a", "A", 1000), col("b", "B", 2000), col("c", "C", 3000)];

  it("kéo cột cuối lên đầu", () => {
    expect(reorderColumns(columns, "c", 0)).toEqual([{ id: "c", position: 0 }]);
  });

  it("thả lại chỗ cũ thì không ghi gì", () => {
    expect(reorderColumns(columns, "a", 0)).toEqual([]);
  });

  it("kéo lên đầu bảng vẫn còn nguyên một bậc thang để lùi", () => {
    const tied = [col("x", "X", 5), col("y", "Y", 5)];
    expect(reorderColumns(tied, "y", 0)).toEqual([{ id: "y", position: -995 }]);
  });

  it("chèn vào giữa hai cột trùng position thì đánh số lại cả bảng", () => {
    const tied = [col("x", "X", 5), col("y", "Y", 5), col("z", "Z", 5)];
    expect(reorderColumns(tied, "z", 1)).toEqual([
      { id: "x", position: 1000 },
      { id: "z", position: 2000 },
      { id: "y", position: 3000 },
    ]);
  });
});

describe("ánh xạ tên cột mặc định sang status — chỉ dùng làm cầu ghi status", () => {
  it("bốn tên mặc định ánh xạ được, không phân biệt hoa thường và khoảng trắng", () => {
    expect(statusForColumnName("Chưa làm")).toBe("todo");
    expect(statusForColumnName("  đang làm  ")).toBe("in_progress");
    expect(statusForColumnName("XONG")).toBe("done");
    expect(statusForColumnName("Vướng")).toBe("blocked");
  });

  it("cột người dùng tự tạo KHÔNG ánh xạ được — giữ nguyên status cũ", () => {
    expect(statusForColumnName("Đang review")).toBeNull();
    expect(statusForColumnName("Done")).toBeNull();
    expect(statusForColumnName("")).toBeNull();
    expect(statusForColumnName(null)).toBeNull();
    expect(statusForColumnName(42)).toBeNull();
  });
});

describe("tên cột hợp lệ", () => {
  it("nhận tên thường, cắt khoảng trắng thừa", () => {
    expect(validateColumnName("  Đang review  ")).toEqual({ ok: true, value: "Đang review" });
  });

  it("từ chối rỗng và quá 60 ký tự", () => {
    expect(validateColumnName("   ").ok).toBe(false);
    expect(validateColumnName("x".repeat(61)).ok).toBe(false);
    expect(validateColumnName("x".repeat(60)).ok).toBe(true);
  });

  it("từ chối trùng tên cột đã có, không phân biệt hoa thường", () => {
    const result = validateColumnName("chưa làm", ["Chưa làm", "Đang làm"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Chưa làm");
  });

  it("đổi tên chính nó thì không tính là trùng", () => {
    expect(validateColumnName("Chưa làm", ["Đang làm"]).ok).toBe(true);
  });
});

describe("chặn xoá cột", () => {
  const tasks = [card("t1", "a", 1000), card("t2", "a", 2000), card("t3", "b", 1000)];

  it("cột còn task báo rõ còn bao nhiêu việc", () => {
    const message = columnDeleteBlocker("a", tasks, 3);
    expect(message).toContain("2 công việc");
  });

  it("cột rỗng xoá được", () => {
    expect(columnDeleteBlocker("c", tasks, 3)).toBeNull();
  });

  it("không cho xoá cột cuối cùng của bảng", () => {
    expect(columnDeleteBlocker("c", [], 1)).toBe("Bảng phải còn ít nhất một cột.");
  });
});

describe("thả card sang cột khác", () => {
  const target = [card("a", "dich", 1000), card("b", "dich", 2000)];
  const moving = card("m", "nguon", 7000);

  it("thả vào đầu cột đích", () => {
    expect(placeIntoColumn(target, moving, 0)).toEqual([{ id: "m", position: 0 }]);
  });

  it("thả vào giữa hai card của cột đích", () => {
    expect(placeIntoColumn(target, moving, 1)).toEqual([{ id: "m", position: 1500 }]);
  });

  it("thả vào cuối cột đích", () => {
    expect(placeIntoColumn(target, moving, 2)).toEqual([{ id: "m", position: 3000 }]);
  });

  it("thả vào cột rỗng", () => {
    expect(placeIntoColumn([], moving, 0)).toEqual([{ id: "m", position: 1000 }]);
  });

  it("cột đích trùng position thì đánh số lại cả cột đích", () => {
    const tied = [card("x", "dich", 4), card("y", "dich", 4)];
    expect(placeIntoColumn(tied, moving, 1)).toEqual([
      { id: "x", position: 1000 },
      { id: "m", position: 2000 },
      { id: "y", position: 3000 },
    ]);
  });
});

describe("chỗ chèn khi bộ lọc đang ẩn bớt card", () => {
  const full = [
    card("a", "col", 1000),
    card("an", "col", 2000),
    card("b", "col", 3000),
    card("bn", "col", 4000),
  ];

  it("không lọc: chỗ chèn trùng luôn với chỗ nhìn thấy", () => {
    expect(insertIndexFor(full, full, 0, "b")).toBe(0);
    expect(insertIndexFor(full, full, 2, "b")).toBe(2);
  });

  it("bỏ card đang kéo ra khỏi hệ toạ độ", () => {
    // "b" đang kéo; thả ngay trước "bn" nghĩa là vị trí 2 của [a, an, bn].
    expect(insertIndexFor(full, full, 3, "b")).toBe(2);
  });

  it("thả xuống cuối danh sách đang hiện", () => {
    expect(insertIndexFor(full, full, 4, "b")).toBe(3);
  });

  it("neo vào card THẬT chứ không vào ô thứ mấy của danh sách đã lọc", () => {
    // Bộ lọc chỉ còn "a" và "bn"; thả ở ô 1 nghĩa là ngay trên "bn".
    const shown = [full[0], full[3]];
    expect(insertIndexFor(full, shown, 1, "b")).toBe(2);
  });

  it("thả sau card cuối cùng đang hiện thì xuống cuối danh sách thật", () => {
    const shown = [full[0]];
    expect(insertIndexFor(full, shown, 1, "b")).toBe(3);
  });

  it("card đang kéo không tự neo vào chính nó", () => {
    const shown = [full[2], full[3]];
    expect(insertIndexFor(full, shown, 0, "b")).toBe(2);
  });
});
