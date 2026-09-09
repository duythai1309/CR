import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateMethodology } from "@/lib/methodology/expression";
import { parseMetricSchema, validateValues } from "@/lib/methodology/schema";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0019_vm0051.sql"),
  "utf8",
);
const metricMatch = migration.match(/\$metric\$([\s\S]*?)\$metric\$/);
if (!metricMatch) throw new Error("Không tìm thấy metric_schema trong migration 0019");
const rawSchema: unknown = JSON.parse(metricMatch[1]);

const factors = [
  {
    key: "n2o_drying_correction",
    value: "0.00314",
    unit: "kgN2O/kgN",
    scope: {},
    source: "VM0051 v1.1, Eq. (25)",
  },
  {
    key: "kg_n2o_to_t_n2o",
    value: "0.001",
    unit: "tN2O/kgN2O",
    scope: {},
    source: "VM0051 v1.1, Eq. (25), 10^-3 kg-to-tonne conversion",
  },
];

describe("VM0051 v1.1 — partial transcription of Equation (25)", () => {
  it("giữ đúng ranh giới catalog: methodology thật nhưng chưa được chuyên gia xác nhận", () => {
    expect(migration).toMatch(/'VM0051',\s*\n\s*'1\.1'/);
    expect(migration).toMatch(/'draft',\s*\n\s*false,\s*\n\s*false,/);
    expect(migration).toContain("set status = 'published'");
    expect(migration).toContain("CHƯA ĐƯỢC CHUYÊN GIA ĐỐI CHIẾU");
  });

  it("metric_schema hợp lệ và chỉ chứa ba tham số đã truy nguồn", () => {
    const schema = parseMetricSchema(rawSchema);
    expect(schema.fields.map((field) => field.id)).toEqual([
      "gwp_n2o",
      "area_quantification_unit_ha",
      "nitrogen_input_rate_wp_kg_n_ha",
    ]);
    expect(schema.calculations.map((calculation) => calculation.id)).toEqual([
      "n2o_irrigation_change_deduction",
    ]);
    expect(schema.disclaimer).toContain("Chỉ tính Equation (25)");
  });

  it("validateValues chấp nhận bộ dữ liệu canonical đầy đủ", () => {
    const schema = parseMetricSchema(rawSchema);
    expect(validateValues(schema, { gwp_n2o: "100" }, "baseline")).toEqual([]);
    expect(
      validateValues(
        schema,
        {
          area_quantification_unit_ha: "2",
          nitrogen_input_rate_wp_kg_n_ha: "100",
        },
        "observation",
      ),
    ).toEqual([]);
  });

  it("validateValues không âm thầm bỏ qua tham số bắt buộc", () => {
    const schema = parseMetricSchema(rawSchema);
    expect(validateValues(schema, {}, "baseline")).toEqual([
      { field: "gwp_n2o", message: "Required field" },
    ]);
    expect(validateValues(schema, {}, "observation").map((error) => error.field)).toEqual([
      "area_quantification_unit_ha",
      "nitrogen_input_rate_wp_kg_n_ha",
    ]);
  });

  it("AST chạy đúng Equation (25) và cộng theo quantification unit", () => {
    const result = evaluateMethodology(
      rawSchema,
      { gwp_n2o: "100" },
      [
        {
          record_key: "unit-a-2026",
          values: {
            area_quantification_unit_ha: "2",
            nitrogen_input_rate_wp_kg_n_ha: "100",
          },
        },
        {
          record_key: "unit-b-2026",
          values: {
            area_quantification_unit_ha: "1",
            nitrogen_input_rate_wp_kg_n_ha: "50",
          },
        },
      ],
      factors,
    );

    // (100×2 + 50×1) kgN × 0.00314 kgN2O/kgN × 0.001 t/kg × 100 tCO2e/tN2O
    expect(result.results.n2o_irrigation_change_deduction).toEqual({
      value: "0.078500",
      unit: "tCO2e",
      aggregation: "sum",
    });
    expect(result.trace.records).toHaveLength(2);
  });

  it("không seed một giá trị GWP_N2O mà VM0051 không cung cấp", () => {
    const schema = parseMetricSchema(rawSchema);
    expect(schema.factor_requirements.map((factor) => factor.key)).toEqual([
      "n2o_drying_correction",
      "kg_n2o_to_t_n2o",
    ]);
    expect(migration).toContain("GWP_N2O do VCS Standard hiện hành quy định");
    expect(migration).not.toMatch(/\('20000000-0000-4000-8000-000000000051',\s*'gwp_n2o'/);
  });
});
