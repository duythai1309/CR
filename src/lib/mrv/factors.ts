import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MrvFactors } from "./types";

export type VnRegion = Database["public"]["Enums"]["vn_region"];
export type SeasonType = Database["public"]["Enums"]["season_type"];

export const CURRENT_METHODOLOGY = "IPCC2019-VN-TIER2-1.0";

/** Bộ hệ số cũ dùng mặc định toàn cầu của IPCC; giữ lại để tra cứu bản tính cũ. */
export const LEGACY_METHODOLOGY = "IPCC2019-VN-1.0";

/** Mọi hệ số engine cần. Thiếu một cái là dừng, không tính bằng giá trị đoán. */
const REQUIRED_KEYS = [
  "ef_c_baseline",
  "sfw_continuously_flooded",
  "sfw_single_aeration",
  "sfw_multiple_aeration",
  "sfp_non_flooded_short",
  "sfp_non_flooded_long",
  "sfp_flooded_pre",
  "cfoa_straw_incorporated_short",
  "cfoa_straw_incorporated_long",
  "cfoa_compost",
  "cfoa_farmyard_manure",
  "cfoa_green_manure",
  "sfo_exponent",
  "ef1_flooded_rice_n2o",
  "n2o_n_to_n2o",
  "gwp_ch4",
  "gwp_n2o",
  "burn_ef_ch4",
  "burn_ef_n2o",
  "burn_combustion_factor",
  "burn_dry_matter_fraction",
] as const;

export interface FactorScope {
  region: VnRegion;
  seasonType: SeasonType;
}

const REGION_NAME: Record<VnRegion, string> = {
  north: "miền Bắc",
  central: "miền Trung",
  south: "miền Nam",
};

const SEASON_NAME: Record<SeasonType, string> = {
  early: "vụ đầu năm",
  mid: "vụ giữa năm",
  late: "vụ cuối năm",
};

/**
 * Nạp bộ hệ số. Khi biết vùng và loại vụ, hệ số phát thải nền EFc được thay bằng
 * giá trị đo tại chính vùng đó — chênh lệch giữa các vùng và các vụ ở Việt Nam lớn
 * tới mức dùng mặc định toàn cầu sẽ sai lệch kết quả một cách có hệ thống.
 */
export async function loadFactors(
  supabase: SupabaseClient<Database>,
  version: string = CURRENT_METHODOLOGY,
  scope?: FactorScope,
): Promise<MrvFactors> {
  const { data, error } = await supabase
    .from("emission_factors")
    .select("key, value")
    .eq("version", version);

  if (error) throw new Error(`Không đọc được bộ hệ số: ${error.message}`);

  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.key] = Number(row.value);

  let sourceKey = "ef_c_baseline";
  if (scope) {
    const key = `ef_c_${scope.region}_${scope.seasonType}`;
    if (typeof map[key] !== "number" || Number.isNaN(map[key])) {
      throw new Error(
        `Bộ hệ số ${version} không có giá trị phát thải nền cho ` +
          `${REGION_NAME[scope.region]} ${SEASON_NAME[scope.seasonType]}. ` +
          `Hãy kiểm tra lại loại vụ đã chọn.`,
      );
    }
    map.ef_c_baseline = map[key];
    sourceKey = key;
  }

  const missing = REQUIRED_KEYS.filter(
    (k) => typeof map[k] !== "number" || Number.isNaN(map[k]),
  );
  if (missing.length > 0) {
    throw new Error(
      `Bộ hệ số ${version} thiếu: ${missing.join(", ")}. Hãy chạy lại migration hệ số.`,
    );
  }

  return { version, ef_c_source_key: sourceKey, ...map } as MrvFactors;
}
