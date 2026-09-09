import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { evaluateMethodology, type FactorInput } from "@/lib/methodology/expression";

const PASSWORD = "MatKhau12345";
const METHODOLOGY_ID = "20000000-0000-4000-8000-000000000051";
const RUN = Date.now().toString().slice(-9);

function localEnv(): Record<string, string> {
  const path = new URL("../../.env.local", import.meta.url);
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const vars = localEnv();
const hasE2eConfig = Boolean(vars.NEXT_PUBLIC_SUPABASE_URL && vars.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || vars.SUPABASE_SERVICE_ROLE_KEY?.trim();
const describeDb = describe.skipIf(!hasE2eConfig);

type Db = SupabaseClient;
type MethodologyRow = {
  id: string;
  standard_id: string;
  code: string;
  version: string;
  status: string;
  is_sample: boolean;
  professionally_validated: boolean;
  metric_schema: unknown;
};
type FactorRow = {
  key: string;
  value: number;
  unit: string;
  scope: Record<string, string | number | boolean>;
  source: string;
};

describeDb("VM0051 trên cơ sở dữ liệu thật (0019)", () => {
  let reader: Db;
  let methodology: MethodologyRow | null = null;
  let factors: FactorRow[] = [];

  beforeAll(async () => {
    const { signedIn } = await import("./helpers");
    reader = await signedIn("duan-owner@test.local", PASSWORD) as Db;

    const methodologyResult = await reader
      .from("methodologies")
      .select("id, standard_id, code, version, status, is_sample, professionally_validated, metric_schema")
      .eq("id", METHODOLOGY_ID)
      .maybeSingle();
    expect(methodologyResult.error).toBeNull();
    methodology = methodologyResult.data as MethodologyRow | null;

    const factorResult = await reader
      .from("methodology_factors")
      .select("key, value, unit, scope, source")
      .eq("methodology_id", METHODOLOGY_ID)
      .order("key");
    expect(factorResult.error).toBeNull();
    factors = (factorResult.data ?? []) as FactorRow[];
  });

  it("có methodology VM0051 v1.1 published nhưng chưa thẩm định chuyên môn", () => {
    expect(methodology).toMatchObject({
      id: METHODOLOGY_ID,
      code: "VM0051",
      version: "1.1",
      status: "published",
      is_sample: false,
      professionally_validated: false,
    });
  });

  it("có đúng hai factor Equation (25) với giá trị số và đơn vị chính xác", () => {
    expect(factors.map(({ key, value, unit }) => ({ key, value, unit }))).toEqual([
      { key: "kg_n2o_to_t_n2o", value: 0.001, unit: "tN2O/kgN2O" },
      { key: "n2o_drying_correction", value: 0.00314, unit: "kgN2O/kgN" },
    ]);
  });

  it("metric_schema có đúng ba field theo scope và một phép tính tổng Equation (25)", () => {
    expect(methodology).not.toBeNull();
    if (!methodology) return;
    const schema = methodology.metric_schema as {
      fields: Array<{ id: string; scope: string }>;
      calculations: Array<{ id: string; aggregation: string }>;
    };
    expect(schema.fields.map(({ id, scope }) => ({ id, scope }))).toEqual([
      { id: "gwp_n2o", scope: "baseline" },
      { id: "area_quantification_unit_ha", scope: "observation" },
      { id: "nitrogen_input_rate_wp_kg_n_ha", scope: "observation" },
    ]);
    expect(schema.calculations).toHaveLength(1);
    expect(schema.calculations[0]).toMatchObject({
      id: "n2o_irrigation_change_deduction",
      aggregation: "sum",
    });
  });

  it.skipIf(!serviceKey)(
    "DB chặn báo cáo final của VM0051 vì professionally_validated vẫn là false",
    async () => {
      expect(methodology).not.toBeNull();
      if (!methodology) return;
      const { signedIn } = await import("./helpers");
      const owner = await signedIn("duan-owner@test.local", PASSWORD) as Db;
      const admin = await signedIn("duan-admin@test.local", PASSWORD) as Db;
      const ownerId = (await owner.auth.getUser()).data.user!.id;

      const created = await owner.rpc("create_project", {
        p_name: `E2E-TEST-${RUN} VM0051 final guard`,
        p_description: "Cô lập điều kiện chưa thẩm định chuyên môn.",
      });
      expect(created.error).toBeNull();
      const projectId = created.data as string;

      const configured = await owner
        .from("projects")
        .update({
          standard_id: methodology.standard_id,
          methodology_id: METHODOLOGY_ID,
          standard_locked_at: new Date().toISOString(),
          methodology_locked_at: new Date().toISOString(),
          baseline: { gwp_n2o: "273" },
        })
        .eq("id", projectId);
      expect(configured.error).toBeNull();

      const periodResult = await owner.rpc("create_monitoring_period", {
        p_project_id: projectId,
        p_name: `E2E-TEST kỳ VM0051 ${RUN}`,
        p_start_date: "2026-01-01",
        p_end_date: "2026-12-31",
        p_version: 1,
      });
      expect(periodResult.error).toBeNull();
      const periodId = periodResult.data as string;

      const saved = await owner.rpc("save_monitoring_records", {
        p_period_id: periodId,
        p_expected_revision: 0,
        p_records: [{
          record_key: "RUONG-001",
          observed_on: "2026-06-01",
          values: {
            area_quantification_unit_ha: "2",
            nitrogen_input_rate_wp_kg_n_ha: "100",
          },
          raw_input: {},
          source_row: null,
        }],
      });
      expect(saved.error).toBeNull();

      const locked = await owner.rpc("lock_monitoring_period", {
        p_period_id: periodId,
        p_expected_revision: 1,
      });
      expect(locked.error).toBeNull();

      // Template ready và output_file_id đều có thật để lời từ chối chỉ còn do cờ
      // professionally_validated=false (VM0051 cũng đã có is_sample=false).
      const template = await admin
        .from("report_templates")
        .insert({
          standard_id: methodology.standard_id,
          methodology_id: METHODOLOGY_ID,
          version: `e2e-${RUN}`,
          format: "pdf",
          status: "ready",
          object_path: `${METHODOLOGY_ID}/e2e-${RUN}.pdf`,
          checksum: "0".repeat(64),
          mapping: {},
          disclaimer: "E2E-TEST template chỉ dùng kiểm ràng buộc final.",
        })
        .select("id")
        .single();
      expect(template.error).toBeNull();
      const templateId = (template.data as { id: string }).id;

      const output = await owner
        .from("project_files")
        .insert({
          project_id: projectId,
          object_path: `${projectId}/${ownerId}/vm0051-${RUN}.pdf`,
          original_name: `E2E-TEST-VM0051-${RUN}.pdf`,
          mime_type: "application/pdf",
          size_bytes: 1,
          checksum: "1".repeat(64),
        })
        .select("id")
        .single();
      expect(output.error).toBeNull();
      const outputFileId = (output.data as { id: string }).id;

      const service = createClient(
        vars.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      ) as Db;
      const finalReport = await service.rpc("create_mrv_report", {
        p_period_id: periodId,
        p_template_id: templateId,
        p_results: { n2o_irrigation_change_deduction: "0.171444" },
        p_trace: { test: "VM0051 final guard" },
        p_engine_version: "e2e-vm0051",
        p_requested_by: ownerId,
        p_status: "final",
        p_output_file_id: outputFileId,
      });
      expect(finalReport.error).not.toBeNull();
      expect(finalReport.error!.message).toContain("Final cần methodology đã thẩm định");
    },
  );

  it("engine chạy metric_schema thật và tính chính xác Equation (25)", () => {
    expect(methodology).not.toBeNull();
    expect(factors).toHaveLength(2);
    if (!methodology || factors.length !== 2) return;

    const result = evaluateMethodology(
      methodology.metric_schema,
      { gwp_n2o: "273" },
      [{
        record_key: "RUONG-001",
        values: {
          area_quantification_unit_ha: "2",
          nitrogen_input_rate_wp_kg_n_ha: "100",
        },
      }],
      factors.map((factor): FactorInput => ({
        key: factor.key,
        value: String(factor.value),
        unit: factor.unit,
        scope: factor.scope,
        source: factor.source,
      })),
    );

    // Tính tay: 100 × 2 × 0.00314 × 0.001 × 273 = 0.171444 tCO2e.
    expect(result.results.n2o_irrigation_change_deduction).toEqual({
      value: "0.171444",
      unit: "tCO2e",
      aggregation: "sum",
    });
  });
});
