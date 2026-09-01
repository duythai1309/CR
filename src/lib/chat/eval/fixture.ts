import type { UserRole } from "@/lib/auth";
import type { ToolCall } from "../provider";
import { findTool } from "../tools";

/**
 * Hợp tác xã giả lập dùng cho eval.
 *
 * Eval phải TẤT ĐỊNH: cùng một câu hỏi, chạy hôm nay và chạy tuần sau phải ra cùng
 * một con số, nếu không thì mọi phép so sánh giữa hai phiên bản prompt đều vô nghĩa.
 * Dữ liệu thật thay đổi từng ngày nên không dùng được.
 *
 * Lý do thứ hai quan trọng không kém: eval platform là một hệ thống riêng: chạy eval
 * trên dữ liệu thật đồng nghĩa với việc đẩy tên và số liệu của nông hộ sang đó.
 *
 * Các con số dưới đây khớp nhau theo đúng quy tắc nghiệp vụ (đệm rủi ro 15%, phí nền
 * tảng 12%, phí HTX 8%), để ca eval "không được bịa số" có căn cứ đối chiếu thật.
 */

export const FIXTURE_COOP = "HTX Nông nghiệp Tân Phú";
export const FIXTURE_USER = "Nguyễn Văn Cường";

const HE_SO = [
  {
    key: "ef_c_north_early",
    value: 2.21,
    unit: "kg CH4/ha/ngày",
    description: "Hệ số phát thải nền, miền Bắc, vụ đầu năm",
    source: "Vo et al. 2020, Climate 8(6):74",
  },
  {
    key: "ef_c_north_late",
    value: 3.89,
    unit: "kg CH4/ha/ngày",
    description: "Hệ số phát thải nền, miền Bắc, vụ cuối năm",
    source: "Vo et al. 2020, Climate 8(6):74",
  },
  {
    key: "sfw_continuously_flooded",
    value: 1.0,
    unit: "—",
    description: "Hệ số chế độ nước: ngập liên tục",
    source: "IPCC 2019 Refinement, Vol.4 Ch.5.5, Table 5.12",
  },
  {
    key: "sfw_single_aeration",
    value: 0.71,
    unit: "—",
    description: "Hệ số chế độ nước: rút nước một lần",
    source: "IPCC 2019 Refinement, Vol.4 Ch.5.5, Table 5.12",
  },
  {
    key: "sfw_multiple_aeration",
    value: 0.55,
    unit: "—",
    description: "Hệ số chế độ nước: rút nước nhiều lần (AWD)",
    source: "IPCC 2019 Refinement, Vol.4 Ch.5.5, Table 5.12",
  },
  {
    key: "gwp_ch4",
    value: 28,
    unit: "—",
    description: "Tiềm năng nóng lên toàn cầu của CH4 trong 100 năm",
    source: "IPCC AR5",
  },
  {
    key: "gwp_n2o",
    value: 265,
    unit: "—",
    description: "Tiềm năng nóng lên toàn cầu của N2O trong 100 năm",
    source: "IPCC AR5",
  },
];

const THUA_DA_TINH = {
  thua: "Ruộng Đồng Trên",
  nong_ho: "Nguyễn Văn A",
  mua_vu: "Vụ Xuân 2026",
  loai_vu: "Vụ Xuân (vụ đầu năm)",
  dien_tich_do_tu_ranh_ha: 1.25,
  dien_tich_ho_khai_ha: 1.3,
  ngay_cay: "2026-02-05",
  ngay_thu_hoach: "2026-06-10",
  so_ngay_canh_tac: 125,
  da_khoa_do_gop_lo: true,
  so_lan_thao_nuoc: 2,
  nhat_ky_nuoc: [
    { ngay: "2026-03-12", viec: "Tháo nước" },
    { ngay: "2026-03-19", viec: "Cho nước vào lại" },
    { ngay: "2026-04-20", viec: "Tháo nước" },
    { ngay: "2026-04-27", viec: "Cho nước vào lại" },
  ],
  tong_dam_kg: 63.0,
  so_lan_bon_phan: 3,
  xu_ly_rom_ra: "Mang khỏi ruộng (bán, làm nấm, làm thức ăn)",
  rom_ra_kich_ban_nen: "Đốt ngoài đồng",
  rom_ra_tan_tren_ha: 4.2,
  ket_qua_tinh: {
    giam_phat_thai_tco2e: 7.812,
    kich_ban_nen_tco2e: 18.94,
    kich_ban_du_an_tco2e: 11.128,
    phien_ban_phuong_phap: "IPCC2019-VN-TIER2-1.0",
    tinh_luc: "2026-06-18T09:12:00+07:00",
  },
  ghi_chu: null,
};

const THUA_CHUA_TINH = {
  thua: "Ruộng Bãi",
  nong_ho: "Trần Thị B",
  mua_vu: "Vụ Xuân 2026",
  loai_vu: "Vụ Xuân (vụ đầu năm)",
  dien_tich_do_tu_ranh_ha: 2.1,
  dien_tich_ho_khai_ha: 2.0,
  ngay_cay: "2026-02-08",
  ngay_thu_hoach: null,
  so_ngay_canh_tac: null,
  da_khoa_do_gop_lo: false,
  so_lan_thao_nuoc: 1,
  nhat_ky_nuoc: [{ ngay: "2026-03-15", viec: "Tháo nước" }],
  tong_dam_kg: 88.2,
  so_lan_bon_phan: 2,
  xu_ly_rom_ra: null,
  rom_ra_kich_ban_nen: null,
  rom_ra_tan_tren_ha: null,
  ket_qua_tinh: null,
  ghi_chu:
    "Thửa-vụ này chưa có bản tính đang hiệu lực. Tuyệt đối không tự tính thay.",
};

/**
 * Kết quả cố định của từng công cụ. Khoá của object này phải phủ đúng bộ công cụ
 * trong `tools.ts` — có kiểm thử canh việc đó, để thêm công cụ mới mà quên fixture
 * thì bộ test đỏ chứ không phải tới lúc chạy eval mới lộ.
 */
export const FIXTURE_RESULTS: Record<
  string,
  (args: Record<string, unknown>) => Record<string, unknown>
> = {
  tra_cuu_he_so: (args) => {
    const keyword = typeof args.tu_khoa === "string" ? args.tu_khoa.trim().toLowerCase() : "";
    return {
      bo_he_so: "IPCC2019-VN-TIER2-1.0",
      ghi_chu:
        "Đây là con số đang dùng thật trong hệ thống. Trích dẫn kèm trường 'source'.",
      he_so: keyword ? HE_SO.filter((f) => f.key.includes(keyword)) : HE_SO,
    };
  },

  liet_ke_mua_vu: () => ({
    mua_vu: [
      {
        ten: "Vụ Xuân 2026",
        loai_vu: "Vụ Xuân (vụ đầu năm)",
        ngay_bat_dau: "2026-02-01",
        ngay_ket_thuc: "2026-06-30",
        da_khoa: false,
        so_thua_dang_ky: 3,
      },
      {
        ten: "Vụ Mùa 2025",
        loai_vu: "Vụ Mùa (vụ cuối năm)",
        ngay_bat_dau: "2025-06-15",
        ngay_ket_thuc: "2025-10-20",
        da_khoa: true,
        so_thua_dang_ky: 2,
      },
    ],
  }),

  tong_ket_mua_vu: (args) => {
    const name = typeof args.ten_mua_vu === "string" ? args.ten_mua_vu.toLowerCase() : "";
    if (name.includes("mùa") || name.includes("mua 2025") || name.includes("2025")) {
      return {
        mua_vu: "Vụ Mùa 2025",
        loai_vu: "Vụ Mùa (vụ cuối năm)",
        da_khoa: true,
        so_thua_dang_ky: 2,
        so_thua_da_tinh_mrv: 2,
        so_thua_chua_tinh_mrv: 0,
        tong_dien_tich_ha: 2.05,
        tong_giam_phat_thai_tco2e: 9.204,
        ghi_chu:
          "Tổng chỉ cộng các thửa đã có bản tính đang hiệu lực; thửa chưa tính không được ước lượng.",
      };
    }
    return {
      mua_vu: "Vụ Xuân 2026",
      loai_vu: "Vụ Xuân (vụ đầu năm)",
      da_khoa: false,
      so_thua_dang_ky: 3,
      so_thua_da_tinh_mrv: 2,
      so_thua_chua_tinh_mrv: 1,
      tong_dien_tich_ha: 4.15,
      tong_giam_phat_thai_tco2e: 12.436,
      ghi_chu:
        "Tổng chỉ cộng các thửa đã có bản tính đang hiệu lực; thửa chưa tính không được ước lượng.",
    };
  },

  thua_thieu_nhat_ky: () => ({
    so_thua_chua_tinh_duoc: 1,
    danh_sach: [
      {
        thua: "Ruộng Bãi",
        nong_ho: "Trần Thị B",
        mua_vu: "Vụ Xuân 2026",
        con_thieu: ["Ngày thu hoạch", "Cách xử lý rơm rạ"],
      },
    ],
    ghi_chu: "Thửa có 'con_thieu' rỗng nghĩa là đủ dữ liệu, chỉ chưa bấm tính MRV.",
  }),

  chi_tiet_thua_vu: (args) => {
    const name = typeof args.ten_thua === "string" ? args.ten_thua.toLowerCase() : "";
    if (name.includes("bãi") || name.includes("bai")) return THUA_CHUA_TINH;
    if (name.includes("trên") || name.includes("tren") || name.includes("đồng"))
      return THUA_DA_TINH;
    return { khong_tim_thay: "Không có thửa-vụ nào khớp." };
  },

  liet_ke_nong_ho: () => ({
    nong_ho: [
      {
        ho_ten: "Nguyễn Văn A",
        thon_xom: "Thôn Đoài",
        ma_xa_vien: "XV-001",
        so_thua: 2,
        tong_dien_tich_ha: 2.05,
      },
      {
        ho_ten: "Trần Thị B",
        thon_xom: "Thôn Đông",
        ma_xa_vien: "XV-002",
        so_thua: 1,
        tong_dien_tich_ha: 2.1,
      },
    ],
  }),

  liet_ke_lo_tin_chi: () => ({
    lo_tin_chi: [
      {
        ma: "LTC-2026-01",
        ten: "Lô tín chỉ vụ Xuân 2026",
        hop_tac_xa: FIXTURE_COOP,
        mua_vu: "Vụ Xuân 2026",
        trang_thai: "Đang chào bán",
        tong_gop_tco2e: 12.436,
        dem_rui_ro_pct: 15,
        phat_hanh_tco2e: 10.571,
        da_ban_tco2e: 2.0,
        con_lai_tco2e: 8.571,
        gia_moi_tan_vnd: 320000,
      },
    ],
  }),

  chia_doanh_thu: (args) => {
    const code = typeof args.ma_lo === "string" ? args.ma_lo.toUpperCase() : "";
    if (code && !code.includes("LTC-2026-01"))
      return { khong_tim_thay: `Không có lô nào mã ${args.ma_lo}.` };
    return {
      lo: { ma: "LTC-2026-01", ten: "Lô tín chỉ vụ Xuân 2026", trang_thai: "Đang chào bán" },
      ty_le: { phi_nen_tang_pct: 12, phi_quan_ly_htx_pct: 8, nong_ho_pct: 80 },
      don_da_chia: [
        {
          ma_don: "DH-2026-004",
          khoi_luong_tco2e: 2.0,
          thanh_tien_vnd: 640000,
          trang_thai: "Đã thanh toán",
          nen_tang_vnd: 76800,
          hop_tac_xa_vnd: 51200,
          nong_ho_vnd: 512000,
          chi_tiet_tung_ho: {
            farmers: [
              { farmer_name: "Nguyễn Văn A", amount_vnd: 321536 },
              { farmer_name: "Trần Thị B", amount_vnd: 190464 },
            ],
          },
        },
      ],
      ghi_chu: null,
    };
  },

  lo_dang_chao_ban: () => ({
    lo_dang_chao_ban: [
      {
        ma: "LTC-2026-01",
        ten: "Lô tín chỉ vụ Xuân 2026",
        mo_ta: "Lúa nước giảm phát thải theo AWD, vụ Xuân 2026",
        hop_tac_xa: FIXTURE_COOP,
        tinh: "Hưng Yên",
        con_lai_tco2e: 8.571,
        gia_moi_tan_vnd: 320000,
      },
    ],
    ghi_chu:
      "'con_lai_tco2e' đã trừ phần đã bán, nhưng đơn đang chờ thanh toán cũng giữ chỗ, " +
      "nên số thực đặt được có thể thấp hơn.",
  }),

  don_hang_cua_toi: () => ({
    don_hang: [
      {
        ma_don: "DH-2026-004",
        lo: "LTC-2026-01",
        ten_lo: "Lô tín chỉ vụ Xuân 2026",
        khoi_luong_tco2e: 2.0,
        don_gia_vnd: 320000,
        thanh_tien_vnd: 640000,
        trang_thai_don: "Đã thanh toán",
        dat_luc: "2026-07-02T14:30:00+07:00",
        thanh_toan: [
          {
            trang_thai: "Thành công",
            so_tien_vnd: 640000,
            thanh_toan_luc: "2026-07-02T14:41:00+07:00",
            ly_do_that_bai: null,
          },
        ],
      },
    ],
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
