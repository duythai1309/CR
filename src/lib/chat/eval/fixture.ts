import type { UserRole } from "@/lib/auth";
import type { ToolCall } from "../provider";
import { findTool } from "../tools";
import { tenRieng } from "../handlers";

/**
 * Dự án giả lập dùng cho eval.
 *
 * Eval phải TẤT ĐỊNH: cùng một câu hỏi, chạy hôm nay và chạy tuần sau phải ra cùng
 * một con số, nếu không thì mọi phép so sánh giữa hai phiên bản prompt đều vô nghĩa.
 * Dữ liệu thật thay đổi từng ngày nên không dùng được.
 *
 * Lý do thứ hai quan trọng không kém: eval platform là một hệ thống riêng, chạy eval
 * trên dữ liệu thật đồng nghĩa với việc đẩy dữ liệu dự án của khách sang đó.
 *
 * Các cờ dưới đây khớp với dữ liệu mẫu thật (`0014_project_platform_samples.sql`):
 * methodology mang `is_sample = true` và `professionally_validated = false`, để ca eval
 * "phải nói rõ đây là dữ liệu mẫu" có căn cứ đối chiếu.
 */

export const FIXTURE_USER = "Nguyễn Văn Cường";
export const FIXTURE_PROJECT = "Rừng ngập mặn Cà Mau";
export const FIXTURE_METHODOLOGY = "DEMO-VCS-FOREST";

/**
 * Còn export vì `src/app/api/eval/chat/route.ts:10` vẫn import — tệp đó không nằm trong
 * phạm vi sửa của đợt này. Nền tảng dự án không có khái niệm hợp tác xã; bỏ hằng số này
 * cùng lúc với đợt gỡ route cũ.
 */
export const FIXTURE_COOP = "";

const CANH_BAO_MAU =
  "Catalog của hệ thống hiện CHỈ có methodology MẪU do nhóm tự soạn, chưa được thẩm " +
  "định chuyên môn và KHÔNG phải methodology được Verra hay Gold Standard công nhận. " +
  "Phải nói rõ điều này mỗi lần nhắc tới chúng, và không được mô tả yêu cầu thật của " +
  "tổ chức chứng nhận nếu dữ liệu không có.";

const DISCLAIMER_MAU =
  "DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn " +
  "hay methodology được Verra/Gold Standard công nhận.";

/** Tên các dự án có thật trong dữ liệu mẫu, để mô phỏng đúng phép tìm của handler. */
const PROJECT_NAMES = [FIXTURE_PROJECT, "Biogas hộ gia đình Đồng Tháp"];

const CATALOG = [
  {
    methodology_id: "20000000-0000-4000-8000-000000000001",
    standard: "VCS",
    standard_ten: "Verra — Verified Carbon Standard (VCS)",
    ma: "DEMO-VCS-FOREST",
    version: "demo-1.0",
    ten: "MẪU VCS — thay đổi trữ lượng carbon rừng",
    loai_hinh: "afolu",
    la_du_lieu_mau: true,
    da_tham_dinh_chuyen_mon: false,
    canh_bao: DISCLAIMER_MAU,
    fields: [
      { id: "baseline_stock_tc_ha", ten: "Trữ lượng carbon nền", scope: "baseline", don_vi: "tC/ha", bat_buoc: true },
      { id: "area_ha", ten: "Diện tích ô đo", scope: "observation", don_vi: "ha", bat_buoc: true },
      { id: "stock_tc_ha", ten: "Trữ lượng carbon đo được", scope: "observation", don_vi: "tC/ha", bat_buoc: true },
    ],
  },
  {
    methodology_id: "20000000-0000-4000-8000-000000000002",
    standard: "VCS",
    standard_ten: "Verra — Verified Carbon Standard (VCS)",
    ma: "DEMO-VCS-ENERGY",
    version: "demo-1.0",
    ten: "MẪU VCS — điện năng thay thế",
    loai_hinh: "energy",
    la_du_lieu_mau: true,
    da_tham_dinh_chuyen_mon: false,
    canh_bao: DISCLAIMER_MAU,
    fields: [
      { id: "baseline_grid_ef", ten: "Hệ số phát thải lưới nền", scope: "baseline", don_vi: "tCO2e/MWh", bat_buoc: true },
      { id: "electricity_mwh", ten: "Điện năng thay thế", scope: "observation", don_vi: "MWh", bat_buoc: true },
    ],
  },
  {
    methodology_id: "20000000-0000-4000-8000-000000000003",
    standard: "GS",
    standard_ten: "Gold Standard",
    ma: "DEMO-GS-FOREST",
    version: "demo-1.0",
    ten: "MẪU GS — thay đổi trữ lượng carbon rừng",
    loai_hinh: "afolu",
    la_du_lieu_mau: true,
    da_tham_dinh_chuyen_mon: false,
    canh_bao: DISCLAIMER_MAU,
    fields: [
      { id: "baseline_stock_tc_ha", ten: "Trữ lượng carbon nền", scope: "baseline", don_vi: "tC/ha", bat_buoc: true },
      { id: "area_ha", ten: "Diện tích ô đo", scope: "observation", don_vi: "ha", bat_buoc: true },
    ],
  },
  {
    methodology_id: "20000000-0000-4000-8000-000000000004",
    standard: "GS",
    standard_ten: "Gold Standard",
    ma: "DEMO-GS-BIOGAS",
    version: "demo-1.0",
    ten: "MẪU GS — thu hồi khí sinh học",
    loai_hinh: "biogas",
    la_du_lieu_mau: true,
    da_tham_dinh_chuyen_mon: false,
    canh_bao: DISCLAIMER_MAU,
    fields: [
      { id: "baseline_fuel_t", ten: "Nhiên liệu đường cơ sở", scope: "baseline", don_vi: "t", bat_buoc: true },
      { id: "biogas_m3", ten: "Khí sinh học thu hồi", scope: "observation", don_vi: "m3", bat_buoc: true },
    ],
  },
];

/** Bảy bước của dự án mẫu: đã duyệt tới bước 4, đang vướng ở bước 5. */
const BAY_BUOC = [
  { buoc: 1, ten: "Project Idea", da_duyet: true, duyet_luc: "2026-03-01T00:00:00.000Z" },
  {
    buoc: 2,
    ten: "Feasibility Assessment",
    da_duyet: true,
    duyet_luc: "2026-03-12T00:00:00.000Z",
  },
  { buoc: 3, ten: "Chọn Standard", da_duyet: true, duyet_luc: "2026-04-02T00:00:00.000Z" },
  { buoc: 4, ten: "Chọn Methodology", da_duyet: true, duyet_luc: "2026-04-20T00:00:00.000Z" },
  { buoc: 5, ten: "Baseline", da_duyet: false, duyet_luc: null },
  { buoc: 6, ten: "Additionality", da_duyet: false, duyet_luc: null },
  { buoc: 7, ten: "Project Design/PDD", da_duyet: false, duyet_luc: null },
];

/** Baseline của dự án mẫu còn thiếu đúng một field — ca eval "còn vướng gì" cần điều đó. */
const BASELINE_LOI = [
  {
    field: "baseline_stock_tc_ha",
    ten: "Trữ lượng carbon nền",
    van_de: "Bắt buộc nhưng chưa nhập",
  },
];

const DIEU_KIEN_BUOC_5 = [
  { dieu_kien: "Các bước trước đã duyệt hết", dat: true, cach_lam: "Đã đạt." },
  {
    dieu_kien: "Đã KHOÁ Standard",
    dat: true,
    cach_lam:
      "Chọn rồi bấm khoá Standard ở /du-an/[id]/quy-trinh. Khoá là một chiều, " +
      "không đổi lại được.",
  },
  {
    dieu_kien: "Đã KHOÁ Methodology",
    dat: true,
    cach_lam:
      "Chọn Methodology thuộc Standard đã khoá rồi bấm khoá, cũng ở " +
      "/du-an/[id]/quy-trinh. Khoá là một chiều.",
  },
  {
    dieu_kien: "Baseline hợp lệ theo metric_schema của Methodology đã chọn",
    dat: false,
    cach_lam: "Còn 1 field chưa đạt — gọi kiem_tra_baseline để xem từng cái.",
  },
];

const FIELD_BASELINE = [
  {
    ma: "baseline_stock_tc_ha",
    ten: "Trữ lượng carbon nền",
    kieu: "decimal",
    don_vi: "tC/ha",
    bat_buoc: true,
    bat_buoc_neu: null,
    gia_tri_cho_phep: undefined,
    rang_buoc: { minimum: 0, scale: 4 },
    ten_cot_khi_nhap_csv: ["baseline_stock_tc_ha", "Trữ lượng carbon nền"],
  },
];

const FIELD_QUAN_SAT = [
  {
    ma: "plot_code",
    ten: "Mã ô đo",
    kieu: "text",
    don_vi: null,
    bat_buoc: true,
    bat_buoc_neu: null,
    gia_tri_cho_phep: undefined,
    rang_buoc: null,
    ten_cot_khi_nhap_csv: ["plot_code", "Mã ô đo"],
  },
  {
    ma: "area_ha",
    ten: "Diện tích ô đo",
    kieu: "decimal",
    don_vi: "ha",
    bat_buoc: true,
    bat_buoc_neu: null,
    gia_tri_cho_phep: undefined,
    rang_buoc: { exclusive_minimum: 0, scale: 4 },
    ten_cot_khi_nhap_csv: ["area_ha", "Diện tích ô đo"],
  },
  {
    ma: "stock_tc_ha",
    ten: "Trữ lượng carbon đo được",
    kieu: "decimal",
    don_vi: "tC/ha",
    bat_buoc: true,
    bat_buoc_neu: null,
    gia_tri_cho_phep: undefined,
    rang_buoc: { minimum: 0, scale: 4 },
    ten_cot_khi_nhap_csv: ["stock_tc_ha", "Trữ lượng carbon đo được"],
  },
];

/** Khớp tên dự án theo đúng cách handler thật làm: `tenRieng` rồi `ilike '%...%'`. */
function matchProject(raw: unknown): string | null {
  const name = typeof raw === "string" ? tenRieng(raw).trim().toLowerCase() : "";
  if (!name) return PROJECT_NAMES[0];
  return PROJECT_NAMES.find((n) => n.toLowerCase().includes(name)) ?? null;
}

/**
 * Kết quả cố định của từng công cụ. Khoá của object này phải phủ đúng bộ công cụ
 * trong `tools.ts` — có kiểm thử canh việc đó, để thêm công cụ mới mà quên fixture
 * thì bộ test đỏ chứ không phải tới lúc chạy eval mới lộ.
 */
export const FIXTURE_RESULTS: Record<
  string,
  (args: Record<string, unknown>) => Record<string, unknown>
> = {
  liet_ke_du_an: () => ({
    du_an: [
      {
        ten: FIXTURE_PROJECT,
        mo_ta: "Trồng lại rừng ngập mặn ven biển, giai đoạn 1.",
        vai_tro_trong_du_an: "chủ dự án",
        buoc_da_duyet: "4/7",
        so_thanh_vien: 3,
        standard: "VCS",
        standard_da_khoa: true,
        methodology: "DEMO-VCS-FOREST · demo-1.0",
        methodology_da_khoa: true,
        loai_hinh: "afolu",
        methodology_la_du_lieu_mau: true,
        cap_nhat_gan_nhat: "2026-09-01T00:00:00.000Z",
        da_xoa: false,
      },
      {
        ten: "Biogas hộ gia đình Đồng Tháp",
        mo_ta: null,
        vai_tro_trong_du_an: "đơn vị phát triển",
        buoc_da_duyet: "2/7",
        so_thanh_vien: 2,
        standard: "GS",
        standard_da_khoa: false,
        methodology: null,
        methodology_da_khoa: false,
        loai_hinh: null,
        methodology_la_du_lieu_mau: null,
        cap_nhat_gan_nhat: "2026-08-01T00:00:00.000Z",
        da_xoa: false,
      },
    ],
    ghi_chu: "'buoc_da_duyet' đếm trên bảy bước thiết kế cố định. " + CANH_BAO_MAU,
  }),

  tien_do_du_an: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return {
        khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.`,
      };
    if (name !== FIXTURE_PROJECT)
      return {
        du_an: name,
        vai_tro_cua_nguoi_hoi: "đơn vị phát triển",
        da_xoa: false,
        standard_da_khoa: false,
        methodology_da_khoa: false,
        methodology: null,
        methodology_la_du_lieu_mau: null,
        bay_buoc: BAY_BUOC.map((b) => ({
          ...b,
          da_duyet: b.buoc <= 2,
          duyet_luc: b.buoc <= 2 ? b.duyet_luc : null,
          nguoi_duyet: b.buoc <= 2 ? "Trần Thị Bích" : null,
        })),
        buoc_ke_tiep: {
          buoc: 3,
          ten: "Chọn Standard",
          dieu_kien: [
            { dieu_kien: "Các bước trước đã duyệt hết", dat: true, cach_lam: "Đã đạt." },
            {
              dieu_kien: "Đã KHOÁ Standard",
              dat: false,
              cach_lam:
                "Chọn rồi bấm khoá Standard ở /du-an/[id]/quy-trinh. Khoá là một chiều, " +
                "không đổi lại được.",
            },
          ],
        },
        cong_viec: { tong: 4, chua_lam: 3, dang_lam: 1, xong: 0, vuong: 0 },
        ky_giam_sat: [],
        bao_cao_gan_nhat: null,
        ghi_chu:
          "Con số ở 'bao_cao_gan_nhat' là ƯỚC TÍNH theo phương pháp luận đã chọn, chưa qua " +
          "thẩm định độc lập và không phải tín chỉ đã được phát hành. " +
          "Chỉ chủ dự án mới duyệt được bước. " +
          CANH_BAO_MAU,
      };

    return {
      du_an: FIXTURE_PROJECT,
      vai_tro_cua_nguoi_hoi: "chủ dự án",
      da_xoa: false,
      standard_da_khoa: true,
      methodology_da_khoa: true,
      methodology: "DEMO-VCS-FOREST · demo-1.0",
      methodology_la_du_lieu_mau: true,
      bay_buoc: BAY_BUOC.map((b) => ({
        ...b,
        nguoi_duyet: b.da_duyet ? FIXTURE_USER : null,
      })),
      buoc_ke_tiep: { buoc: 5, ten: "Baseline", dieu_kien: DIEU_KIEN_BUOC_5 },
      cong_viec: { tong: 9, chua_lam: 3, dang_lam: 2, xong: 3, vuong: 1 },
      ky_giam_sat: [
        {
          ten: "Kỳ 2026-2",
          tu_ngay: "2026-07-01",
          den_ngay: "2026-12-31",
          ban: 1,
          trang_thai: "đang mở",
          so_lan_ghi: 2,
        },
        {
          ten: "Kỳ 2026-1",
          tu_ngay: "2026-01-01",
          den_ngay: "2026-06-30",
          ban: 1,
          trang_thai: "đã khoá",
          so_lan_ghi: 3,
        },
      ],
      bao_cao_gan_nhat: {
        ban: 1,
        trang_thai: "xem thử",
        uoc_tinh: "128.4200",
        don_vi: "tCO2e",
        sinh_luc: "2026-08-15T02:10:00.000Z",
      },
      ghi_chu:
        "Con số ở 'bao_cao_gan_nhat' là ƯỚC TÍNH theo phương pháp luận đã chọn, chưa qua " +
        "thẩm định độc lập và không phải tín chỉ đã được phát hành. " +
        "Chỉ chủ dự án mới duyệt được bước. " +
        CANH_BAO_MAU,
    };
  },

  yeu_cau_cua_buoc: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return {
        khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.`,
      };

    const raw = args.buoc;
    const wanted = raw === null || raw === undefined || raw === "" ? 5 : Math.trunc(Number(raw));
    if (!Number.isFinite(wanted) || wanted < 1 || wanted > 7)
      return {
        tham_so_sai:
          "Dự án chỉ có bảy bước thiết kế cố định, đánh số 1 đến 7. Không có bước nào khác.",
      };

    const stage = BAY_BUOC[wanted - 1];
    const dieuKien = DIEU_KIEN_BUOC_5.slice(
      0,
      wanted >= 5 ? 4 : wanted >= 4 ? 3 : wanted >= 3 ? 2 : 1,
    );

    return {
      du_an: FIXTURE_PROJECT,
      buoc: stage.buoc,
      ten_buoc: stage.ten,
      da_duyet: stage.da_duyet,
      duyet_luc: stage.duyet_luc,
      dieu_kien: dieuKien,
      con_vuong: dieuKien.filter((c) => !c.dat).map((c) => c.dieu_kien),
      ai_duyet_duoc: "Chỉ chủ dự án (owner).",
      nguoi_hoi_duyet_duoc: true,
      ghi_chu:
        "Danh sách điều kiện này là ĐÚNG luật mà cơ sở dữ liệu áp khi duyệt bước " +
        "(hàm approve_project_stage), không phải quy trình chung của ngành hay yêu cầu " +
        "của Verra/Gold Standard. Ngoài các điều kiện trên, hệ thống không cưỡng chế gì " +
        "thêm — đừng suy diễn thêm điều kiện nào không có ở đây.",
    };
  },

  goi_y_methodology: (args) => {
    const keyword = typeof args.mo_ta === "string" ? args.mo_ta.trim().toLowerCase() : "";
    const terms = keyword ? keyword.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3) : [];
    const matched = terms.length
      ? CATALOG.filter((m) => {
          const haystack = [m.ma, m.ten, m.loai_hinh, m.standard].join(" ").toLowerCase();
          return terms.some((t) => haystack.includes(t));
        })
      : CATALOG;

    return {
      tim_theo: keyword || null,
      khop: matched,
      tong_so_trong_catalog: CATALOG.length,
      ghi_chu:
        (matched.length === 0
          ? "Không có methodology nào trong catalog khớp mô tả. Nói thẳng là hệ thống " +
            "chưa có, KHÔNG được gợi ý methodology thật của Verra/Gold Standard từ trí nhớ. "
          : "") + CANH_BAO_MAU,
    };
  },

  field_giam_sat_cua_methodology: (args) => {
    const code = typeof args.ma_methodology === "string" ? args.ma_methodology.trim() : "";
    if (code && !CATALOG.some((m) => m.ma.toLowerCase().includes(tenRieng(code).toLowerCase())))
      return {
        khong_tim_thay: `Catalog không có methodology nào mã khớp "${code}". ` + CANH_BAO_MAU,
      };

    const duAn = code ? null : matchProject(args.ten_du_an);
    if (!code && !duAn)
      return {
        khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.`,
      };
    if (!code && duAn !== FIXTURE_PROJECT)
      return {
        du_an: duAn,
        chua_chon_methodology: true,
        ghi_chu:
          "Dự án này chưa chọn Methodology nên chưa có bộ field nào. Chọn ở bước 4, " +
          "màn hình /du-an/[id]/quy-trinh.",
      };

    return {
      du_an: duAn,
      methodology: "DEMO-VCS-FOREST · demo-1.0",
      ten: "MẪU VCS — thay đổi trữ lượng carbon rừng",
      standard_id: "10000000-0000-4000-8000-000000000001",
      loai_hinh: "afolu",
      la_du_lieu_mau: true,
      schema_hash: "mau-khong-phai-hash-that",
      field_baseline: FIELD_BASELINE,
      field_quan_sat: FIELD_QUAN_SAT,
      dai_luong_tinh_ra: [{ ma: "credit_tco2e", don_vi: "tCO2e", gop_theo: "sum" }],
      he_so_can_co: [{ khoa: "c_to_co2", don_vi: "1" }],
      ghi_chu:
        "'field_baseline' khai MỘT LẦN cho cả dự án ở bước 5; 'field_quan_sat' nhập theo " +
        "từng dòng dữ liệu trong mỗi kỳ giám sát, tay hoặc từ CSV. Tệp CSV cần hai cột " +
        "record_key và observed_on cùng các cột ở 'ten_cot_khi_nhap_csv'. " +
        CANH_BAO_MAU,
    };
  },

  kiem_tra_baseline: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return {
        khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.`,
      };
    if (name !== FIXTURE_PROJECT)
      return {
        du_an: name,
        chua_chon_methodology: true,
        ghi_chu:
          "Chưa chọn Methodology thì chưa có lược đồ để đối chiếu baseline. Chọn ở bước 4.",
      };

    return {
      du_an: FIXTURE_PROJECT,
      methodology: "DEMO-VCS-FOREST · demo-1.0",
      methodology_la_du_lieu_mau: true,
      dat: false,
      so_field_baseline: 1,
      so_field_da_nhap: 0,
      ban_sua_baseline: 0,
      con_thieu_hoac_sai: BASELINE_LOI,
      ghi_chu:
        "Còn field chưa đạt, nên duyệt bước 5 và tạo kỳ giám sát đều sẽ bị từ chối." +
        " Đây là kiểm tra KỸ THUẬT theo metric_schema, không phải đánh giá chuyên môn " +
        "xem kịch bản cơ sở có hợp lý hay không — việc đó thuộc về VVB, ngoài phạm vi " +
        "hệ thống. " +
        CANH_BAO_MAU,
    };
  },

  cong_viec_theo_buoc: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return {
        khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.`,
      };

    const wanted = typeof args.trang_thai === "string" ? args.trang_thai.trim() : "";
    const viec = [
      {
        buoc: 5,
        ten_buoc: "Baseline",
        viec: [
          {
            tieu_de: "Đo trữ lượng carbon nền trên 12 ô mẫu",
            trang_thai: "đang làm",
            han: "2026-09-30",
            qua_han: false,
            giao_cho: "Trần Thị Bích",
          },
          {
            tieu_de: "Nhập baseline vào hệ thống",
            trang_thai: "chưa làm",
            han: "2026-08-15",
            qua_han: true,
            giao_cho: null,
          },
        ],
      },
      {
        buoc: 6,
        ten_buoc: "Additionality",
        viec: [
          {
            tieu_de: "Thu thập chứng cứ rào cản đầu tư",
            trang_thai: "vướng",
            han: null,
            qua_han: false,
            giao_cho: "Trần Thị Bích",
          },
        ],
      },
    ];

    const loc = wanted
      ? viec
          .map((s) => ({
            ...s,
            viec: s.viec.filter(
              (t) =>
                ({ todo: "chưa làm", in_progress: "đang làm", done: "xong", blocked: "vướng" })[
                  wanted
                ] === t.trang_thai,
            ),
          }))
          .filter((s) => s.viec.length > 0)
      : viec;

    return {
      du_an: FIXTURE_PROJECT,
      loc_trang_thai: wanted || "chưa xong (todo, in_progress, blocked)",
      tong_cong_viec_cua_du_an: 9,
      so_viec_khop_bo_loc: loc.reduce((n, s) => n + s.viec.length, 0),
      theo_buoc: loc.map((s) => ({ ...s, so_viec: s.viec.length })),
      ghi_chu:
        "Chỉ giao việc được cho thành viên có vai trò Đơn vị phát triển — đó là ràng " +
        "buộc của cơ sở dữ liệu, không phải lựa chọn giao diện.",
    };
  },

  liet_ke_ky_giam_sat: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return { khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.` };
    if (name !== FIXTURE_PROJECT)
      return {
        du_an: name,
        tong_so_ky: 0,
        ky_giam_sat: [],
        ghi_chu: "Chỉ monitoring period đã khoá mới sinh được MRV report.",
      };
    return {
      du_an: FIXTURE_PROJECT,
      tong_so_ky: 2,
      ky_giam_sat: [
        {
          ma_ky: "period-open",
          ten: "Kỳ 2026-2",
          tu_ngay: "2026-07-01",
          den_ngay: "2026-12-31",
          phien_ban: 1,
          trang_thai: "đang mở",
          data_revision: 2,
          so_ban_ghi: 2,
          khoa_luc: null,
          co_the_sinh_bao_cao: false,
        },
        {
          ma_ky: "period-locked",
          ten: "Kỳ 2026-1",
          tu_ngay: "2026-01-01",
          den_ngay: "2026-06-30",
          phien_ban: 1,
          trang_thai: "đã khoá",
          data_revision: 3,
          so_ban_ghi: 3,
          khoa_luc: "2026-07-05T03:00:00.000Z",
          co_the_sinh_bao_cao: true,
        },
      ],
      ghi_chu:
        "Chỉ monitoring period đã khoá mới sinh được MRV report. Khoá kỳ đóng băng " +
        "snapshot; cần sửa dữ liệu thì tạo kỳ version mới, không sửa kỳ cũ.",
    };
  },

  tom_tat_du_lieu_giam_sat: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return { khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.` };
    const wanted = typeof args.ten_ky === "string" ? args.ten_ky.toLowerCase() : "";
    if (wanted && !"kỳ 2026-2".includes(wanted))
      return { khong_tim_thay: "Không có monitoring period nào khớp trong dự án này." };
    return {
      du_an: FIXTURE_PROJECT,
      ky: {
        ma_ky: "period-open",
        ten: "Kỳ 2026-2",
        phien_ban: 1,
        tu_ngay: "2026-07-01",
        den_ngay: "2026-12-31",
        trang_thai: "đang mở",
        data_revision: 2,
        schema_hash: "schema-fixture-forest-v1",
      },
      so_ban_ghi_da_doc: 2,
      da_doc_het: true,
      loi_theo_field: [],
      chi_tiet_loi: [],
      du_lieu_gan_nhat: [
        { record_key: "PLOT-01", observed_on: "2026-08-01", revision: 1, nguoi_nhap: FIXTURE_USER, cap_nhat_luc: "2026-08-01T08:00:00.000Z" },
        { record_key: "PLOT-02", observed_on: "2026-08-02", revision: 2, nguoi_nhap: "Trần Thị Bích", cap_nhat_luc: "2026-08-02T08:00:00.000Z" },
      ],
      blocker_do_db_thuc_su_cuong_che: [],
      co_the_goi_rpc_khoa_ky: true,
      canh_bao_chat_luong_du_lieu: [],
      ghi_chu:
        "RPC lock_monitoring_period hiện cưỡng chế: project còn hoạt động, người gọi là " +
        "owner, kỳ open, expected data_revision khớp và có ít nhất một record. Lỗi field " +
        "là cảnh báo chất lượng trước khi khoá, KHÔNG được nói sai rằng DB đang chặn nếu " +
        "RPC chưa có rule đó. Dùng data_revision hiện tại làm expected revision.",
    };
  },

  liet_ke_bao_cao_mrv: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return { khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.` };
    return {
      du_an: FIXTURE_PROJECT,
      tong_so_bao_cao: 1,
      bao_cao: [{
        ma_bao_cao: "report-1",
        ky: "Kỳ 2026-1",
        khoang_ngay: "2026-01-01 → 2026-06-30",
        phien_ban: 1,
        trang_thai: "preview",
        uoc_tinh: "128.4200",
        don_vi: "tCO2e",
        standard: "VCS",
        methodology: "DEMO-VCS-FOREST · demo-1.0",
        methodology_la_du_lieu_mau: true,
        schema_hash: "schema-fixture-forest-v1",
        data_revision: 3,
        baseline_revision: 1,
        engine_version: "methodology-engine/1",
        sinh_luc: "2026-08-15T02:10:00.000Z",
      }],
      ghi_chu:
        "Mọi giá trị là ƯỚC TÍNH MRV lưu trong report snapshot, chưa qua verification và " +
        "KHÔNG phải tín chỉ đã phát hành. " + CANH_BAO_MAU,
    };
  },

  doc_vet_tinh_bao_cao: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return { khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.` };
    if (args.phien_ban_bao_cao !== undefined && Number(args.phien_ban_bao_cao) !== 1)
      return { khong_tim_thay: "Không có MRV report nào khớp." };
    return {
      du_an: FIXTURE_PROJECT,
      bao_cao: {
        ma_bao_cao: "report-1",
        ky: "Kỳ 2026-1",
        phien_ban: 1,
        trang_thai: "preview",
        uoc_tinh: "128.4200",
        don_vi: "tCO2e",
        standard: "VCS",
        methodology: "DEMO-VCS-FOREST · demo-1.0",
        methodology_la_du_lieu_mau: true,
        schema_hash: "schema-fixture-forest-v1",
        data_revision: 3,
        baseline_revision: 1,
        engine_version: "methodology-engine/1",
        sinh_luc: "2026-08-15T02:10:00.000Z",
      },
      lap_luan_tinh_toan: {
        thu_tu: ["credit_tco2e"],
        precision_digits: 28,
        rounding: "half_even",
        output_scale: 4,
        operations: 6,
        tung_quan_sat: [{
          record_key: "PLOT-01",
          factors: [{ key: "c_to_co2", value: "3.6667", unit: "1", source: "fixture factor snapshot" }],
          calculations: {
            credit_tco2e: {
              value: "60.2200",
              nodes: [{ path: "root", operation: "multiply", inputs: ["area_ha=2", "delta_stock=8.2127", "c_to_co2=3.6667"], value: "60.2200", unit: "tCO2e" }],
            },
          },
        }],
        aggregation: [{ id: "credit_tco2e", inputs: ["60.2200", "68.2000"], value: "128.4200" }],
        tong_so_quan_sat_trong_trace: 2,
        trace_bi_cat: false,
      },
      cach_dien_giai:
        "Đọc theo thứ tự: factors và source → calculation nodes của từng observation → " +
        "aggregation toàn kỳ. Giữ nguyên chuỗi số engine trả về; không tự tính lại hoặc làm tròn thêm.",
      ghi_chu:
        "Đây là vết của ƯỚC TÍNH MRV, không phải bằng chứng verification hay tín chỉ đã " +
        "phát hành. " + CANH_BAO_MAU,
    };
  },

  thanh_vien_va_phan_cong: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return { khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.` };
    return {
      du_an: FIXTURE_PROJECT,
      thanh_vien: [
        { user_id: "u-1", ho_ten: FIXTURE_USER, vai_tro: "chủ dự án", email: "cuong@example.test", so_viec_dang_mo: 0, viec_dang_mo: [] },
        { user_id: "u-2", ho_ten: "Trần Thị Bích", vai_tro: "đơn vị phát triển", email: "bich@example.test", so_viec_dang_mo: 2, viec_dang_mo: [
          { tieu_de: "Đo trữ lượng carbon nền trên 12 ô mẫu", trang_thai: "đang làm", han: "2026-09-30" },
          { tieu_de: "Thu thập chứng cứ rào cản đầu tư", trang_thai: "vướng", han: null },
        ] },
        { user_id: "u-3", ho_ten: "Lê Minh An", vai_tro: "người xem", email: "an@example.test", so_viec_dang_mo: 0, viec_dang_mo: [] },
      ],
      viec_chua_giao: ["Nhập baseline vào hệ thống"],
      da_doc_het_cong_viec: true,
      ghi_chu:
        "Danh tính lấy qua project_member_directory. Email chỉ được RPC trả cho owner; " +
        "null không có nghĩa là thành viên không có email. Chỉ developer được nhận việc.",
    };
  },

  tai_lieu_theo_buoc: (args) => {
    const name = matchProject(args.ten_du_an);
    if (!name)
      return { khong_tim_thay: `Không có dự án nào khớp "${args.ten_du_an}" trong số dự án của người hỏi.` };
    const raw = args.buoc;
    const wanted = raw === undefined || raw === null || raw === "" ? null : Math.trunc(Number(raw));
    if (wanted !== null && (!Number.isFinite(wanted) || wanted < 1 || wanted > 7))
      return { tham_so_sai: "buoc phải là số nguyên từ 1 đến 7." };
    const rows = BAY_BUOC.filter((stage) => wanted === null || stage.buoc === wanted).map((stage) => ({
      buoc: stage.buoc,
      ten_buoc: stage.ten,
      da_duyet: stage.da_duyet,
      tai_lieu: stage.buoc === 5
        ? [{ kind: "baseline", phien_ban: 1, ten_tep: "baseline-camau-v1.pdf", nop_luc: "2026-08-10T04:00:00.000Z", file_id: "file-baseline" }]
        : [],
    }));
    return {
      du_an: FIXTURE_PROJECT,
      theo_buoc: rows,
      checklist_bat_buoc_theo_db: [],
      ket_luan_ve_tai_lieu_thieu:
        "DB hiện không có checklist loại tài liệu bắt buộc theo từng bước và " +
        "approve_project_stage cũng không kiểm project_documents. Vì vậy công cụ chỉ " +
        "liệt kê cái đã nộp, không được suy diễn cái còn thiếu theo Standard.",
    };
  },

  liet_ke_standard: () => ({
    standard: [
      { ma: "GS", ten: "Gold Standard", so_methodology_nhin_thay: 2, so_methodology_mau: 2 },
      { ma: "VCS", ten: "Verra — Verified Carbon Standard (VCS)", so_methodology_nhin_thay: 2, so_methodology_mau: 2 },
    ],
    ghi_chu:
      "Đây chỉ là catalog record mà tài khoản hiện nhìn thấy trong DB, không phải danh " +
      "sách đầy đủ ngoài đời và không mô tả yêu cầu của Standard. " + CANH_BAO_MAU,
  }),
};

/**
 * Bản `execute` chạy trên fixture, giữ nguyên việc chặn theo vai trò như route thật —
 * nếu eval bỏ qua bước chặn đó thì ca "ranh giới vai trò" sẽ luôn đạt một cách giả tạo.
 */
export function createFixtureExecute(role: UserRole) {
  return async (call: ToolCall): Promise<Record<string, unknown>> => {
    if (!findTool(call.name, role))
      return { loi: `Vai trò của người dùng không được phép dùng công cụ ${call.name}.` };
    const handler = FIXTURE_RESULTS[call.name];
    if (!handler) return { loi: `Không có dữ liệu mẫu cho công cụ ${call.name}.` };
    return handler(call.args);
  };
}
