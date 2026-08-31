export type WaterRegime = "continuously_flooded" | "single_aeration" | "multiple_aeration";

export type PreseasonWater = "non_flooded_short" | "non_flooded_long" | "flooded_pre";

export type OrganicAmendment =
  | "straw_incorporated_short"
  | "straw_incorporated_long"
  | "compost"
  | "farmyard_manure"
  | "green_manure";

export type StrawMethod =
  | "incorporated_short"
  | "incorporated_long"
  | "removed"
  | "burned"
  | "mulched";

/** Chất hữu cơ bón vào ruộng, tính theo tấn chất khô trên mỗi hecta (ROA). */
export interface OrganicInput {
  type: OrganicAmendment;
  tonnesPerHa: number;
}

export interface MrvInput {
  areaHa: number;
  cultivationDays: number;
  preseasonWater: PreseasonWater;
  /** Chế độ nước của kịch bản nền — thường là ngập liên tục theo tập quán cũ. */
  baselineWaterRegime: WaterRegime;
  /** Số lần tháo nước ghi trong nhật ký; engine tự suy ra chế độ nước từ đây. */
  drainageCount: number;
  nitrogenKg: number;
  baselineNitrogenKg?: number;
  organicInputs: OrganicInput[];
  baselineOrganicInputs?: OrganicInput[];
  strawMethod: StrawMethod;
  baselineStrawMethod: StrawMethod;
  strawTonnesPerHa?: number;
}

export interface MrvFactors {
  version: string;
  /** Khoá của hệ số phát thải nền đã dùng, ví dụ `ef_c_north_early`. Lưu lại để
   *  người kiểm định biết con số đến từ vùng và vụ nào. */
  ef_c_source_key?: string;
  ef_c_baseline: number;
  sfw_continuously_flooded: number;
  sfw_single_aeration: number;
  sfw_multiple_aeration: number;
  sfp_non_flooded_short: number;
  sfp_non_flooded_long: number;
  sfp_flooded_pre: number;
  cfoa_straw_incorporated_short: number;
  cfoa_straw_incorporated_long: number;
  cfoa_compost: number;
  cfoa_farmyard_manure: number;
  cfoa_green_manure: number;
  sfo_exponent: number;
  ef1_flooded_rice_n2o: number;
  n2o_n_to_n2o: number;
  gwp_ch4: number;
  gwp_n2o: number;
  burn_ef_ch4: number;
  burn_ef_n2o: number;
  burn_combustion_factor: number;
  burn_dry_matter_fraction: number;
}

export interface ScenarioResult {
  ch4Kg: number;
  n2oKg: number;
  burningCo2eT: number;
  co2eT: number;
}

export interface MrvResult {
  methodologyVersion: string;
  areaHa: number;
  cultivationDays: number;
  baseline: ScenarioResult;
  project: ScenarioResult;
  reductionCo2eT: number;
  derived: {
    projectWaterRegime: WaterRegime;
    sfwBaseline: number;
    sfwProject: number;
    sfp: number;
    sfoBaseline: number;
    sfoProject: number;
  };
  factors: MrvFactors;
}
