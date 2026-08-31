import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { MrvInput, OrganicInput, StrawMethod } from "./types";
import { calculateMrv } from "./engine";
import {
  CURRENT_METHODOLOGY,
  loadFactors,
  type SeasonType,
  type VnRegion,
} from "./factors";

type Client = SupabaseClient<Database>;

/**
 * Các đối tượng dưới đây chỉ chứa số, chuỗi, mảng và object thuần nên tuần tự hoá
 * sang JSON được; TypeScript không tự suy ra điều đó từ interface có khoá cố định.
 */
const asJson = (value: unknown): Json => value as Json;

export interface CollectResult {
  input: MrvInput | null;
  /** Việc còn phải làm trước khi tính được, viết bằng ngôn ngữ người nhập liệu hiểu. */
  missing: string[];
  summary: {
    fieldName: string;
    farmerName: string;
    areaHa: number | null;
    cultivationDays: number | null;
    drainageCount: number;
    nitrogenKg: number;
    strawMethod: StrawMethod | null;
    baselineStrawMethod: StrawMethod | null;
    region: VnRegion | null;
    seasonType: SeasonType | null;
  };
}

function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const diff = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  return diff > 0 ? Math.round(diff) : null;
}

/**
 * Gom nhật ký của một thửa-vụ thành đầu vào cho engine. Trả về danh sách việc còn
 * thiếu thay vì ném lỗi, để màn hình nhập liệu hiện được checklist cho cán bộ HTX.
 */
export async function collectMrvInput(
  supabase: Client,
  fieldSeasonId: string,
): Promise<CollectResult> {
  const { data: fs, error } = await supabase
    .from("field_seasons")
    .select(
      `id, transplant_date, harvest_date, preseason_water, baseline_water_regime,
       cooperatives ( region ),
       seasons ( season_type ),
       fields ( name, area_ha, declared_area_ha, farmers ( full_name ) ),
       water_events ( event_type ),
       fertilizer_applications ( amount_kg, n_content_pct, is_organic, organic_type ),
       straw_management ( method, baseline_method, amount_t_per_ha )`,
    )
    .eq("id", fieldSeasonId)
    .single();

  if (error || !fs) throw new Error(error?.message ?? "Không tìm thấy thửa-vụ");

  const field = fs.fields;
  const areaHa = field?.area_ha ?? field?.declared_area_ha ?? null;
  const cultivationDays = daysBetween(fs.transplant_date, fs.harvest_date);
  const drainageCount = (fs.water_events ?? []).filter((e) => e.event_type === "drainage").length;
  // Quan hệ một-một (ràng buộc unique trên field_season_id) nên trả về một bản ghi.
  const straw = fs.straw_management ?? null;
  const region = fs.cooperatives?.region ?? null;
  const seasonType = fs.seasons?.season_type ?? null;

  const nitrogenKg = (fs.fertilizer_applications ?? []).reduce(
    (sum, a) => sum + (Number(a.amount_kg) * Number(a.n_content_pct)) / 100,
    0,
  );

  // Rơm rạ chỉ lấy từ bảng straw_management. Nếu cũng nhận từ bảng phân bón thì
  // cùng một lượng rơm sẽ bị đếm hai lần vào hệ số SFo.
  const organicFromFertilizer: OrganicInput[] = (fs.fertilizer_applications ?? [])
    .filter((a) => a.is_organic && a.organic_type && !a.organic_type.startsWith("straw_"))
    .map((a) => ({
      type: a.organic_type as OrganicInput["type"],
      tonnesPerHa: areaHa ? Number(a.amount_kg) / 1000 / areaHa : 0,
    }));

  const strawAsOrganic = (method: StrawMethod | null): OrganicInput[] => {
    if (!straw || !method) return [];
    const tonnesPerHa = Number(straw.amount_t_per_ha ?? 0);
    if (tonnesPerHa <= 0) return [];
    if (method === "incorporated_short")
      return [{ type: "straw_incorporated_short", tonnesPerHa }];
    if (method === "incorporated_long")
      return [{ type: "straw_incorporated_long", tonnesPerHa }];
    return [];
  };

  const missing: string[] = [];
  if (!areaHa || areaHa <= 0) missing.push("Diện tích thửa (vẽ ranh thửa trên bản đồ)");
  if (!fs.transplant_date) missing.push("Ngày cấy");
  if (!fs.harvest_date) missing.push("Ngày thu hoạch");
  if (fs.transplant_date && fs.harvest_date && !cultivationDays)
    missing.push("Ngày thu hoạch phải sau ngày cấy");
  if (!straw) missing.push("Cách xử lý rơm rạ");
  // Không có vùng và loại vụ thì không biết lấy hệ số phát thải nền nào, mà đây là
  // đại lượng nhân trực tiếp vào toàn bộ kết quả nên tuyệt đối không được đoán.
  if (!region) missing.push("Vùng miền của hợp tác xã (mục Thiết lập)");
  if (!seasonType) missing.push("Loại vụ của mùa vụ này (đầu năm / giữa năm / cuối năm)");
  if (straw && (straw.method === "burned" || straw.baseline_method === "burned") &&
      !(Number(straw.amount_t_per_ha) > 0))
    missing.push("Sản lượng rơm rạ (tấn/ha) — bắt buộc khi có đốt rơm");

  const summary: CollectResult["summary"] = {
    fieldName: field?.name ?? "—",
    farmerName: field?.farmers?.full_name ?? "—",
    areaHa,
    cultivationDays,
    drainageCount,
    nitrogenKg,
    strawMethod: (straw?.method as StrawMethod) ?? null,
    baselineStrawMethod: (straw?.baseline_method as StrawMethod) ?? null,
    region,
    seasonType,
  };

  if (missing.length > 0 || !areaHa || !cultivationDays || !straw || !region || !seasonType) {
    return { input: null, missing, summary };
  }

  return {
    input: {
      areaHa,
      cultivationDays,
      preseasonWater: fs.preseason_water,
      baselineWaterRegime: fs.baseline_water_regime,
      drainageCount,
      nitrogenKg,
      organicInputs: [...organicFromFertilizer, ...strawAsOrganic(straw.method)],
      baselineOrganicInputs: [
        ...organicFromFertilizer,
        ...strawAsOrganic(straw.baseline_method),
      ],
      strawMethod: straw.method,
      baselineStrawMethod: straw.baseline_method,
      strawTonnesPerHa: Number(straw.amount_t_per_ha ?? 0),
    },
    missing: [],
    summary,
  };
}

/**
 * Tính lại và lưu kết quả. Bản tính cũ được giữ nguyên nhưng đánh dấu hết hiệu lực,
 * nên vẫn tra ngược được con số đã dùng khi phát hành lô tín chỉ trước đó.
 */
export async function computeAndSave(
  supabase: Client,
  fieldSeasonId: string,
  cooperativeId: string,
  userId: string,
): Promise<{ ok: true; reductionCo2eT: number } | { ok: false; missing: string[] }> {
  const collected = await collectMrvInput(supabase, fieldSeasonId);
  if (!collected.input) return { ok: false, missing: collected.missing };

  const { region, seasonType } = collected.summary;
  const factors = await loadFactors(supabase, CURRENT_METHODOLOGY, {
    region: region!,
    seasonType: seasonType!,
  });
  const result = calculateMrv(collected.input, factors);

  await supabase
    .from("emission_calculations")
    .update({ is_current: false })
    .eq("field_season_id", fieldSeasonId)
    .eq("is_current", true);

  const round = (n: number) => Number(n.toFixed(4));

  const { error } = await supabase.from("emission_calculations").insert({
    cooperative_id: cooperativeId,
    field_season_id: fieldSeasonId,
    methodology_version: result.methodologyVersion,
    area_ha: round(result.areaHa),
    cultivation_days: result.cultivationDays,
    baseline_ch4_kg: round(result.baseline.ch4Kg),
    project_ch4_kg: round(result.project.ch4Kg),
    baseline_n2o_kg: round(result.baseline.n2oKg),
    project_n2o_kg: round(result.project.n2oKg),
    baseline_burning_co2e_t: round(result.baseline.burningCo2eT),
    project_burning_co2e_t: round(result.project.burningCo2eT),
    baseline_co2e_t: round(result.baseline.co2eT),
    project_co2e_t: round(result.project.co2eT),
    reduction_co2e_t: round(result.reductionCo2eT),
    inputs: asJson({ ...collected.input, derived: result.derived }),
    factors: asJson(result.factors),
    computed_by: userId,
    is_current: true,
  });

  if (error) throw new Error(error.message);
  return { ok: true, reductionCo2eT: result.reductionCo2eT };
}
