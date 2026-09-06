import { describe, expect, it } from "vitest";
import type { FormField } from "@/lib/methodology/form";
import {
  incompleteRecords,
  observedRange,
  summariseObservations,
} from "@/components/monitoring/summary";

/**
 * Lớp gom số liệu để đối chiếu với baseline (`PLAN.md` §4). Thuần, không chạm DB.
 *
 * Điểm cần khoá lại: số học phải đi qua `Decimal` của lõi chứ không phải `number` của
 * JavaScript — dữ liệu vào là chuỗi thập phân chính xác, và IEEE-754 làm hỏng đúng thứ
 * cả hệ thống cố giữ.
 */

function field(id: string, control: FormField["control"], extra: Partial<FormField> = {}): FormField {
  return {
    id,
    label: id,
    scope: "observation",
    control,
    unit: "t",
    required: false,
    constraints: undefined,
    options: [],
    group: "g",
    order: 0,
    aliases: [],
    accepted_units: ["t"],
    ...extra,
  } as FormField;
}

describe("gom chỉ số quan sát", () => {
  const obs = [field("area", "decimal"), field("count", "integer"), field("note", "text")];

  it("đếm, nhỏ nhất, lớn nhất, trung bình cho chỉ số dạng số", () => {
    const [area] = summariseObservations(obs, [], {}, [
      { metric_values: { area: "1.5" } },
      { metric_values: { area: "2.5" } },
      { metric_values: { area: "4.0" } },
    ]);
    expect(area.count).toBe(3);
    expect(area.min).toBe("1.5");
    expect(area.max).toBe("4");
    expect(area.mean).toBe("2.6667");
  });

  it("giữ chính xác thập phân — không đi qua dấu phẩy động", () => {
    // 0.1 + 0.2 trong IEEE-754 là 0.30000000000000004; trung bình phải là đúng 0.15.
    const [area] = summariseObservations(obs, [], {}, [
      { metric_values: { area: "0.1" } },
      { metric_values: { area: "0.2" } },
    ]);
    expect(area.mean).toBe("0.1500");
  });

  it("giữ được số rất nhiều chữ số mà number sẽ làm tròn mất", () => {
    const [area] = summariseObservations(obs, [], {}, [
      { metric_values: { area: "12345678901234567890.5" } },
    ]);
    expect(area.min).toBe("12345678901234567890.5");
  });

  it("chỉ số dạng chữ chỉ đếm, không tính min/max/trung bình", () => {
    const summaries = summariseObservations(obs, [], {}, [
      { metric_values: { note: "ổn" } },
      { metric_values: { note: "" } },
    ]);
    const note = summaries.find((s) => s.fieldId === "note")!;
    expect(note.count).toBe(1);
    expect(note.min).toBeNull();
    expect(note.mean).toBeNull();
  });

  it("bỏ qua ô trống và ô thiếu, không tính là 0", () => {
    const [area] = summariseObservations(obs, [], {}, [
      { metric_values: { area: "10" } },
      { metric_values: {} },
      { metric_values: { area: null } },
    ]);
    expect(area.count).toBe(1);
    expect(area.mean).toBe("10.0000");
  });

  it("không có dữ liệu thì trả null thay vì 0", () => {
    const [area] = summariseObservations(obs, [], {}, []);
    expect(area).toMatchObject({ count: 0, min: null, max: null, mean: null });
  });

  it("giá trị hỏng không làm vỡ cả bảng tổng kết", () => {
    const [area] = summariseObservations(obs, [], {}, [
      { metric_values: { area: "12" } },
      { metric_values: { area: "không phải số" } },
    ]);
    expect(area.count).toBe(2);
    expect(area.mean).toBe("12.0000");
  });

  it("số nguyên gửi lên dạng number vẫn gom được", () => {
    const count = summariseObservations(obs, [], {}, [
      { metric_values: { count: 3 } },
      { metric_values: { count: 5 } },
    ]).find((s) => s.fieldId === "count")!;
    expect(count.mean).toBe("4.0000");
  });
});

describe("đối chiếu baseline", () => {
  it("chỉ ghép khi Methodology khai baseline TRÙNG ĐÚNG id", () => {
    const obs = [field("stock", "decimal")];
    const base = [field("stock", "decimal", { scope: "baseline" })];
    const [row] = summariseObservations(obs, base, { stock: "100" }, [
      { metric_values: { stock: "120" } },
    ]);
    expect(row.baseline).toBe("100");
  });

  it("không đoán theo tên gần giống — id khác thì để trống", () => {
    const obs = [field("stock_after", "decimal")];
    const base = [field("stock_before", "decimal", { scope: "baseline" })];
    const [row] = summariseObservations(obs, base, { stock_before: "100" }, [
      { metric_values: { stock_after: "120" } },
    ]);
    expect(row.baseline).toBeNull();
  });

  it("baseline khai nhưng chưa nhập giá trị thì để trống", () => {
    const obs = [field("stock", "decimal")];
    const base = [field("stock", "decimal", { scope: "baseline" })];
    const [row] = summariseObservations(obs, base, {}, [{ metric_values: { stock: "1" } }]);
    expect(row.baseline).toBeNull();
  });
});

describe("cảnh báo trước khi khoá kỳ", () => {
  const obs = [
    field("area", "decimal", { required: true }),
    field("note", "text", { required: false }),
  ];

  it("nêu đích danh quan sát thiếu chỉ số bắt buộc", () => {
    const result = incompleteRecords(obs, [
      { record_key: "O-1", metric_values: { area: "1" } },
      { record_key: "O-2", metric_values: { note: "x" } },
      { record_key: "O-3", metric_values: { area: "" } },
    ]);
    expect(result.map((r) => r.recordKey)).toEqual(["O-2", "O-3"]);
    expect(result[0].missing).toEqual(["area"]);
  });

  it("đủ dữ liệu thì không cảnh báo gì", () => {
    expect(incompleteRecords(obs, [{ record_key: "O-1", metric_values: { area: "1" } }])).toEqual([]);
  });

  it("khoảng ngày thực tế lấy từ dữ liệu, không từ khai báo của kỳ", () => {
    expect(
      observedRange([
        { observed_on: "2026-03-05" },
        { observed_on: "2026-01-02" },
        { observed_on: "2026-02-01" },
      ]),
    ).toEqual({ first: "2026-01-02", last: "2026-03-05" });
    expect(observedRange([])).toBeNull();
  });
});
