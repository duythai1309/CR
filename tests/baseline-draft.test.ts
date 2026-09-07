import { describe, expect, it } from "vitest";
import { parseBaselineDraftValues } from "@/types/project-setup";

const schema = {
  decimal_encoding: "ASCII decimal string; không dùng ký pháp exponent",
  fields: [
    { id: "baseline_stock", scope: "baseline", type: "decimal" },
    { id: "baseline_years", scope: "baseline", type: "integer" },
    { id: "observation_area", scope: "observation", type: "decimal" },
  ],
};

const proposal = (value: unknown) => ({
  value,
  reason: "Payload cho biết giá trị này.",
  source: "baseline_check và methodology_fields.",
});

describe("parser bản nháp baseline", () => {
  it("loại field ngoài metric_schema và field sai scope", () => {
    const parsed = parseBaselineDraftValues(
      JSON.stringify({
        values: {
          baseline_stock: proposal("12.50"),
          observation_area: proposal("30"),
          model_bia_ra: proposal("999"),
        },
      }),
      schema,
      {},
    );

    expect(parsed).toEqual({
      baseline_stock: {
        value: "12.50",
        reason: "Payload cho biết giá trị này.",
        source: "baseline_check và methodology_fields.",
      },
    });
  });

  it("loại giá trị không phải số canonical theo decimal_encoding", () => {
    const parsed = parseBaselineDraftValues(
      JSON.stringify({
        values: {
          baseline_stock: proposal("12,5"),
          baseline_years: proposal("3.5"),
        },
      }),
      schema,
      {},
    );

    expect(parsed).toEqual({});
  });

  it("trả rỗng an toàn khi model trả rác hoặc output rỗng", () => {
    expect(parseBaselineDraftValues("không phải JSON", schema, {})).toEqual({});
    expect(parseBaselineDraftValues('{"values":{}}', schema, {})).toEqual({});
    expect(parseBaselineDraftValues("", schema, {})).toEqual({});
  });

  it("không đề xuất đè lên field người dùng đã điền", () => {
    const parsed = parseBaselineDraftValues(
      JSON.stringify({
        values: {
          baseline_stock: proposal("99"),
          baseline_years: proposal("10"),
        },
      }),
      schema,
      { baseline_stock: "42.25" },
    );

    expect(parsed).toEqual({
      baseline_years: {
        value: 10,
        reason: "Payload cho biết giá trị này.",
        source: "baseline_check và methodology_fields.",
      },
    });
  });
});
