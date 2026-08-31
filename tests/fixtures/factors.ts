import type { MrvFactors } from "@/lib/mrv/types";

/**
 * Bản sao bộ hệ số IPCC2019-VN-1.0 dùng làm dữ liệu thử. Giá trị phải khớp với
 * bảng emission_factors trong migration 0004; engine không tự có hệ số mặc định
 * nên nếu hai bên lệch nhau, test sẽ nêu ra con số khác đi.
 */
export const TEST_FACTORS: MrvFactors = {
  version: "IPCC2019-VN-1.0",
  ef_c_baseline: 1.19,
  sfw_continuously_flooded: 1.0,
  sfw_single_aeration: 0.71,
  sfw_multiple_aeration: 0.55,
  sfp_non_flooded_short: 1.0,
  sfp_non_flooded_long: 0.68,
  sfp_flooded_pre: 2.41,
  cfoa_straw_incorporated_short: 1.0,
  cfoa_straw_incorporated_long: 0.29,
  cfoa_compost: 0.05,
  cfoa_farmyard_manure: 0.14,
  cfoa_green_manure: 0.5,
  sfo_exponent: 0.59,
  ef1_flooded_rice_n2o: 0.004,
  n2o_n_to_n2o: 44 / 28,
  gwp_ch4: 28,
  gwp_n2o: 265,
  burn_ef_ch4: 2.7,
  burn_ef_n2o: 0.07,
  burn_combustion_factor: 0.8,
  burn_dry_matter_fraction: 0.85,
};
