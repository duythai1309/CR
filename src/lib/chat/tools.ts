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

/**
 * Mọi công cụ mở cho cả bốn vai trò toàn cục.
 *
 * `user_role` là trục quyền của module cũ (hợp tác xã / chợ tín chỉ) và cố ý KHÔNG có
 * giá trị riêng cho nền tảng dự án — xem `docs/design/auth-role-design.md` §1. Quyền
 * thật trên dữ liệu dự án nằm ở `project_members` và được RLS cưỡng chế
 * (`projects_read`, `project_tasks_read`… trong `0013_project_platform.sql:887-915`),
 * nên lọc thêm theo vai trò toàn cục ở đây chỉ chặn nhầm người, không chặn thêm được gì.
 */
const ALL: UserRole[] = ["coop_manager", "coop_staff", "buyer", "platform_admin"];

const NO_PARAMS: ToolParamSchema = { type: "object", properties: {} };

/** Tham số tên dự án dùng lại ở nhiều công cụ; luôn không bắt buộc. */
const TEN_DU_AN = {
  type: "string" as const,
  description:
    "CHỈ tên riêng của dự án, không kèm từ 'dự án'. Bỏ trống thì lấy dự án vừa cập nhật " +
    "gần nhất. Tên không khớp dự án nào thì hàm báo không tìm thấy, KHÔNG tự lấy dự án " +
    "khác thay thế.",
};

export const TOOLS: ToolSpec[] = [
  {
    name: "liet_ke_du_an",
    description:
      "Danh sách dự án carbon mà người đang hỏi là thành viên: tên, vai trò trong dự án, " +
      "số bước thiết kế đã duyệt trên tổng bảy bước, Standard và Methodology đã chọn, số " +
      "thành viên. PHẢI gọi khi hỏi có những dự án nào, dự án tên gì, quy trình có bao " +
      "nhiêu bước, hoặc cần xác định dự án trước khi gọi tool chi tiết.",
    parameters: NO_PARAMS,
    roles: ALL,
  },
  {
    name: "tien_do_du_an",
    description:
      "Tiến độ chi tiết của một dự án: bảy bước thiết kế đã duyệt tới đâu và ai duyệt, " +
      "bước kế tiếp còn vướng điều kiện gì, số công việc theo từng trạng thái, các kỳ " +
      "giám sát, và ước tính giảm phát thải gần nhất nếu đã sinh báo cáo. PHẢI gọi trước " +
      "mọi khẳng định về tiến độ, bước hiện tại/tiếp theo hoặc số lượng việc của dự án.",
    parameters: { type: "object", properties: { ten_du_an: TEN_DU_AN } },
    roles: ALL,
  },
  {
    name: "yeu_cau_cua_buoc",
    description:
      "Một bước trong bảy bước thiết kế cần thoả điều kiện gì thì chủ dự án mới duyệt " +
      "được, và hiện đã thoả tới đâu. Điều kiện lấy từ đúng luật mà cơ sở dữ liệu áp " +
      "khi duyệt, không phải quy trình chung của ngành. PHẢI gọi cho mọi câu hỏi kiểu " +
      "'làm sao qua được bước này', 'còn thiếu gì để duyệt'.",
    parameters: {
      type: "object",
      properties: {
        buoc: {
          type: "number",
          description:
            "Số thứ tự bước, từ 1 đến 7. Bỏ trống thì lấy bước chưa duyệt gần nhất.",
        },
        ten_du_an: TEN_DU_AN,
      },
    },
    roles: ALL,
  },
  {
    name: "goi_y_methodology",
    description:
      "Các methodology CÓ TRONG CATALOG của hệ thống, lọc theo mô tả loại hình dự án. " +
      "Trả về Standard, mã, version, loại hình và cờ dữ liệu mẫu. PHẢI gọi khi hỏi catalog " +
      "có bao nhiêu/tên gì, muốn so sánh hoặc chọn Methodology. Catalog chỉ có dữ liệu MẪU tự soạn — " +
      "hàm trả về cờ đó, phải nói lại cho người dùng mỗi lần gợi ý.",
    parameters: {
      type: "object",
      properties: {
        mo_ta: {
          type: "string",
          description:
            "Mô tả loại hình dự án hoặc từ khoá, ví dụ 'trồng rừng', 'biogas', 'điện " +
            "mặt trời'. Bỏ trống thì trả toàn bộ catalog.",
        },
      },
    },
    roles: ALL,
  },
  {
    name: "field_giam_sat_cua_methodology",
    description:
      "Các field mà một methodology yêu cầu, tách rõ nhóm baseline (kịch bản cơ sở, khai " +
      "một lần cho dự án) và nhóm observation (dữ liệu quan sát, nhập theo từng kỳ giám " +
      "sát), kèm đơn vị, bắt buộc hay không, ràng buộc giá trị và tên cột khi nhập CSV. " +
      "PHẢI gọi khi câu hỏi nêu tên/mã field, hỏi field cần đo, đơn vị, type, bounds hoặc " +
      "cột CSV. Nếu chỉ có tên field thì vẫn gọi với args rỗng; không hỏi ngược trước.",
    parameters: {
      type: "object",
      properties: {
        ma_methodology: {
          type: "string",
          description:
            "Mã methodology trong catalog, ví dụ 'DEMO-VCS-FOREST'. Bỏ trống thì lấy " +
            "methodology mà dự án ở tham số 'ten_du_an' đang chọn.",
        },
        ten_du_an: TEN_DU_AN,
      },
    },
    roles: ALL,
  },
  {
    name: "kiem_tra_baseline",
    description:
      "Đối chiếu baseline (kịch bản cơ sở) đã nhập của một dự án với metric_schema của " +
      "methodology đã chọn: field nào còn thiếu, field nào sai kiểu hoặc ngoài khoảng " +
      "cho phép. PHẢI gọi trước khi nói baseline đủ/thiếu/hợp lệ. Dùng đúng bộ luật mà cơ sở dữ liệu áp khi duyệt bước 5 và khi tạo kỳ " +
      "giám sát, nên trả lời được câu 'baseline của tôi đã đủ chưa'.",
    parameters: { type: "object", properties: { ten_du_an: TEN_DU_AN } },
    roles: ALL,
  },
  {
    name: "cong_viec_theo_buoc",
    description:
      "Công việc của một dự án gom theo bước thiết kế: tiêu đề, trạng thái, hạn, đã quá " +
      "hạn chưa, đã giao cho ai. PHẢI gọi khi người hỏi muốn biết đang tồn việc gì, việc nào " +
      "quá hạn, hay ai đang giữ việc nào.",
    parameters: {
      type: "object",
      properties: {
        ten_du_an: TEN_DU_AN,
        trang_thai: {
          type: "string",
          description:
            "Lọc theo trạng thái công việc. Bỏ trống thì lấy các việc CHƯA xong " +
            "(todo, in_progress, blocked).",
          enum: ["todo", "in_progress", "done", "blocked"],
        },
      },
    },
    roles: ALL,
  },
  {
    name: "liet_ke_ky_giam_sat",
    description:
      "Liệt kê monitoring period của một dự án: khoảng ngày, version, trạng thái mở/khoá, " +
      "data_revision, số record và thời điểm khoá. PHẢI gọi khi hỏi các kỳ đang có hoặc kỳ nào " +
      "sẵn sàng cho báo cáo.",
    parameters: { type: "object", properties: { ten_du_an: TEN_DU_AN } },
    roles: ALL,
  },
  {
    name: "tom_tat_du_lieu_giam_sat",
    description:
      "Kiểm một monitoring period theo schema_snapshot: số record, field bắt buộc thiếu/sai " +
      "theo dòng và những gì thực sự cản RPC khoá kỳ. PHẢI gọi trước khi khẳng định dữ liệu " +
      "kỳ đủ/thiếu hoặc lý do không khoá được. Không biến cảnh báo chất lượng thành " +
      "điều kiện DB.",
    parameters: {
      type: "object",
      properties: {
        ten_du_an: TEN_DU_AN,
        ten_ky: {
          type: "string",
          description: "Tên monitoring period. Bỏ trống thì lấy kỳ mới nhất của dự án.",
        },
        phien_ban_ky: {
          type: "number",
          description: "Version nguyên của kỳ khi có nhiều kỳ cùng tên. Không bắt buộc.",
        },
      },
    },
    roles: ALL,
  },
  {
    name: "liet_ke_bao_cao_mrv",
    description:
      "Liệt kê MRV report đã sinh của dự án: kỳ nguồn, version, preview/final, kết quả ước " +
      "tính, schema_hash, data_revision và thời điểm sinh. PHẢI gọi khi hỏi có báo cáo nào, " +
      "trạng thái/kết quả bao nhiêu hoặc muốn xác định report trước khi đọc trace. Kết quả " +
      "không phải tín chỉ đã phát hành.",
    parameters: { type: "object", properties: { ten_du_an: TEN_DU_AN } },
    roles: ALL,
  },
  {
    name: "doc_vet_tinh_bao_cao",
    description:
      "Đọc calculation_trace đã lưu trong một MRV report: thứ tự tính, factors kèm nguồn, " +
      "từng phép theo observation và aggregation toàn kỳ. PHẢI gọi khi hỏi báo cáo MRV lấy " +
      "dữ liệu từ đâu, vì sao ra con số đó, nguồn factor hoặc provenance. Chỉ diễn giải " +
      "snapshot, không tự tính lại.",
    parameters: {
      type: "object",
      properties: {
        ten_du_an: TEN_DU_AN,
        ten_ky: {
          type: "string",
          description: "Tên kỳ nguồn để phân biệt các report cùng version. Không bắt buộc.",
        },
        phien_ban_bao_cao: {
          type: "number",
          description: "Version nguyên của report. Bỏ trống thì lấy report sinh gần nhất.",
        },
      },
    },
    roles: ALL,
  },
  {
    name: "thanh_vien_va_phan_cong",
    description:
      "Danh sách thành viên dự án và các công việc đang giao cho từng người. Danh tính lấy " +
      "qua project_member_directory, không đọc trực tiếp profiles. PHẢI gọi trước khi nói " +
      "ai là thành viên, vai trò/quyền trong dự án hoặc ai đang được giao việc.",
    parameters: { type: "object", properties: { ten_du_an: TEN_DU_AN } },
    roles: ALL,
  },
  {
    name: "tai_lieu_theo_buoc",
    description:
      "Liệt kê project document đã nộp theo từng bước, gồm kind, version, tên tệp và thời " +
      "điểm. PHẢI gọi trước khi nói tài liệu nào đã nộp/còn thiếu. Chỉ kết luận thiếu khi " +
      "hệ thống có rule bắt buộc; không suy diễn checklist Standard.",
    parameters: {
      type: "object",
      properties: {
        ten_du_an: TEN_DU_AN,
        buoc: {
          type: "number",
          description: "Lọc ordinal từ 1 đến 7. Bỏ trống thì trả cả bảy bước.",
        },
      },
    },
    roles: ALL,
  },
  {
    name: "liet_ke_standard",
    description:
      "Catalog Standard mà tài khoản hiện nhìn thấy trong DB, kèm số Methodology catalog " +
      "theo từng Standard và số bản SAMPLE. PHẢI gọi khi hỏi hệ thống có Standard nào, " +
      "bao nhiêu Standard hoặc Methodology được phân theo Standard ra sao. Không mô tả " +
      "yêu cầu Standard từ trí nhớ.",
    parameters: NO_PARAMS,
    roles: ALL,
  },
];

export type ToolName = (typeof TOOLS)[number]["name"];

export function toolsForRole(role: UserRole): ToolSpec[] {
  return TOOLS.filter((t) => t.roles.includes(role));
}

export function findTool(name: string, role: UserRole): ToolSpec | null {
  return toolsForRole(role).find((t) => t.name === name) ?? null;
}
