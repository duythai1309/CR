import type { Database } from "@/types/database";
import type { ProjectRole } from "@/types/project-platform";

type Enums = Database["public"]["Enums"];

export const ROLE_LABEL: Record<Enums["user_role"], string> = {
  platform_admin: "Quản trị nền tảng",
  coop_manager: "Giám đốc hợp tác xã",
  coop_staff: "Cán bộ hợp tác xã",
  buyer: "Doanh nghiệp mua tín chỉ",
};

/**
 * Vai trò trong MỘT dự án — trục quyền của nền tảng dự án.
 *
 * Tách hẳn khỏi `ROLE_LABEL` ở trên: `user_role` nói người này là ai trên nền tảng,
 * `project_role` nói họ làm gì trong dự án đang mở. Một người có thể là owner ở dự án
 * này và viewer ở dự án khác, nên hai nhãn không bao giờ thay thế được cho nhau.
 * Xem `docs/design/auth-role-design.md` §1.
 */
export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  owner: "Chủ dự án",
  developer: "Đơn vị phát triển",
  viewer: "Người xem",
};

export const REGION_LABEL: Record<Enums["vn_region"], string> = {
  north: "Miền Bắc",
  central: "Miền Trung",
  south: "Miền Nam",
};

export const SEASON_TYPE_LABEL: Record<Enums["season_type"], string> = {
  early: "Vụ Xuân (vụ đầu năm)",
  mid: "Vụ Hè Thu (vụ giữa năm)",
  late: "Vụ Mùa (vụ cuối năm)",
};

/** Lịch thời vụ tham khảo, dùng làm gợi ý khi cán bộ chọn loại vụ. */
export const SEASON_CALENDAR: Record<Enums["vn_region"], Partial<Record<Enums["season_type"], string>>> = {
  north: {
    early: "Cấy tháng 1–2, gặt tháng 5–6",
    late: "Cấy tháng 6–7, gặt tháng 9–10",
  },
  central: {
    early: "Cấy tháng 12–1, gặt tháng 4–5",
    mid: "Cấy tháng 5–6, gặt tháng 8–9",
    late: "Cấy tháng 9–10, gặt tháng 12",
  },
  south: {
    early: "Cấy tháng 11–12, gặt tháng 2–3",
    mid: "Cấy tháng 4–5, gặt tháng 7–8",
    late: "Cấy tháng 8–9, gặt tháng 11–12",
  },
};

export const WATER_REGIME_LABEL: Record<Enums["water_regime"], string> = {
  continuously_flooded: "Ngập liên tục",
  single_aeration: "Rút nước một lần",
  multiple_aeration: "Rút nước nhiều lần (AWD)",
};

export const PRESEASON_LABEL: Record<Enums["preseason_water"], string> = {
  non_flooded_short: "Không ngập dưới 180 ngày trước vụ",
  non_flooded_long: "Không ngập trên 180 ngày trước vụ",
  flooded_pre: "Ngập trên 30 ngày trước vụ",
};

export const STRAW_LABEL: Record<Enums["straw_method"], string> = {
  incorporated_short: "Vùi vào ruộng dưới 30 ngày trước vụ",
  incorporated_long: "Vùi vào ruộng trên 30 ngày trước vụ",
  removed: "Mang khỏi ruộng (bán, làm nấm, làm thức ăn)",
  burned: "Đốt ngoài đồng",
  mulched: "Phủ gốc, không vùi",
};

export const ORGANIC_LABEL: Record<Enums["organic_amendment"], string> = {
  straw_incorporated_short: "Rơm rạ vùi dưới 30 ngày",
  straw_incorporated_long: "Rơm rạ vùi trên 30 ngày",
  compost: "Phân ủ compost",
  farmyard_manure: "Phân chuồng",
  green_manure: "Phân xanh",
};

export const WATER_EVENT_LABEL: Record<Enums["water_event_type"], string> = {
  drainage: "Tháo nước",
  reflood: "Cho nước vào lại",
};

export const BATCH_STATUS_LABEL: Record<Enums["batch_status"], string> = {
  draft: "Nháp",
  submitted: "Đã nộp hồ sơ",
  verified: "Đã xác minh",
  listed: "Đang chào bán",
  sold: "Đã bán hết",
  retired: "Đã thu hồi",
};

export const ORDER_STATUS_LABEL: Record<Enums["order_status"], string> = {
  pending: "Chờ xác nhận",
  awaiting_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  cancelled: "Đã huỷ",
  fulfilled: "Đã bàn giao tín chỉ",
};

export const PAYMENT_STATUS_LABEL: Record<Enums["payment_status"], string> = {
  pending: "Đang xử lý",
  succeeded: "Thành công",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
};
