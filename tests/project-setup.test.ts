import { describe, expect, it } from "vitest";
import type { ChatProvider } from "@/lib/chat/provider";
import {
  FEASIBILITY_ASSIST_SYSTEM,
  SELECTION_ASSIST_SYSTEM,
  assertNoAiVerdictText,
  assertNoForbiddenFeasibilityKeys,
  assertValidSelectionAdvice,
  buildSelectionAdvice,
  catalogFromMethodologyHandler,
  deriveIdeaGaps,
  deriveKnownFacts,
  parseFeasibilityAssist,
  runSetupJsonTurn,
  type SetupCatalogEntry,
} from "@/lib/chat/setup-assist";
import { FORBIDDEN_FEASIBILITY_KEYS, type MethodologyCandidate } from "@/types/project-setup";
import { buildSystemPrompt, describePage } from "@/lib/chat/prompt";

const schema = (baselineId: string) => ({
  schema_version: 1,
  fields: [
    {
      id: baselineId,
      label: { vi: `Baseline ${baselineId}` },
      type: "decimal",
      unit: "tCO2e",
      scope: "baseline",
      required: true,
    },
    {
      id: "activity_data",
      label: { vi: "Dữ liệu hoạt động" },
      type: "decimal",
      unit: "1",
      scope: "observation",
      required: true,
    },
  ],
  factor_requirements: [],
  calculations: [
    {
      id: "estimate",
      unit: "tCO2e",
      aggregation: "sum",
      expression: { field: "activity_data" },
    },
  ],
});

const SAMPLES: SetupCatalogEntry[] = [
  ["m-forest-vcs", "VCS", "DEMO-VCS-FOREST", "afolu", "baseline_stock"],
  ["m-energy-vcs", "VCS", "DEMO-VCS-ENERGY", "energy", "grid_emission"],
  ["m-forest-gs", "GS", "DEMO-GS-FOREST", "afolu", "baseline_biomass"],
  ["m-biogas-gs", "GS", "DEMO-GS-BIOGAS", "biogas", "baseline_fuel"],
].map(([id, standard, code, projectType, baseline]) => ({
  methodology_id: id,
  standard_code: standard,
  code,
  version: "demo-1.0",
  name: `MẪU ${code}`,
  project_type: projectType,
  is_sample: true,
  metric_schema: schema(baseline),
}));

describe("ranh giới feasibility assist", () => {
  it("từ chối mọi forbidden key, kể cả khi lồng sâu", () => {
    for (const key of FORBIDDEN_FEASIBILITY_KEYS) {
      expect(
        () => assertNoForbiddenFeasibilityKeys({ known: [], nested: { [key]: true } }),
        key,
      ).toThrow(/không chấp nhận trường/i);
    }
  });

  it("từ chối câu kết luận dù output không dùng forbidden key", () => {
    expect(() => assertNoAiVerdictText({ known: ["Dự án này khả thi."] })).toThrow(/phán quyết/i);
    expect(() => assertNoAiVerdictText({ gaps: [{ missing: "Phương án không đủ điều kiện." }] })).toThrow(/phán quyết/i);
  });

  it("prompt cấm phán quyết và cấm dùng trí nhớ về Standard", () => {
    expect(FEASIBILITY_ASSIST_SYSTEM).toContain("TUYỆT ĐỐI KHÔNG kết luận");
    expect(FEASIBILITY_ASSIST_SYSTEM).toContain("không dùng trí nhớ");
    expect(SELECTION_ASSIST_SYSTEM).toMatch(/Không dùng kiến thức\s+ngoài catalog/);
    const general = buildSystemPrompt({ role: "coop_staff", fullName: "A" });
    expect(general).toContain("TUYỆT ĐỐI KHÔNG kết luận dự án khả thi/không khả thi");
    expect(describePage("/du-an/p-1/thiet-lap")).toContain("không phán quyết khả thi");
  });

  it("parser chỉ nhận known/gaps và luôn ghép gap bắt buộc", () => {
    const result = parseFeasibilityAssist(
      JSON.stringify({
        known: ["Người dùng mô tả hoạt động thu hồi khí."],
        gaps: [{ topic: "Metering", missing: "Chưa có kế hoạch đo.", evidence_needed: "Sơ đồ đồng hồ." }],
      }),
      [{ topic: "Location", missing: "Chưa có địa điểm." }],
    );
    expect(result.known).toEqual(["Người dùng mô tả hoạt động thu hồi khí."]);
    expect(result.gaps).toHaveLength(2);
  });

  it("known canonical chỉ lấy nguyên dữ liệu người dùng, không lấy fact model tự thêm", () => {
    const known = deriveKnownFacts(
      { activity: "Thu hồi khí", project_type: "biogas", start_year: 2027 },
      "Mô tả của chuyên gia.",
    );
    const result = parseFeasibilityAssist(
      JSON.stringify({ known: ["Model tự thêm một fact"], gaps: [] }),
      [],
      known,
    );
    expect(result.known).toEqual(known);
    expect(result.known).not.toContain("Model tự thêm một fact");
  });
});

describe("ý tưởng sang khoảng trống", () => {
  it("đọc baseline schema của cả bốn Methodology SAMPLE", () => {
    for (const sample of SAMPLES) {
      const gaps = deriveIdeaGaps(
        {
          problem: "Giảm phát thải từ hoạt động hiện hữu",
          activity: "Triển khai thiết bị và giám sát",
          project_type: sample.project_type as "afolu" | "energy" | "biogas",
          location: "Việt Nam",
          scale: "100 đơn vị",
          start_year: 2027,
          crediting_years: 10,
          proponent: "Công ty A",
        },
        "Mô tả đã có.",
        [sample],
      );
      expect(gaps, sample.code).toHaveLength(1);
      expect(gaps[0].topic).toContain(sample.code);
      expect(gaps[0].missing).toContain(
        String((sample.metric_schema as { fields: Array<{ id: string }> }).fields[0].id),
      );
    }
  });

  it("nêu đủ gap đầu vào khi ý tưởng còn trống", () => {
    const topics = deriveIdeaGaps({}, "", SAMPLES).map((item) => item.topic);
    expect(topics).toEqual(
      expect.arrayContaining([
        "Project rationale",
        "Project activity",
        "Project type",
        "Project boundary",
        "Scale",
        "Timeline",
        "Crediting period",
        "Project proponent",
        "Project description",
      ]),
    );
  });
});

describe("selection advice được ground vào catalog", () => {
  const candidate: MethodologyCandidate = {
    methodology_id: "m-1",
    standard_code: "VCS",
    code: "DEMO",
    version: "demo-1",
    project_type: "afolu",
    why: "Khớp project_type trong catalog.",
    is_sample: true,
  };

  it("disclaimer rỗng khi có ứng viên mẫu thì phải lỗi", () => {
    expect(() => assertValidSelectionAdvice({ candidates: [candidate], disclaimer: "  " })).toThrow(
      /disclaimer/i,
    );
  });

  it("hydrate identity từ allowlist, không tin identity do model", () => {
    const advice = buildSelectionAdvice(
      JSON.stringify({ candidates: [{ methodology_id: SAMPLES[0].methodology_id, why: "Catalog ghi project_type afolu, khớp dữ liệu đầu vào." }] }),
      SAMPLES,
      "2026-09-07T00:00:00.000Z",
    );
    expect(advice.candidates?.[0]).toMatchObject({
      code: "DEMO-VCS-FOREST",
      standard_code: "VCS",
      is_sample: true,
    });
    expect(advice.disclaimer).toMatch(/MẪU/);
  });

  it("từ chối methodology id không có trong kết quả handler", () => {
    expect(() =>
      buildSelectionAdvice(
        JSON.stringify({ candidates: [{ methodology_id: "hallucinated", why: "Tự nhớ." }] }),
        SAMPLES,
      ),
    ).toThrow(/không có trong catalog/i);
  });

  it("từ chối why không viện dẫn evidence trong catalog", () => {
    expect(() =>
      buildSelectionAdvice(
        JSON.stringify({ candidates: [{ methodology_id: SAMPLES[0].methodology_id, why: "Có vẻ phù hợp." }] }),
        SAMPLES,
      ),
    ).toThrow(/chưa viện dẫn dữ liệu catalog/i);
  });

  it("không cho selection advice lén chấm điểm hoặc kết luận khả thi", () => {
    expect(() =>
      buildSelectionAdvice(
        JSON.stringify({ candidates: [{ methodology_id: SAMPLES[0].methodology_id, why: "Dự án này khả thi theo afolu.", score: 9 }] }),
        SAMPLES,
      ),
    ).toThrow(/không chấp nhận trường|phán quyết/i);
  });

  it("chuyển output handler thành allowlist kèm field", () => {
    const catalog = catalogFromMethodologyHandler({
      khop: [{
        methodology_id: "m-1",
        standard: "VCS",
        ma: "DEMO",
        version: "1",
        ten: "Mẫu",
        loai_hinh: "afolu",
        la_du_lieu_mau: true,
        fields: [{ id: "area", ten: "Diện tích", scope: "baseline", don_vi: "ha", bat_buoc: true }],
      }],
    });
    expect(catalog[0]).toMatchObject({ methodology_id: "m-1", fields: [{ id: "area" }] });
  });
});

describe("dùng lại runTurn", () => {
  it("thu JSON từ provider qua chat runtime hiện hữu", async () => {
    const provider: ChatProvider = {
      async *stream() {
        yield { type: "text", text: '{"known":[],"gaps":[]}' };
      },
    };
    await expect(runSetupJsonTurn(provider, FEASIBILITY_ASSIST_SYSTEM, { idea: {} })).resolves.toBe(
      '{"known":[],"gaps":[]}',
    );
  });
});
