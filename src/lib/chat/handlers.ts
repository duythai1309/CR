import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Profile } from "@/lib/auth";
import { CURRENT_METHODOLOGY } from "@/lib/mrv/factors";
import { daysBetween, missingMrvInputs } from "@/lib/mrv/collect";
import type { StrawMethod } from "@/lib/mrv/types";
import {
  BATCH_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  SEASON_TYPE_LABEL,
  STRAW_LABEL,
} from "@/lib/labels";
import { MAX_ROWS_FOR_AGGREGATE, MAX_ROWS_PER_TOOL } from "./guards";

type Client = SupabaseClient<Database>;

export interface ToolContext {
  supabase: Client;
  profile: Profile;
}

type Args = Record<string, unknown>;

const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

/**
 * Chuỗi do model sinh ra đi thẳng vào bộ lọc của PostgREST. Với `.ilike()` thì
 * tham số được đóng gói an toàn, nhưng `.or()` nhận cả một biểu thức dạng chuỗi —
 * dấu phẩy và ngoặc trong đó sẽ bẻ cú pháp bộ lọc. Cắt sạch trước khi ghép.
 */
const safeFilterTerm = (s: string): string => s.replace(/[,()%*\\"']/g, " ").trim();

/**
 * Bỏ từ phân loại đứng đầu tên riêng trước khi đem đi tìm.
 *
 * Người hỏi nói "thửa Ruộng Bãi" hoặc "mùa vụ Vụ Xuân 2026" theo đúng lối nói tự
 * nhiên, và model chép nguyên cụm đó vào tham số. Tìm kiếm dùng `ilike '%...%'` nên
 * cụm thừa một chữ là không khớp gì cả — thửa tên "Ruộng Bãi" không bao giờ tìm ra
 * bằng chuỗi "Thửa Ruộng Bãi". Eval bắt được đúng ca này.
 *
 * Chỉ cắt từ đứng ĐẦU, và cố ý KHÔNG cắt cụm "thửa ruộng": mọi tên thửa trong hệ
 * thống đều bắt đầu bằng "Ruộng" ("Ruộng Bãi", "Ruộng Đồng Trên"), nên cắt cả cụm
 * sẽ ăn mất một phần tên thật. Bỏ mỗi chữ "thửa" là đủ: "thửa ruộng Đồng Trên"
 * thành "ruộng Đồng Trên", vẫn khớp bằng `ilike`.
 */
const CLASSIFIER = /^(thửa|mùa\s+vụ|lô\s+tín\s+chỉ|nông\s+hộ|hộ)\s+/i;

export function tenRieng(raw: string): string {
  let s = raw.trim();
  // Lặp vì người ta hay nói chồng: "thửa ruộng Ruộng Bãi".
  for (let i = 0; i < 2 && CLASSIFIER.test(s); i++) s = s.replace(CLASSIFIER, "").trim();
  return s || raw.trim();
}

const num = (v: unknown): number => Number(v ?? 0);
const round = (n: number, digits = 3): number => Number(n.toFixed(digits));

/** Quan hệ một-một qua PostgREST trả về object; một-nhiều trả về mảng. */
const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const many = <T>(v: T[] | null | undefined): T[] => v ?? [];

function fail(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message);
}

async function resolveSeason(supabase: Client, name: string | null) {
  let q = supabase
    .from("seasons")
    .select("id, name, season_type, start_date, end_date, is_locked")
    .order("start_date", { ascending: false })
    .limit(1);
  if (name) q = q.ilike("name", `%${safeFilterTerm(tenRieng(name))}%`);
  const { data, error } = await q;
  fail(error);
  return data?.[0] ?? null;
}

const seasonLabel = (t: string | null) =>
  t ? (SEASON_TYPE_LABEL[t as keyof typeof SEASON_TYPE_LABEL] ?? t) : null;

const strawLabel = (m: string | null) =>
  m ? (STRAW_LABEL[m as keyof typeof STRAW_LABEL] ?? m) : null;

/**
 * Cửa ép kiểu DUY NHẤT của tệp này cho các bảng nền tảng dự án.
 *
 * `src/types/database.ts` sinh từ cơ sở dữ liệu thật và chưa thể sinh lại (mục C9 trong
 * `docs/design/schema-review-findings.md`: phải áp 0013–0015 lên DB trước, mà việc đó
 * chưa được phép). Truy vấn vẫn chạy bằng phiên của người dùng nên RLS là thứ quyết định
 * thấy gì — ép kiểu ở đây chỉ mất kiểm tra tên cột lúc biên dịch, không mở thêm quyền.
 */
const projectTables = (supabase: Client): SupabaseClient =>
  supabase as unknown as SupabaseClient;

interface ProjectRow {
  id: string;
  name: string;
  description?: string;
  deleted_at: string | null;
  standard_id: string | null;
  methodology_id: string | null;
  standard_locked_at?: string | null;
  methodology_locked_at?: string | null;
  updated_at?: string;
}
interface MemberRow {
  project_id: string;
  user_id: string;
  role: string;
}
interface StageCountRow {
  project_id: string;
  approved_at: string | null;
}
interface StageDetailRow {
  ordinal: number;
  title: string;
  approved_at: string | null;
}
interface MethodologyRow {
  id: string;
  code: string;
  version: string;
  is_sample: boolean;
}
interface PeriodRow {
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  version: number;
  data_revision: number;
}
interface ReportRow {
  version: number;
  status: string;
  generated_at: string;
  results?: { estimated_credit?: { value?: string; unit?: string } };
}

/** Nhãn tiếng Việt cho vai trò trong dự án; trợ lý nói với người dùng, không nói mã. */
const PROJECT_ROLE_VI: Record<string, string> = {
  owner: "chủ dự án",
  developer: "đơn vị phát triển",
  viewer: "người xem",
};

export const HANDLERS: Record<string, (ctx: ToolContext, args: Args) => Promise<unknown>> = {
  async tra_cuu_he_so({ supabase }, args) {
    const keyword = str(args.tu_khoa);
    let q = supabase
      .from("emission_factors")
      .select("key, value, unit, description, source")
      .eq("version", CURRENT_METHODOLOGY)
      .order("key")
      .limit(MAX_ROWS_PER_TOOL);
    if (keyword) q = q.ilike("key", `%${safeFilterTerm(keyword)}%`);

    const { data, error } = await q;
    fail(error);
    return {
      bo_he_so: CURRENT_METHODOLOGY,
      ghi_chu: "Đây là con số đang dùng thật trong hệ thống. Trích dẫn kèm trường 'source'.",
      he_so: data ?? [],
    };
  },

  async liet_ke_mua_vu({ supabase }) {
    const { data, error } = await supabase
      .from("seasons")
      .select("name, season_type, start_date, end_date, is_locked, field_seasons(count)")
      .order("start_date", { ascending: false })
      .limit(MAX_ROWS_PER_TOOL);
    fail(error);

    return {
      mua_vu: (data ?? []).map((s) => ({
        ten: s.name,
        loai_vu: seasonLabel(s.season_type),
        ngay_bat_dau: s.start_date,
        ngay_ket_thuc: s.end_date,
        da_khoa: s.is_locked,
        so_thua_dang_ky: one(s.field_seasons as unknown as { count: number }[])?.count ?? 0,
      })),
    };
  },

  async tong_ket_mua_vu({ supabase }, args) {
    const season = await resolveSeason(supabase, str(args.ten_mua_vu));
    if (!season) return { khong_tim_thay: "Không có mùa vụ nào khớp." };

    const { data, error } = await supabase
      .from("field_seasons")
      .select("id, fields ( area_ha ), emission_calculations ( reduction_co2e_t, is_current )")
      .eq("season_id", season.id)
      .limit(MAX_ROWS_FOR_AGGREGATE);
    fail(error);

    const rows = data ?? [];
    let dienTich = 0;
    let daTinh = 0;
    let tongGiam = 0;

    for (const r of rows) {
      dienTich += num(one(r.fields)?.area_ha);
      const current = many(r.emission_calculations).find((c) => c.is_current);
      if (current) {
        daTinh += 1;
        tongGiam += num(current.reduction_co2e_t);
      }
    }

    return {
      mua_vu: season.name,
      loai_vu: seasonLabel(season.season_type),
      da_khoa: season.is_locked,
      so_thua_dang_ky: rows.length,
      so_thua_da_tinh_mrv: daTinh,
      so_thua_chua_tinh_mrv: rows.length - daTinh,
      tong_dien_tich_ha: round(dienTich, 4),
      tong_giam_phat_thai_tco2e: round(tongGiam),
      ghi_chu:
        "Tổng chỉ cộng các thửa đã có bản tính đang hiệu lực; thửa chưa tính không được ước lượng.",
    };
  },

  async thua_thieu_nhat_ky({ supabase }, args) {
    const seasonName = str(args.ten_mua_vu);
    const season = seasonName ? await resolveSeason(supabase, seasonName) : null;
    if (seasonName && !season) return { khong_tim_thay: "Không có mùa vụ nào khớp." };

    let q = supabase
      .from("field_seasons")
      .select(
        `id, transplant_date, harvest_date,
         fields ( name, area_ha, declared_area_ha, farmers ( full_name ) ),
         seasons ( name, season_type ),
         cooperatives ( region ),
         straw_management ( method, baseline_method, amount_t_per_ha ),
         emission_calculations ( is_current )`,
      )
      .limit(MAX_ROWS_FOR_AGGREGATE);
    if (season) q = q.eq("season_id", season.id);

    const { data, error } = await q;
    fail(error);

    const chuaXong = (data ?? [])
      .filter((r) => !many(r.emission_calculations).some((c) => c.is_current))
      .map((r) => {
        const field = one(r.fields);
        const straw = one(r.straw_management);
        return {
          thua: field?.name ?? "—",
          nong_ho: one(field?.farmers)?.full_name ?? "—",
          mua_vu: one(r.seasons)?.name ?? "—",
          con_thieu: missingMrvInputs({
            areaHa: field?.area_ha ?? field?.declared_area_ha ?? null,
            transplantDate: r.transplant_date,
            harvestDate: r.harvest_date,
            strawMethod: (straw?.method as StrawMethod) ?? null,
            baselineStrawMethod: (straw?.baseline_method as StrawMethod) ?? null,
            strawTonnesPerHa: straw ? num(straw.amount_t_per_ha) : null,
            region: one(r.cooperatives)?.region ?? null,
            seasonType: one(r.seasons)?.season_type ?? null,
          }),
        };
      });

    return {
      so_thua_chua_tinh_duoc: chuaXong.length,
      danh_sach: chuaXong.slice(0, MAX_ROWS_PER_TOOL),
      ghi_chu:
        chuaXong.length > MAX_ROWS_PER_TOOL
          ? `Còn ${chuaXong.length - MAX_ROWS_PER_TOOL} thửa nữa không liệt kê hết ở đây.`
          : "Thửa có 'con_thieu' rỗng nghĩa là đủ dữ liệu, chỉ chưa bấm tính MRV.",
    };
  },

  async chi_tiet_thua_vu({ supabase }, args) {
    const fieldName = str(args.ten_thua);
    if (!fieldName) return { thieu_tham_so: "Cần cho biết tên thửa ruộng." };

    const { data, error } = await supabase
      .from("field_seasons")
      .select(
        `transplant_date, harvest_date, preseason_water, baseline_water_regime, is_locked,
         fields!inner ( name, area_ha, declared_area_ha, farmers ( full_name ) ),
         seasons ( name, season_type, start_date ),
         water_events ( event_date, event_type ),
         fertilizer_applications ( applied_date, product_name, amount_kg, n_content_pct, is_organic, organic_type ),
         straw_management ( method, baseline_method, amount_t_per_ha ),
         emission_calculations ( reduction_co2e_t, baseline_co2e_t, project_co2e_t, area_ha,
                                 cultivation_days, methodology_version, computed_at, is_current )`,
      )
      .ilike("fields.name", `%${safeFilterTerm(tenRieng(fieldName))}%`)
      .limit(10);
    fail(error);

    const seasonName = str(args.ten_mua_vu);
    const seasonTerm = seasonName ? tenRieng(seasonName).toLowerCase() : null;
    const candidates = (data ?? []).filter((r) =>
      seasonTerm ? (one(r.seasons)?.name ?? "").toLowerCase().includes(seasonTerm) : true,
    );
    if (candidates.length === 0) return { khong_tim_thay: "Không có thửa-vụ nào khớp." };

    // Nhiều vụ cùng khớp thì lấy vụ mới nhất; người hỏi thường quan tâm vụ đang làm.
    const r = candidates.sort((a, b) =>
      (one(b.seasons)?.start_date ?? "").localeCompare(one(a.seasons)?.start_date ?? ""),
    )[0];

    const field = one(r.fields);
    const straw = one(r.straw_management);
    const water = many(r.water_events);
    const fert = many(r.fertilizer_applications);
    const calc = many(r.emission_calculations).find((c) => c.is_current) ?? null;
    const drainageCount = water.filter((e) => e.event_type === "drainage").length;

    return {
      thua: field?.name,
      nong_ho: one(field?.farmers)?.full_name,
      mua_vu: one(r.seasons)?.name,
      loai_vu: seasonLabel(one(r.seasons)?.season_type ?? null),
      dien_tich_do_tu_ranh_ha: field?.area_ha,
      dien_tich_ho_khai_ha: field?.declared_area_ha,
      ngay_cay: r.transplant_date,
      ngay_thu_hoach: r.harvest_date,
      so_ngay_canh_tac: daysBetween(r.transplant_date, r.harvest_date),
      da_khoa_do_gop_lo: r.is_locked,
      so_lan_thao_nuoc: drainageCount,
      nhat_ky_nuoc: water.map((e) => ({
        ngay: e.event_date,
        viec: e.event_type === "drainage" ? "Tháo nước" : "Cho nước vào lại",
      })),
      tong_dam_kg: round(
        fert.reduce((s, a) => s + (num(a.amount_kg) * num(a.n_content_pct)) / 100, 0),
        2,
      ),
      so_lan_bon_phan: fert.length,
      xu_ly_rom_ra: strawLabel(straw?.method ?? null),
      rom_ra_kich_ban_nen: strawLabel(straw?.baseline_method ?? null),
      rom_ra_tan_tren_ha: straw?.amount_t_per_ha ?? null,
      ket_qua_tinh: calc
        ? {
            giam_phat_thai_tco2e: calc.reduction_co2e_t,
            kich_ban_nen_tco2e: calc.baseline_co2e_t,
            kich_ban_du_an_tco2e: calc.project_co2e_t,
            phien_ban_phuong_phap: calc.methodology_version,
            tinh_luc: calc.computed_at,
          }
        : null,
      ghi_chu: calc
        ? null
        : "Thửa-vụ này chưa có bản tính đang hiệu lực. Tuyệt đối không tự tính thay.",
    };
  },

  async liet_ke_nong_ho({ supabase }, args) {
    const keyword = str(args.tu_khoa);
    let q = supabase
      .from("farmers")
      .select("full_name, village, member_code, fields ( area_ha )")
      .order("full_name")
      .limit(MAX_ROWS_PER_TOOL);
    if (keyword) {
      const term = safeFilterTerm(keyword);
      if (term) q = q.or(`full_name.ilike.%${term}%,village.ilike.%${term}%`);
    }

    const { data, error } = await q;
    fail(error);

    return {
      nong_ho: (data ?? []).map((f) => ({
        ho_ten: f.full_name,
        thon_xom: f.village,
        ma_xa_vien: f.member_code,
        so_thua: many(f.fields).length,
        tong_dien_tich_ha: round(
          many(f.fields).reduce((s, x) => s + num(x.area_ha), 0),
          4,
        ),
      })),
    };
  },

  async liet_ke_lo_tin_chi({ supabase }, args) {
    const status = str(args.trang_thai);
    let q = supabase
      .from("credit_batches")
      .select(
        `code, name, status, gross_co2e_t, buffer_pct, issuable_co2e_t, sold_co2e_t,
         price_per_t_vnd, listed_at, cooperatives ( name ), seasons ( name )`,
      )
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS_PER_TOOL);
    if (status) q = q.eq("status", status as Database["public"]["Enums"]["batch_status"]);

    const { data, error } = await q;
    fail(error);

    return {
      lo_tin_chi: (data ?? []).map((b) => ({
        ma: b.code,
        ten: b.name,
        hop_tac_xa: one(b.cooperatives)?.name,
        mua_vu: one(b.seasons)?.name,
        trang_thai: BATCH_STATUS_LABEL[b.status],
        tong_gop_tco2e: b.gross_co2e_t,
        dem_rui_ro_pct: b.buffer_pct,
        phat_hanh_tco2e: b.issuable_co2e_t,
        da_ban_tco2e: b.sold_co2e_t,
        con_lai_tco2e: round(num(b.issuable_co2e_t) - num(b.sold_co2e_t)),
        gia_moi_tan_vnd: b.price_per_t_vnd,
      })),
    };
  },

  async chia_doanh_thu({ supabase }, args) {
    const code = str(args.ma_lo);
    if (!code) return { thieu_tham_so: "Cần cho biết mã lô tín chỉ." };

    const { data: batch, error: batchError } = await supabase
      .from("credit_batches")
      .select("id, code, name, status, platform_fee_pct, coop_admin_fee_pct")
      .ilike("code", safeFilterTerm(code))
      .maybeSingle();
    fail(batchError);
    if (!batch) return { khong_tim_thay: `Không có lô nào mã ${code}.` };

    const { data: orders, error } = await supabase
      .from("orders")
      .select(
        `code, quantity_co2e_t, total_vnd, status,
         revenue_shares ( platform_amount_vnd, cooperative_amount_vnd, farmer_amount_vnd, breakdown )`,
      )
      .eq("batch_id", batch.id)
      .limit(MAX_ROWS_PER_TOOL);
    fail(error);

    const settled = (orders ?? []).filter((o) => one(o.revenue_shares));

    return {
      lo: { ma: batch.code, ten: batch.name, trang_thai: BATCH_STATUS_LABEL[batch.status] },
      ty_le: {
        phi_nen_tang_pct: batch.platform_fee_pct,
        phi_quan_ly_htx_pct: batch.coop_admin_fee_pct,
        nong_ho_pct: round(100 - num(batch.platform_fee_pct) - num(batch.coop_admin_fee_pct), 2),
      },
      don_da_chia: settled.map((o) => {
        const s = one(o.revenue_shares)!;
        return {
          ma_don: o.code,
          khoi_luong_tco2e: o.quantity_co2e_t,
          thanh_tien_vnd: o.total_vnd,
          trang_thai: ORDER_STATUS_LABEL[o.status],
          nen_tang_vnd: s.platform_amount_vnd,
          hop_tac_xa_vnd: s.cooperative_amount_vnd,
          nong_ho_vnd: s.farmer_amount_vnd,
          chi_tiet_tung_ho: s.breakdown,
        };
      }),
      ghi_chu:
        settled.length === 0
          ? "Lô này chưa có đơn nào thanh toán xong nên chưa có bảng chia."
          : null,
    };
  },

  async lo_dang_chao_ban({ supabase }) {
    const { data, error } = await supabase
      .from("credit_batches")
      .select(
        `code, name, description, issuable_co2e_t, sold_co2e_t, price_per_t_vnd, listed_at,
         cooperatives ( name, province )`,
      )
      .eq("status", "listed")
      .order("listed_at", { ascending: false })
      .limit(MAX_ROWS_PER_TOOL);
    fail(error);

    return {
      lo_dang_chao_ban: (data ?? []).map((b) => ({
        ma: b.code,
        ten: b.name,
        mo_ta: b.description,
        hop_tac_xa: one(b.cooperatives)?.name,
        tinh: one(b.cooperatives)?.province,
        con_lai_tco2e: round(num(b.issuable_co2e_t) - num(b.sold_co2e_t)),
        gia_moi_tan_vnd: b.price_per_t_vnd,
      })),
      ghi_chu:
        "'con_lai_tco2e' đã trừ phần đã bán, nhưng đơn đang chờ thanh toán cũng giữ chỗ, " +
        "nên số thực đặt được có thể thấp hơn.",
    };
  },

  /* ---------------------------------------------------------- nền tảng dự án */

  async liet_ke_du_an({ supabase, profile }) {
    const db = projectTables(supabase);

    // RLS `projects_read` (0013:887) chỉ trả dự án mà người hỏi là thành viên, nên không
    // cần và không được lọc thêm theo vai trò toàn cục ở đây.
    const { data: projects, error } = await db
      .from("projects")
      .select("id, name, description, deleted_at, standard_id, methodology_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(MAX_ROWS_PER_TOOL);
    fail(error);

    const rows = (projects ?? []) as ProjectRow[];
    if (rows.length === 0)
      return { du_an: [], ghi_chu: "Người hỏi chưa là thành viên của dự án carbon nào." };

    const [{ data: members }, { data: stages }, { data: standards }, { data: methodologies }] =
      await Promise.all([
        db.from("project_members").select("project_id, user_id, role"),
        db.from("project_stages").select("project_id, approved_at"),
        db.from("standards").select("id, code"),
        db.from("methodologies").select("id, code, version, is_sample"),
      ]);

    const myRole = new Map<string, string>();
    for (const m of (members ?? []) as MemberRow[])
      if (m.user_id === profile.id) myRole.set(m.project_id, m.role);

    const approved = new Map<string, number>();
    for (const st of (stages ?? []) as StageCountRow[])
      if (st.approved_at) approved.set(st.project_id, (approved.get(st.project_id) ?? 0) + 1);

    const standardCode = new Map<string, string>(
      ((standards ?? []) as Array<{ id: string; code: string }>).map((x) => [x.id, x.code]),
    );
    const methodology = new Map<string, { ma: string; la_du_lieu_mau: boolean }>(
      ((methodologies ?? []) as MethodologyRow[]).map((x) => [
        x.id,
        { ma: `${x.code} · ${x.version}`, la_du_lieu_mau: x.is_sample },
      ]),
    );

    return {
      du_an: rows.map((p) => ({
        ten: p.name,
        mo_ta: p.description || null,
        vai_tro_trong_du_an: PROJECT_ROLE_VI[myRole.get(p.id) ?? ""] ?? myRole.get(p.id) ?? "—",
        buoc_da_duyet: `${approved.get(p.id) ?? 0}/7`,
        standard: p.standard_id ? (standardCode.get(p.standard_id) ?? null) : null,
        methodology: p.methodology_id ? (methodology.get(p.methodology_id)?.ma ?? null) : null,
        methodology_la_du_lieu_mau: p.methodology_id
          ? (methodology.get(p.methodology_id)?.la_du_lieu_mau ?? null)
          : null,
        da_xoa: p.deleted_at !== null,
      })),
      ghi_chu:
        "'buoc_da_duyet' đếm trên bảy bước thiết kế cố định. Methodology đánh dấu " +
        "'methodology_la_du_lieu_mau' là dữ liệu mẫu chưa thẩm định — mọi con số tính từ " +
        "nó chỉ là ước tính, không phải tín chỉ đã phát hành.",
    };
  },

  async tien_do_du_an({ supabase, profile }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);

    let q = db
      .from("projects")
      .select("id, name, standard_id, methodology_id, standard_locked_at, methodology_locked_at, deleted_at")
      .order("updated_at", { ascending: false })
      .limit(5);
    if (name) q = q.ilike("name", `%${safeFilterTerm(tenRieng(name))}%`);

    const { data, error } = await q;
    fail(error);

    const project = ((data ?? []) as ProjectRow[])[0];
    if (!project)
      return {
        khong_tim_thay: name
          ? `Không có dự án nào khớp "${name}" trong số dự án của người hỏi.`
          : "Người hỏi chưa là thành viên của dự án carbon nào.",
      };

    const [{ data: stages }, { data: tasks }, { data: periods }, { data: reports }, { data: members }] =
      await Promise.all([
        db.from("project_stages").select("ordinal, title, approved_at").eq("project_id", project.id),
        db.from("project_tasks").select("status, stage_id").eq("project_id", project.id).limit(MAX_ROWS_FOR_AGGREGATE),
        db
          .from("monitoring_periods")
          .select("id, name, start_date, end_date, status, version, data_revision")
          .eq("project_id", project.id)
          .order("start_date", { ascending: false })
          .limit(MAX_ROWS_PER_TOOL),
        db
          .from("mrv_reports")
          .select("version, status, results, generated_at")
          .eq("project_id", project.id)
          .order("generated_at", { ascending: false })
          .limit(1),
        db.from("project_members").select("user_id, role").eq("project_id", project.id),
      ]);

    const byStatus: Record<string, number> = {};
    for (const t of (tasks ?? []) as Array<{ status: string }>)
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

    const myRole =
      ((members ?? []) as MemberRow[]).find((m) => m.user_id === profile.id)?.role ?? null;

    const latest = ((reports ?? []) as ReportRow[])[0];
    const credit = latest?.results?.estimated_credit;

    return {
      du_an: project.name,
      vai_tro_cua_nguoi_hoi: myRole ? (PROJECT_ROLE_VI[myRole] ?? myRole) : null,
      da_xoa: project.deleted_at !== null,
      standard_da_khoa: project.standard_locked_at !== null,
      methodology_da_khoa: project.methodology_locked_at !== null,
      bay_buoc: ((stages ?? []) as StageDetailRow[])
        .slice()
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((st) => ({ buoc: st.ordinal, ten: st.title, da_duyet: st.approved_at !== null })),
      cong_viec: {
        tong: (tasks ?? []).length,
        chua_lam: byStatus.todo ?? 0,
        dang_lam: byStatus.in_progress ?? 0,
        xong: byStatus.done ?? 0,
        vuong: byStatus.blocked ?? 0,
      },
      ky_giam_sat: ((periods ?? []) as PeriodRow[]).map((pd) => ({
        ten: pd.name,
        tu_ngay: pd.start_date,
        den_ngay: pd.end_date,
        ban: pd.version,
        trang_thai: pd.status === "locked" ? "đã khoá" : "đang mở",
        so_lan_ghi: pd.data_revision,
      })),
      bao_cao_gan_nhat: latest
        ? {
            ban: latest.version,
            trang_thai: latest.status === "final" ? "chính thức" : "xem thử",
            uoc_tinh: credit?.value ?? null,
            don_vi: credit?.unit ?? null,
            sinh_luc: latest.generated_at,
          }
        : null,
      ghi_chu:
        "Con số ở 'bao_cao_gan_nhat' là ƯỚC TÍNH theo phương pháp luận đã chọn, chưa qua " +
        "thẩm định độc lập và không phải tín chỉ đã được phát hành.",
    };
  },

  async don_hang_cua_toi({ supabase, profile }) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `code, quantity_co2e_t, unit_price_vnd, total_vnd, status, created_at,
         credit_batches ( code, name ),
         payments ( status, amount_vnd, paid_at, failure_reason )`,
      )
      .eq("buyer_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS_PER_TOOL);
    fail(error);

    return {
      don_hang: (data ?? []).map((o) => ({
        ma_don: o.code,
        lo: one(o.credit_batches)?.code,
        ten_lo: one(o.credit_batches)?.name,
        khoi_luong_tco2e: o.quantity_co2e_t,
        don_gia_vnd: o.unit_price_vnd,
        thanh_tien_vnd: o.total_vnd,
        trang_thai_don: ORDER_STATUS_LABEL[o.status],
        dat_luc: o.created_at,
        thanh_toan: many(o.payments).map((p) => ({
          trang_thai: PAYMENT_STATUS_LABEL[p.status],
          so_tien_vnd: p.amount_vnd,
          thanh_toan_luc: p.paid_at,
          ly_do_that_bai: p.failure_reason,
        })),
      })),
    };
  },
};
