import type { UserRole } from "@/lib/auth";

/**
 * Lược đồ tham số viết bằng JSON Schema thuần thay vì kiểu riêng của SDK Gemini.
 * Bảng công cụ là phần đặc tả nghiệp vụ, không nên dính vào một nhà cung cấp cụ
 * thể; `provider.ts` lo việc chuyển đổi.
 */
export interface ToolParamSchema {
  type: "object";
  properties: Record<
    string,
    { type: "string" | "number" | "boolean"; description: string; enum?: string[] }
  >;
  required?: string[];
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: ToolParamSchema;
  /** Vai trò được phép gọi. Đây là lớp phòng thủ thứ hai — RLS mới là lớp chặn thật. */
  roles: UserRole[];
}

const COOP: UserRole[] = ["coop_manager", "coop_staff"];
const ALL: UserRole[] = ["coop_manager", "coop_staff", "buyer", "platform_admin"];

const NO_PARAMS: ToolParamSchema = { type: "object", properties: {} };

export const TOOLS: ToolSpec[] = [
  {
    name: "tra_cuu_he_so",
    description:
      "Tra hệ số phát thải đang dùng trong bộ hệ số hiện hành, kèm đơn vị, mô tả và " +
      "nguồn trích dẫn. Dùng khi người hỏi muốn biết một hệ số bằng bao nhiêu hoặc " +
      "lấy từ đâu. Luôn gọi hàm này thay vì nhớ con số.",
    parameters: {
      type: "object",
      properties: {
        tu_khoa: {
          type: "string",
          description:
            "Lọc theo khoá hệ số, ví dụ 'ef_c', 'sfw', 'gwp', 'burn'. Bỏ trống thì trả về tất cả.",
        },
      },
    },
    roles: ALL,
  },
  {
    name: "liet_ke_mua_vu",
    description:
      "Danh sách mùa vụ của hợp tác xã: tên, loại vụ, ngày bắt đầu, số thửa đã đăng ký, " +
      "đã khoá hay chưa. Gọi trước khi trả lời bất kỳ câu hỏi nào nhắc tới một mùa vụ, " +
      "để biết tên vụ chính xác trong hệ thống.",
    parameters: NO_PARAMS,
    roles: COOP,
  },
  {
    name: "tong_ket_mua_vu",
    description:
      "Tổng kết một mùa vụ: tổng diện tích, số thửa đã tính và chưa tính MRV, tổng lượng " +
      "giảm phát thải đã tính được (tấn CO2e). Con số lấy từ bản tính đang hiệu lực.",
    parameters: {
      type: "object",
      properties: {
        ten_mua_vu: {
          type: "string",
          description:
            "CHỈ tên riêng của mùa vụ, ví dụ 'Vụ Xuân 2026' — không kèm từ 'mùa vụ'. " +
            "Bỏ trống thì lấy vụ mới nhất. Tên không khớp vụ nào thì hàm báo không tìm thấy, " +
            "KHÔNG tự lấy vụ khác thay thế.",
        },
      },
    },
    roles: COOP,
  },
  {
    name: "thua_thieu_nhat_ky",
    description:
      "Các thửa-vụ chưa tính được MRV, kèm danh sách đích danh những mục còn thiếu " +
      "(ngày cấy, ngày thu hoạch, cách xử lý rơm rạ, ranh thửa...). Dùng khi người hỏi " +
      "muốn biết còn phải nhập gì.",
    parameters: {
      type: "object",
      properties: {
        ten_mua_vu: {
          type: "string",
          description: "Giới hạn trong một mùa vụ. Bỏ trống thì xét toàn bộ.",
        },
      },
    },
    roles: COOP,
  },
  {
    name: "chi_tiet_thua_vu",
    description:
      "Chi tiết một thửa trong một vụ: nông hộ, diện tích, ngày cấy/gặt, số lần tháo nước, " +
      "lượng đạm, cách xử lý rơm rạ, và kết quả tính phát thải nếu đã tính.",
    parameters: {
      type: "object",
      properties: {
        ten_thua: {
          type: "string",
          description:
            "CHỈ tên riêng của thửa, không kèm từ phân loại. Người hỏi nói 'thửa Ruộng Bãi' " +
            "thì truyền 'Ruộng Bãi'. Khớp gần đúng được, nhưng thừa chữ 'thửa' sẽ không tìm ra.",
        },
        ten_mua_vu: {
          type: "string",
          description:
            "CHỈ tên riêng của mùa vụ, ví dụ 'Vụ Xuân 2026' — không kèm từ 'mùa vụ'. " +
            "Bỏ trống thì lấy vụ gần nhất của thửa đó.",
        },
      },
      required: ["ten_thua"],
    },
    roles: COOP,
  },
  {
    name: "liet_ke_nong_ho",
    description:
      "Danh sách nông hộ của hợp tác xã kèm số thửa và tổng diện tích đã vẽ ranh.",
    parameters: {
      type: "object",
      properties: {
        tu_khoa: { type: "string", description: "Lọc theo tên hoặc thôn/xóm." },
      },
    },
    roles: COOP,
  },
  {
    name: "liet_ke_lo_tin_chi",
    description:
      "Các lô tín chỉ: mã, tên, trạng thái, lượng gộp, lượng phát hành sau đệm rủi ro, " +
      "lượng đã bán, giá chào bán.",
    parameters: {
      type: "object",
      properties: {
        trang_thai: {
          type: "string",
          description: "Lọc theo trạng thái lô.",
          enum: ["draft", "submitted", "verified", "listed", "sold", "retired"],
        },
      },
    },
    roles: ["coop_manager", "coop_staff", "platform_admin"],
  },
  {
    name: "chia_doanh_thu",
    description:
      "Bảng chia doanh thu của một lô tín chỉ đã bán: phần nền tảng, phần hợp tác xã, " +
      "phần nông hộ, và chi tiết từng hộ nhận bao nhiêu.",
    parameters: {
      type: "object",
      properties: { ma_lo: { type: "string", description: "Mã lô tín chỉ, ví dụ LTC-2026-01." } },
      required: ["ma_lo"],
    },
    roles: ["coop_manager", "platform_admin"],
  },
  {
    name: "lo_dang_chao_ban",
    description:
      "Các lô tín chỉ đang chào bán trên chợ: mã, hợp tác xã, lượng còn khả dụng, giá mỗi tấn.",
    parameters: NO_PARAMS,
    roles: ["buyer", "platform_admin"],
  },
  {
    name: "don_hang_cua_toi",
    description:
      "Đơn hàng của chính người đang hỏi: mã đơn, lô, khối lượng, thành tiền, trạng thái " +
      "đơn và trạng thái thanh toán.",
    parameters: NO_PARAMS,
    roles: ["buyer"],
  },
];

export type ToolName = (typeof TOOLS)[number]["name"];

export function toolsForRole(role: UserRole): ToolSpec[] {
  return TOOLS.filter((t) => t.roles.includes(role));
}

export function findTool(name: string, role: UserRole): ToolSpec | null {
  return toolsForRole(role).find((t) => t.name === name) ?? null;
}
