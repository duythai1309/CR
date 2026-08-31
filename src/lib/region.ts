import type { Database } from "@/types/database";

type VnRegion = Database["public"]["Enums"]["vn_region"];
type SeasonType = Database["public"]["Enums"]["season_type"];

/**
 * Vùng đang triển khai. Toàn bộ giao diện chỉ trình bày thông tin của vùng này:
 * biểu đồ hệ số, danh sách loại vụ, và hồ sơ hợp tác xã.
 *
 * Cơ sở dữ liệu vẫn giữ đủ hệ số của cả ba miền, nên mở rộng sang vùng khác chỉ
 * cần bỏ giới hạn ở đây và cho người dùng chọn lại vùng khi tạo hợp tác xã.
 */
export const ACTIVE_REGION: VnRegion = "north";

/** Miền Bắc làm hai vụ lúa nước mỗi năm. */
export const ACTIVE_SEASON_TYPES: SeasonType[] = ["early", "late"];

/** Hệ số phát thải nền của vùng đang triển khai, kg CH₄/ha/ngày. */
export const ACTIVE_REGION_FACTORS: Array<{
  seasonType: SeasonType;
  label: string;
  value: number;
}> = [
  { seasonType: "early", label: "Vụ Xuân", value: 2.21 },
  { seasonType: "late", label: "Vụ Mùa", value: 3.89 },
];

/** Mặc định toàn cầu của IPCC, để đối chiếu. */
export const IPCC_GLOBAL_DEFAULT = 1.19;
