import type {
  MrvFactors,
  MrvInput,
  MrvResult,
  OrganicInput,
  PreseasonWater,
  ScenarioResult,
  StrawMethod,
  WaterRegime,
} from "./types";

/**
 * Engine MRV theo IPCC 2019 Refinement, Vol.4 Ch.5.5.
 *
 *   CH4 = EFc × SFw × SFp × SFo × t × A
 *   SFo = (1 + Σ ROAᵢ × CFOAᵢ)^0.59
 *
 * Hàm thuần: cùng đầu vào luôn cho cùng kết quả, không đọc cơ sở dữ liệu.
 * Bộ hệ số truyền từ ngoài vào để kiểm định viên tra được con số đến từ đâu.
 */

/** Dữ liệu nhật ký không đủ để tính. Nêu đích danh trường thiếu, không đoán bừa. */
export class MrvInputError extends Error {
  constructor(readonly missing: string[]) {
    super(`Không đủ dữ liệu để tính phát thải. Còn thiếu: ${missing.join(", ")}`);
    this.name = "MrvInputError";
  }
}

/**
 * Chế độ nước suy ra từ số lần tháo nước trong nhật ký, không để người dùng tự khai —
 * đây là chỗ dễ khai khống nhất vì nó quyết định trực tiếp lượng tín chỉ.
 */
export function deriveWaterRegime(drainageCount: number): WaterRegime {
  if (drainageCount <= 0) return "continuously_flooded";
  if (drainageCount === 1) return "single_aeration";
  return "multiple_aeration";
}

function factor(factors: MrvFactors, key: string): number {
  const value = (factors as unknown as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `Thiếu hệ số phát thải "${key}" trong bộ hệ số ${factors.version}`,
    );
  }
  return value;
}

/** SFo = (1 + Σ ROAᵢ × CFOAᵢ)^0.59 */
function scalingOrganic(inputs: OrganicInput[], factors: MrvFactors): number {
  const weighted = inputs.reduce(
    (sum, item) => sum + item.tonnesPerHa * factor(factors, `cfoa_${item.type}`),
    0,
  );
  return Math.pow(1 + weighted, factor(factors, "sfo_exponent"));
}

function methaneKg(
  areaHa: number,
  days: number,
  sfw: number,
  sfp: number,
  sfo: number,
  factors: MrvFactors,
): number {
  return factor(factors, "ef_c_baseline") * sfw * sfp * sfo * days * areaHa;
}

/** N2O trực tiếp từ phân đạm: N × EF1 × 44/28. */
function nitrousOxideKg(nitrogenKg: number, factors: MrvFactors): number {
  return (
    nitrogenKg * factor(factors, "ef1_flooded_rice_n2o") * factor(factors, "n2o_n_to_n2o")
  );
}

/** Phát thải do đốt rơm rạ ngoài đồng; bằng 0 nếu không đốt. */
function burningCo2eT(
  method: StrawMethod,
  tonnesPerHa: number,
  areaHa: number,
  factors: MrvFactors,
): number {
  if (method !== "burned") return 0;
  const dryMatterKg =
    tonnesPerHa *
    1000 *
    factor(factors, "burn_dry_matter_fraction") *
    factor(factors, "burn_combustion_factor");
  const ch4Kg = (dryMatterKg * factor(factors, "burn_ef_ch4")) / 1000;
  const n2oKg = (dryMatterKg * factor(factors, "burn_ef_n2o")) / 1000;
  const perHaT =
    (ch4Kg * factor(factors, "gwp_ch4") + n2oKg * factor(factors, "gwp_n2o")) / 1000;
  return perHaT * areaHa;
}

function toCo2eT(scenario: Omit<ScenarioResult, "co2eT">, factors: MrvFactors): number {
  return (
    (scenario.ch4Kg * factor(factors, "gwp_ch4") +
      scenario.n2oKg * factor(factors, "gwp_n2o")) /
      1000 +
    scenario.burningCo2eT
  );
}

function validate(input: MrvInput): void {
  const missing: string[] = [];
  if (!(input.areaHa > 0)) missing.push("areaHa");
  if (!(input.cultivationDays > 0)) missing.push("cultivationDays");

  const burns = input.strawMethod === "burned" || input.baselineStrawMethod === "burned";
  if (burns && !(input.strawTonnesPerHa && input.strawTonnesPerHa > 0)) {
    missing.push("strawTonnesPerHa");
  }
  if (missing.length > 0) throw new MrvInputError(missing);
}

export function calculateMrv(input: MrvInput, factors: MrvFactors): MrvResult {
  validate(input);

  const { areaHa, cultivationDays: days } = input;
  const projectWaterRegime = deriveWaterRegime(input.drainageCount);

  const sfp = factor(factors, `sfp_${input.preseasonWater satisfies PreseasonWater}`);
  const sfwBaseline = factor(factors, `sfw_${input.baselineWaterRegime}`);
  const sfwProject = factor(factors, `sfw_${projectWaterRegime}`);

  const baselineOrganic = input.baselineOrganicInputs ?? input.organicInputs;
  const sfoBaseline = scalingOrganic(baselineOrganic, factors);
  const sfoProject = scalingOrganic(input.organicInputs, factors);

  const strawTonnes = input.strawTonnesPerHa ?? 0;

  const baselineParts = {
    ch4Kg: methaneKg(areaHa, days, sfwBaseline, sfp, sfoBaseline, factors),
    n2oKg: nitrousOxideKg(input.baselineNitrogenKg ?? input.nitrogenKg, factors),
    burningCo2eT: burningCo2eT(input.baselineStrawMethod, strawTonnes, areaHa, factors),
  };
  const projectParts = {
    ch4Kg: methaneKg(areaHa, days, sfwProject, sfp, sfoProject, factors),
    n2oKg: nitrousOxideKg(input.nitrogenKg, factors),
    burningCo2eT: burningCo2eT(input.strawMethod, strawTonnes, areaHa, factors),
  };

  const baseline: ScenarioResult = {
    ...baselineParts,
    co2eT: toCo2eT(baselineParts, factors),
  };
  const project: ScenarioResult = {
    ...projectParts,
    co2eT: toCo2eT(projectParts, factors),
  };

  return {
    methodologyVersion: factors.version,
    areaHa,
    cultivationDays: days,
    baseline,
    project,
    reductionCo2eT: baseline.co2eT - project.co2eT,
    derived: { projectWaterRegime, sfwBaseline, sfwProject, sfp, sfoBaseline, sfoProject },
    factors,
  };
}
