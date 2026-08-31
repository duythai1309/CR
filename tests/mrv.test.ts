import { describe, expect, it } from "vitest";
import { calculateMrv, MrvInputError, deriveWaterRegime } from "@/lib/mrv/engine";
import { TEST_FACTORS } from "./fixtures/factors";

/**
 * Các con số kỳ vọng dưới đây được tính tay từ công thức IPCC 2019 Refinement
 * Vol.4 Ch.5.5, không lấy từ đầu ra của chính engine.
 */

const base = {
  areaHa: 1,
  cultivationDays: 100,
  preseasonWater: "non_flooded_short" as const,
  baselineWaterRegime: "continuously_flooded" as const,
  drainageCount: 0,
  nitrogenKg: 0,
  organicInputs: [],
  strawMethod: "removed" as const,
  baselineStrawMethod: "removed" as const,
};

describe("suy ra chế độ nước từ số lần tháo nước", () => {
  it("không tháo nước lần nào là ngập liên tục", () => {
    expect(deriveWaterRegime(0)).toBe("continuously_flooded");
  });

  it("tháo một lần là rút nước đơn", () => {
    expect(deriveWaterRegime(1)).toBe("single_aeration");
  });

  it("tháo từ hai lần trở lên là AWD", () => {
    expect(deriveWaterRegime(2)).toBe("multiple_aeration");
    expect(deriveWaterRegime(5)).toBe("multiple_aeration");
  });
});

describe("phát thải CH4 nền", () => {
  it("ruộng ngập liên tục 1 ha, 100 ngày: 1.19 × 1 × 1 × 1 × 100 × 1 = 119 kg CH4", () => {
    const r = calculateMrv(base, TEST_FACTORS);
    expect(r.baseline.ch4Kg).toBeCloseTo(119, 4);
    // 119 kg CH4 × GWP 28 ÷ 1000 = 3.332 tCO2e
    expect(r.baseline.co2eT).toBeCloseTo(3.332, 4);
  });

  it("ngập trước vụ trên 30 ngày nhân thêm SFp = 2.41", () => {
    const r = calculateMrv({ ...base, preseasonWater: "flooded_pre" }, TEST_FACTORS);
    expect(r.baseline.ch4Kg).toBeCloseTo(119 * 2.41, 4);
  });

  it("diện tích và số ngày canh tác nhân tuyến tính", () => {
    const r = calculateMrv({ ...base, areaHa: 2.5, cultivationDays: 120 }, TEST_FACTORS);
    expect(r.baseline.ch4Kg).toBeCloseTo(1.19 * 120 * 2.5, 4);
  });
});

describe("áp dụng AWD", () => {
  it("tháo nước nhiều lần đưa SFw về 0.55, cắt 45% lượng CH4", () => {
    const r = calculateMrv({ ...base, drainageCount: 3 }, TEST_FACTORS);
    expect(r.derived.projectWaterRegime).toBe("multiple_aeration");
    expect(r.project.ch4Kg).toBeCloseTo(119 * 0.55, 4); // 65.45
    // Giảm 53.55 kg CH4 × 28 ÷ 1000 = 1.4994 tCO2e
    expect(r.reductionCo2eT).toBeCloseTo(1.4994, 4);
  });

  it("tháo nước một lần cho SFw = 0.71", () => {
    const r = calculateMrv({ ...base, drainageCount: 1 }, TEST_FACTORS);
    expect(r.project.ch4Kg).toBeCloseTo(119 * 0.71, 4);
  });
});

describe("hệ số chất hữu cơ SFo", () => {
  it("vùi 5 tấn rơm/ha ngay trước vụ: SFo = (1 + 5×1.0)^0.59 = 2.8781223", () => {
    const r = calculateMrv(
      {
        ...base,
        organicInputs: [{ type: "straw_incorporated_short", tonnesPerHa: 5 }],
      },
      TEST_FACTORS,
    );
    expect(r.derived.sfoProject).toBeCloseTo(2.8781223, 6);
    expect(r.project.ch4Kg).toBeCloseTo(119 * 2.8781223, 4);
  });

  it("vùi rơm sớm hơn 30 ngày hạ CFOA xuống 0.29, giảm mạnh CH4", () => {
    const early = calculateMrv(
      { ...base, organicInputs: [{ type: "straw_incorporated_long", tonnesPerHa: 5 }] },
      TEST_FACTORS,
    );
    // (1 + 5×0.29)^0.59 = 2.45^0.59 = 1.6967114
    expect(early.derived.sfoProject).toBeCloseTo(1.6967114, 6);
  });

  it("không bón chất hữu cơ thì SFo bằng 1", () => {
    expect(calculateMrv(base, TEST_FACTORS).derived.sfoProject).toBeCloseTo(1, 6);
  });
});

describe("N2O từ phân đạm", () => {
  it("bón 100 kg N: 100 × 0.004 × 44/28 = 0.62857 kg N2O", () => {
    const r = calculateMrv({ ...base, nitrogenKg: 100 }, TEST_FACTORS);
    expect(r.project.n2oKg).toBeCloseTo(0.62857, 4);
    // 0.62857 × 265 ÷ 1000 = 0.16657 tCO2e
    expect(r.project.co2eT).toBeCloseTo(3.332 + 0.16657, 4);
  });

  it("giảm lượng đạm so với kịch bản nền tạo ra thêm phần giảm phát thải", () => {
    const r = calculateMrv(
      { ...base, nitrogenKg: 80, baselineNitrogenKg: 120 },
      TEST_FACTORS,
    );
    const perKgN = 0.004 * (44 / 28) * 265 / 1000;
    expect(r.reductionCo2eT).toBeCloseTo(40 * perKgN, 5);
  });
});

describe("không đốt rơm rạ", () => {
  it("5 tấn rơm/ha đốt ngoài đồng phát thải 0.32011 tCO2e/ha", () => {
    const r = calculateMrv(
      { ...base, baselineStrawMethod: "burned", strawTonnesPerHa: 5 },
      TEST_FACTORS,
    );
    // 5000 kg × 0.85 chất khô × 0.80 cháy hết = 3400 kg
    // CH4 3400×2.7/1000 = 9.18 kg; N2O 3400×0.07/1000 = 0.238 kg
    // (9.18×28 + 0.238×265)/1000 = 0.32011 t
    expect(r.baseline.burningCo2eT).toBeCloseTo(0.32011, 4);
    expect(r.project.burningCo2eT).toBe(0);
    expect(r.reductionCo2eT).toBeCloseTo(0.32011, 4);
  });

  it("vẫn đốt như cũ thì không phát sinh khoản giảm nào", () => {
    const r = calculateMrv(
      { ...base, strawMethod: "burned", baselineStrawMethod: "burned", strawTonnesPerHa: 5 },
      TEST_FACTORS,
    );
    expect(r.reductionCo2eT).toBeCloseTo(0, 6);
  });
});

describe("từ chối tính khi dữ liệu không đủ", () => {
  it("thiếu số ngày canh tác thì báo lỗi, không đoán bừa", () => {
    expect(() => calculateMrv({ ...base, cultivationDays: 0 }, TEST_FACTORS))
      .toThrow(MrvInputError);
  });

  it("thiếu diện tích thì báo lỗi", () => {
    expect(() => calculateMrv({ ...base, areaHa: 0 }, TEST_FACTORS))
      .toThrow(MrvInputError);
  });

  it("khai có đốt rơm nhưng không khai sản lượng rơm thì báo lỗi", () => {
    expect(() =>
      calculateMrv({ ...base, baselineStrawMethod: "burned" }, TEST_FACTORS),
    ).toThrow(MrvInputError);
  });

  it("lỗi nêu đích danh trường còn thiếu", () => {
    try {
      calculateMrv({ ...base, areaHa: 0, cultivationDays: 0 }, TEST_FACTORS);
      expect.unreachable("lẽ ra phải ném lỗi");
    } catch (e) {
      expect(e).toBeInstanceOf(MrvInputError);
      expect((e as MrvInputError).missing).toContain("areaHa");
      expect((e as MrvInputError).missing).toContain("cultivationDays");
    }
  });

  it("thiếu hệ số trong bộ hệ số thì báo lỗi thay vì tính sai", () => {
    const broken = { ...TEST_FACTORS };
    delete (broken as Record<string, unknown>).sfw_multiple_aeration;
    expect(() => calculateMrv({ ...base, drainageCount: 3 }, broken)).toThrow(/sfw_multiple_aeration/);
  });
});

describe("kết quả giữ lại đủ vết để kiểm định", () => {
  it("trả về phiên bản phương pháp luận và toàn bộ hệ số đã dùng", () => {
    const r = calculateMrv({ ...base, drainageCount: 2 }, TEST_FACTORS);
    expect(r.methodologyVersion).toBe(TEST_FACTORS.version);
    expect(r.factors.sfw_multiple_aeration).toBe(0.55);
    expect(r.factors.ef_c_baseline).toBe(1.19);
  });

  it("giảm phát thải bằng đúng hiệu của hai kịch bản", () => {
    const r = calculateMrv(
      { ...base, drainageCount: 3, nitrogenKg: 90, baselineNitrogenKg: 110 },
      TEST_FACTORS,
    );
    expect(r.reductionCo2eT).toBeCloseTo(r.baseline.co2eT - r.project.co2eT, 8);
  });
});
