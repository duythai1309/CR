import { describe, expect, it } from "vitest";
import { HANDLERS } from "@/lib/chat/handlers";
import { TOOLS, findTool, toolsForRole } from "@/lib/chat/tools";
import { buildSystemPrompt, describePage } from "@/lib/chat/prompt";
import type { Profile } from "@/lib/auth";

/**
 * Công cụ trợ lý cho nền tảng dự án Carbon.
 *
 * `tests/chat.test.ts` chỉ canh `TOOLS` ↔ `FIXTURE_RESULTS`, nên một handler hỏng mà
 * `TOOLS` nguyên vẹn vẫn để bộ test xanh — rủi ro R11 trong `docs/audit/audit-keep.md`.
 * Vì vậy MỌI handler được gọi thật ở đây trên một client giả, thay vì tin vào màu xanh
 * của phép kiểm chẵn lẻ.
 */

/** Client giả: dựng lại đúng chuỗi gọi PostgREST mà handler dùng, và awaitable. */
function fakeDb(tables: Record<string, unknown[]>, calls: string[] = []) {
  type Filter = { kind: "eq" | "ilike"; col: string; value: string };

  const builder = (table: string) => {
    const filters: Filter[] = [];
    let head = false;
    let wantsCount = false;
    const chain: Record<string, unknown> = {
      select: (_columns?: string, options?: { count?: string; head?: boolean }) => {
        head = options?.head === true;
        wantsCount = options?.count === "exact";
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      eq: (col: string, value: unknown) => {
        filters.push({ kind: "eq", col, value: String(value) });
        return chain;
      },
      ilike: (col: string, pattern: string) => {
        filters.push({
          kind: "ilike",
          col,
          value: String(pattern).replace(/%/g, "").toLowerCase(),
        });
        return chain;
      },
      then: (
        resolve: (v: { data: unknown[] | null; error: null; count: number | null }) => unknown,
      ) => {
        calls.push(table);
        let rows = tables[table] ?? [];
        for (const f of filters)
          rows = rows.filter((r) => {
            const cell = (r as Record<string, unknown>)[f.col];
            return f.kind === "eq"
              ? String(cell) === f.value
              : String(cell ?? "")
                  .toLowerCase()
                  .includes(f.value);
          });
        return Promise.resolve(
          resolve({ data: head ? null : rows, error: null, count: wantsCount ? rows.length : null }),
        );
      },
    };
    return chain;
  };

  return {
    from: (table: string) => builder(table),
    // `project_member_directory` (0015_project_identity.sql) là đường duy nhất đọc được
    // tên thành viên: policy `profiles_select` không cho đọc hồ sơ người cùng dự án.
    async rpc(name: string) {
      calls.push(`rpc:${name}`);
      return { data: tables[`rpc:${name}`] ?? [], error: null };
    },
  };
}

const profile = { id: "u-1", full_name: "Người thử", role: "coop_staff" } as unknown as Profile;

/** Lược đồ hợp lệ theo `src/lib/methodology/schema.ts`; handler parse thật, không giả. */
const METRIC_SCHEMA = {
  schema_version: 1,
  fields: [
    {
      id: "baseline_stock_tc_ha",
      label: { vi: "Trữ lượng carbon nền" },
      type: "decimal",
      unit: "tC/ha",
      scope: "baseline",
      required: true,
      validation: { minimum: 0, scale: 4 },
    },
    {
      id: "area_ha",
      label: { vi: "Diện tích ô đo" },
      type: "decimal",
      unit: "ha",
      scope: "observation",
      required: true,
      import: { aliases: ["area_ha", "Diện tích ô đo"], accepted_units: ["ha"] },
    },
    {
      id: "loai_rung",
      label: { vi: "Loại rừng" },
      type: "enum",
      unit: "1",
      scope: "observation",
      required: false,
      options: [{ value: "ngap_man", label: { vi: "Ngập mặn" } }],
    },
  ],
  factor_requirements: [{ key: "c_to_co2", unit: "1", scope_selectors: [] }],
  calculations: [
    {
      id: "credit_tco2e",
      unit: "tCO2e",
      aggregation: "sum",
      expression: { op: "multiply", args: [{ field: "area_ha" }, { factor: "c_to_co2" }] },
    },
  ],
};

const CA_MAU = {
  id: "p-1",
  name: "Rừng ngập mặn Cà Mau",
  description: "Giai đoạn 1",
  deleted_at: null,
  standard_id: "s-1",
  methodology_id: "m-1",
  standard_locked_at: "2026-02-01T00:00:00Z",
  methodology_locked_at: "2026-02-02T00:00:00Z",
  baseline: {},
  baseline_revision: 0,
  updated_at: "2026-09-01T00:00:00Z",
};

const DONG_THAP = {
  id: "p-2",
  name: "Biogas Đồng Tháp",
  description: "",
  deleted_at: null,
  standard_id: null,
  methodology_id: null,
  standard_locked_at: null,
  methodology_locked_at: null,
  baseline: {},
  baseline_revision: 0,
  updated_at: "2026-08-01T00:00:00Z",
};

const DA_XOA = { ...CA_MAU, id: "p-9", name: "Rừng thử nghiệm cũ", deleted_at: "2026-05-01Z" };

const DATA: Record<string, unknown[]> = {
  // Thứ tự phản ánh `order("updated_at", desc)` — client giả không tự sắp.
  projects: [CA_MAU, DONG_THAP],
  project_members: [
    { project_id: "p-1", user_id: "u-1", role: "owner" },
    { project_id: "p-1", user_id: "u-2", role: "developer" },
    { project_id: "p-2", user_id: "u-1", role: "developer" },
  ],
  project_stages: [
    {
      id: "st-1",
      project_id: "p-1",
      ordinal: 1,
      title: "Project Idea",
      approved_at: "2026-03-01T00:00:00Z",
      approved_by: "u-2",
    },
    {
      id: "st-2",
      project_id: "p-1",
      ordinal: 2,
      title: "Feasibility Assessment",
      approved_at: "2026-03-02T00:00:00Z",
      approved_by: "u-1",
    },
    {
      id: "st-3",
      project_id: "p-1",
      ordinal: 3,
      title: "Chọn Standard",
      approved_at: null,
      approved_by: null,
    },
    {
      id: "st-4",
      project_id: "p-1",
      ordinal: 4,
      title: "Chọn Methodology",
      approved_at: null,
      approved_by: null,
    },
    {
      id: "st-5",
      project_id: "p-1",
      ordinal: 5,
      title: "Baseline",
      approved_at: null,
      approved_by: null,
    },
  ],
  standards: [
    { id: "s-1", code: "VCS", name: "Verra — Verified Carbon Standard (VCS)" },
    { id: "s-2", code: "GS", name: "Gold Standard" },
  ],
  methodologies: [
    {
      id: "m-1",
      standard_id: "s-1",
      code: "DEMO-VCS-FOREST",
      version: "demo-1.0",
      name: "MẪU VCS — thay đổi trữ lượng carbon rừng",
      project_type: "afolu",
      is_sample: true,
      professionally_validated: false,
      disclaimer: "DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN.",
      schema_hash: "hash-1",
      metric_schema: METRIC_SCHEMA,
    },
    {
      id: "m-2",
      standard_id: "s-2",
      code: "DEMO-GS-BIOGAS",
      version: "demo-1.0",
      name: "MẪU GS — biogas hộ gia đình",
      project_type: "biogas",
      is_sample: true,
      professionally_validated: false,
      disclaimer: "DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN.",
      schema_hash: "hash-2",
      metric_schema: METRIC_SCHEMA,
    },
  ],
  project_tasks: [
    {
      id: "t-1",
      project_id: "p-1",
      stage_id: "st-5",
      title: "Đo trữ lượng carbon nền",
      status: "in_progress",
      assignee_id: "u-2",
      due_at: "2999-01-01T00:00:00Z",
    },
    {
      id: "t-2",
      project_id: "p-1",
      stage_id: "st-5",
      title: "Nhập baseline vào hệ thống",
      status: "todo",
      assignee_id: null,
      due_at: "2020-01-01T00:00:00Z",
    },
    {
      id: "t-3",
      project_id: "p-1",
      stage_id: "st-1",
      title: "Viết mô tả ý tưởng",
      status: "done",
      assignee_id: "u-2",
      due_at: "2020-01-01T00:00:00Z",
    },
    {
      id: "t-4",
      project_id: "p-1",
      stage_id: "st-3",
      title: "Đối chiếu hai Standard",
      status: "blocked",
      assignee_id: null,
      due_at: null,
    },
  ],
  monitoring_periods: [
    {
      id: "k-1",
      project_id: "p-1",
      name: "Kỳ 2026-1",
      start_date: "2026-01-01",
      end_date: "2026-06-30",
      status: "locked",
      version: 1,
      data_revision: 3,
      schema_hash: "hash-1",
      schema_snapshot: METRIC_SCHEMA,
      locked_at: "2026-07-01T00:00:00Z",
    },
    {
      id: "k-2",
      project_id: "p-1",
      name: "Kỳ 2026-2",
      start_date: "2026-07-01",
      end_date: "2026-12-31",
      status: "open",
      version: 1,
      data_revision: 2,
      schema_hash: "hash-1",
      schema_snapshot: METRIC_SCHEMA,
      locked_at: null,
    },
  ],
  monitoring_data: [
    {
      id: "md-1",
      period_id: "k-1",
      record_key: "PLOT-01",
      observed_on: "2026-02-01",
      metric_values: { area_ha: "2", loai_rung: "ngap_man" },
      revision: 1,
      entered_by: "u-2",
      updated_at: "2026-02-01T08:00:00Z",
    },
    {
      id: "md-2",
      period_id: "k-2",
      record_key: "PLOT-02",
      observed_on: "2026-08-01",
      metric_values: { area_ha: "2.5", loai_rung: "ngap_man" },
      revision: 2,
      entered_by: "u-1",
      updated_at: "2026-08-01T08:00:00Z",
    },
  ],
  mrv_reports: [
    {
      id: "r-1",
      project_id: "p-1",
      period_id: "k-1",
      methodology_id: "m-1",
      standard_id: "s-1",
      version: 1,
      status: "preview",
      schema_hash: "hash-1",
      data_revision: 3,
      baseline_revision: 0,
      engine_version: "methodology-engine/1",
      generated_at: "2026-08-15T00:00:00Z",
      results: { estimated_credit: { value: "128.4200", unit: "tCO2e" } },
      calculation_trace: {
        order: ["credit_tco2e"],
        precision_digits: 28,
        rounding: "half_even",
        output_scale: 4,
        operations: 2,
        records: [
          {
            record_key: "PLOT-01",
            factors: [
              { key: "c_to_co2", value: "3.6667", unit: "1", source: "factor snapshot" },
            ],
            calculations: {
              credit_tco2e: {
                value: "128.4200",
                nodes: [{ path: "root", operation: "multiply", value: "128.4200" }],
              },
            },
          },
        ],
        aggregation: [{ id: "credit_tco2e", inputs: ["128.4200"], value: "128.4200" }],
      },
    },
  ],
  project_documents: [
    {
      id: "doc-1",
      project_id: "p-1",
      stage_id: "st-5",
      file_id: "file-1",
      kind: "baseline",
      version: 1,
      created_at: "2026-08-10T04:00:00Z",
    },
  ],
  project_files: [
    {
      id: "file-1",
      project_id: "p-1",
      original_name: "baseline-camau-v1.pdf",
      uploaded_by: "u-2",
      created_at: "2026-08-10T04:00:00Z",
    },
  ],
  "rpc:project_member_directory": [
    { user_id: "u-1", full_name: "Người thử", role: "owner", email: "owner@example.test" },
    { user_id: "u-2", full_name: "Trần Thị Bích", role: "developer", email: "dev@example.test" },
  ],
};

const ctx = (data: Record<string, unknown[]> = DATA, calls: string[] = []) =>
  ({ supabase: fakeDb(data, calls), profile }) as never;

/** Một bản dữ liệu khác, để kiểm ca "đã đủ điều kiện" mà không đụng bản gốc. */
const withOverrides = (overrides: Record<string, unknown[]>) => ({ ...DATA, ...overrides });

describe("liet_ke_du_an", () => {
  it("trả dự án kèm vai trò của chính người hỏi, không phải vai trò người khác", async () => {
    const out = (await HANDLERS.liet_ke_du_an(ctx(), {})) as {
      du_an: Array<Record<string, unknown>>;
    };
    expect(out.du_an).toHaveLength(2);
    expect(out.du_an[0]).toMatchObject({
      ten: "Rừng ngập mặn Cà Mau",
      vai_tro_trong_du_an: "chủ dự án",
      standard: "VCS",
      methodology: "DEMO-VCS-FOREST · demo-1.0",
      loai_hinh: "afolu",
      so_thanh_vien: 2,
    });
    expect(out.du_an[1].vai_tro_trong_du_an).toBe("đơn vị phát triển");
    expect(out.du_an[1].methodology).toBeNull();
  });

  it("đếm đúng số bước đã duyệt trên bảy", async () => {
    const out = (await HANDLERS.liet_ke_du_an(ctx(), {})) as {
      du_an: Array<{ buoc_da_duyet: string }>;
    };
    expect(out.du_an[0].buoc_da_duyet).toBe("2/7");
    expect(out.du_an[1].buoc_da_duyet).toBe("0/7");
  });

  it("đánh dấu methodology là dữ liệu mẫu — trợ lý phải nói được điều đó", async () => {
    const out = (await HANDLERS.liet_ke_du_an(ctx(), {})) as {
      du_an: Array<{ methodology_la_du_lieu_mau: boolean | null }>;
      ghi_chu: string;
    };
    expect(out.du_an[0].methodology_la_du_lieu_mau).toBe(true);
    expect(out.ghi_chu).toContain("MẪU");
    expect(out.ghi_chu).toContain("Verra");
  });

  it("không có dự án nào thì nói rõ, không trả mảng rỗng trần", async () => {
    const out = (await HANDLERS.liet_ke_du_an(ctx({ projects: [] }), {})) as {
      du_an: unknown[];
      ghi_chu: string;
    };
    expect(out.du_an).toEqual([]);
    expect(out.ghi_chu).toContain("chưa là thành viên");
  });

  it("chỉ đọc bảng của nền tảng dự án, không chạm bảng nghiệp vụ cũ", async () => {
    const calls: string[] = [];
    await HANDLERS.liet_ke_du_an(ctx(DATA, calls), {});
    expect(new Set(calls)).toEqual(
      new Set(["projects", "project_members", "project_stages", "standards", "methodologies"]),
    );
  });
});

describe("tien_do_du_an", () => {
  it("tóm tắt bảy bước, công việc, kỳ giám sát và báo cáo gần nhất", async () => {
    const out = (await HANDLERS.tien_do_du_an(ctx(), { ten_du_an: "Cà Mau" })) as {
      du_an: string;
      bay_buoc: Array<{ buoc: number; da_duyet: boolean; nguoi_duyet: string | null }>;
      cong_viec: Record<string, number>;
      ky_giam_sat: Array<Record<string, unknown>>;
      bao_cao_gan_nhat: Record<string, unknown> | null;
    };
    expect(out.du_an).toBe("Rừng ngập mặn Cà Mau");
    expect(out.bay_buoc.map((b) => b.da_duyet)).toEqual([true, true, false, false, false]);
    expect(out.cong_viec).toMatchObject({ tong: 4, chua_lam: 1, dang_lam: 1, xong: 1, vuong: 1 });
    expect(out.ky_giam_sat[0]).toMatchObject({ ten: "Kỳ 2026-1", trang_thai: "đã khoá" });
    expect(out.bao_cao_gan_nhat).toMatchObject({ uoc_tinh: "128.4200", don_vi: "tCO2e" });
  });

  it("nêu tên người đã duyệt từng bước, lấy qua danh bạ dự án", async () => {
    const out = (await HANDLERS.tien_do_du_an(ctx(), {})) as {
      bay_buoc: Array<{ buoc: number; nguoi_duyet: string | null }>;
    };
    expect(out.bay_buoc[0].nguoi_duyet).toBe("Trần Thị Bích");
    expect(out.bay_buoc[1].nguoi_duyet).toBe("Người thử");
    expect(out.bay_buoc[2].nguoi_duyet).toBeNull();
  });

  it("chỉ ra bước kế tiếp và điều kiện còn vướng của đúng bước đó", async () => {
    const out = (await HANDLERS.tien_do_du_an(ctx(), {})) as {
      buoc_ke_tiep: { buoc: number; dieu_kien: Array<{ dieu_kien: string; dat: boolean }> };
    };
    expect(out.buoc_ke_tiep.buoc).toBe(3);
    // Bước 3 chỉ đòi: các bước trước đã duyệt, và đã khoá Standard.
    expect(out.buoc_ke_tiep.dieu_kien).toHaveLength(2);
    expect(out.buoc_ke_tiep.dieu_kien.every((c) => c.dat)).toBe(true);
  });

  it("cắt từ phân loại thừa ở đầu tên dự án", async () => {
    const out = (await HANDLERS.tien_do_du_an(ctx(), { ten_du_an: "dự án Biogas" })) as {
      du_an: string;
    };
    expect(out.du_an).toBe("Biogas Đồng Tháp");
  });

  it("tên không khớp thì báo không tìm thấy, KHÔNG lấy dự án khác thay thế", async () => {
    const out = (await HANDLERS.tien_do_du_an(ctx(), { ten_du_an: "Không tồn tại" })) as {
      khong_tim_thay?: string;
      du_an?: string;
    };
    expect(out.khong_tim_thay).toBeTruthy();
    expect(out.du_an).toBeUndefined();
  });

  it("không lấy dự án đã xoá mềm làm mặc định", async () => {
    const out = (await HANDLERS.tien_do_du_an(
      ctx(withOverrides({ projects: [DA_XOA, CA_MAU] })),
      {},
    )) as { du_an: string; da_xoa: boolean };
    expect(out.du_an).toBe("Rừng ngập mặn Cà Mau");
    expect(out.da_xoa).toBe(false);
  });

  it("luôn kèm ghi chú rằng con số là ước tính chưa thẩm định", async () => {
    const out = (await HANDLERS.tien_do_du_an(ctx(), {})) as { ghi_chu: string };
    expect(out.ghi_chu).toContain("ƯỚC TÍNH");
    expect(out.ghi_chu).toContain("không phải tín chỉ");
    expect(out.ghi_chu).toContain("MẪU");
  });
});

describe("yeu_cau_cua_buoc", () => {
  it("bỏ trống số bước thì lấy bước chưa duyệt gần nhất", async () => {
    const out = (await HANDLERS.yeu_cau_cua_buoc(ctx(), {})) as {
      buoc: number;
      ten_buoc: string;
      da_duyet: boolean;
    };
    expect(out.buoc).toBe(3);
    expect(out.ten_buoc).toBe("Chọn Standard");
    expect(out.da_duyet).toBe(false);
  });

  it("điều kiện đúng bằng luật của approve_project_stage, không thêm bớt", async () => {
    const dieuKien = async (buoc: number) =>
      (
        (await HANDLERS.yeu_cau_cua_buoc(ctx(), { buoc })) as {
          dieu_kien: Array<{ dieu_kien: string }>;
        }
      ).dieu_kien.map((c) => c.dieu_kien);

    expect(await dieuKien(1)).toEqual(["Các bước trước đã duyệt hết"]);
    expect(await dieuKien(3)).toEqual(["Các bước trước đã duyệt hết", "Đã KHOÁ Standard"]);
    expect(await dieuKien(4)).toEqual([
      "Các bước trước đã duyệt hết",
      "Đã KHOÁ Standard",
      "Đã KHOÁ Methodology",
    ]);
    expect(await dieuKien(5)).toEqual([
      "Các bước trước đã duyệt hết",
      "Đã KHOÁ Standard",
      "Đã KHOÁ Methodology",
      "Baseline hợp lệ theo metric_schema của Methodology đã chọn",
    ]);
  });

  it("bước 5 vướng vì baseline chưa hợp lệ, và nói ra đúng điều đang vướng", async () => {
    const out = (await HANDLERS.yeu_cau_cua_buoc(ctx(), { buoc: 5 })) as {
      dieu_kien: Array<{ dieu_kien: string; dat: boolean }>;
      con_vuong: string[];
    };
    expect(out.con_vuong).toContain("Các bước trước đã duyệt hết");
    expect(out.con_vuong).toContain(
      "Baseline hợp lệ theo metric_schema của Methodology đã chọn",
    );
    expect(out.dieu_kien.find((c) => c.dieu_kien === "Đã KHOÁ Standard")?.dat).toBe(true);
  });

  it("baseline đã đủ thì điều kiện baseline chuyển sang đạt", async () => {
    const data = withOverrides({
      projects: [{ ...CA_MAU, baseline: { baseline_stock_tc_ha: "120.5" } }],
    });
    const out = (await HANDLERS.yeu_cau_cua_buoc(ctx(data), { buoc: 5 })) as {
      dieu_kien: Array<{ dieu_kien: string; dat: boolean }>;
    };
    expect(
      out.dieu_kien.find((c) => c.dieu_kien.startsWith("Baseline hợp lệ"))?.dat,
    ).toBe(true);
  });

  it("chưa khoá Standard thì nói thẳng là chưa đạt", async () => {
    const data = withOverrides({
      projects: [{ ...CA_MAU, standard_locked_at: null, methodology_locked_at: null }],
    });
    const out = (await HANDLERS.yeu_cau_cua_buoc(ctx(data), { buoc: 3 })) as {
      dieu_kien: Array<{ dieu_kien: string; dat: boolean }>;
    };
    expect(out.dieu_kien.find((c) => c.dieu_kien === "Đã KHOÁ Standard")?.dat).toBe(false);
  });

  it("chỉ chủ dự án duyệt được, và hàm nói rõ người hỏi có phải chủ không", async () => {
    const asOwner = (await HANDLERS.yeu_cau_cua_buoc(ctx(), { buoc: 3 })) as {
      ai_duyet_duoc: string;
      nguoi_hoi_duyet_duoc: boolean;
    };
    expect(asOwner.ai_duyet_duoc).toContain("chủ dự án");
    expect(asOwner.nguoi_hoi_duyet_duoc).toBe(true);

    const data = withOverrides({
      project_members: [{ project_id: "p-1", user_id: "u-1", role: "developer" }],
    });
    const asDev = (await HANDLERS.yeu_cau_cua_buoc(ctx(data), { buoc: 3 })) as {
      nguoi_hoi_duyet_duoc: boolean;
    };
    expect(asDev.nguoi_hoi_duyet_duoc).toBe(false);
  });

  it("số bước ngoài 1..7 bị từ chối chứ không im lặng lấy bước khác", async () => {
    for (const buoc of [0, 8, -1, 99]) {
      const out = (await HANDLERS.yeu_cau_cua_buoc(ctx(), { buoc })) as {
        tham_so_sai?: string;
        buoc?: number;
      };
      expect(out.tham_so_sai, `buoc=${buoc}`).toBeTruthy();
      expect(out.buoc).toBeUndefined();
    }
  });

  it("duyệt xong cả bảy bước thì nói đã xong, không bịa ra bước thứ tám", async () => {
    const stages = (DATA.project_stages as Array<Record<string, unknown>>).map((s) => ({
      ...s,
      approved_at: "2026-06-01T00:00:00Z",
      approved_by: "u-1",
    }));
    const out = (await HANDLERS.yeu_cau_cua_buoc(ctx(withOverrides({ project_stages: stages })), {})) as {
      da_xong?: boolean;
      ghi_chu?: string;
    };
    expect(out.da_xong).toBe(true);
    expect(out.ghi_chu).toContain("giám sát");
  });

  it("nói rõ đây là luật của hệ thống, không phải yêu cầu của tổ chức chứng nhận", async () => {
    const out = (await HANDLERS.yeu_cau_cua_buoc(ctx(), {})) as { ghi_chu: string };
    expect(out.ghi_chu).toContain("approve_project_stage");
    expect(out.ghi_chu).toContain("Verra");
    expect(out.ghi_chu).toContain("đừng suy diễn");
  });
});

describe("goi_y_methodology", () => {
  it("bỏ trống mô tả thì trả cả catalog", async () => {
    const out = (await HANDLERS.goi_y_methodology(ctx(), {})) as {
      khop: Array<Record<string, unknown>>;
      tong_so_trong_catalog: number;
    };
    expect(out.khop).toHaveLength(2);
    expect(out.tong_so_trong_catalog).toBe(2);
    expect(out.khop[0]).toMatchObject({ standard: "VCS", ma: "DEMO-VCS-FOREST" });
  });

  it("khớp theo từng từ của mô tả, không đòi khớp cả câu", async () => {
    const out = (await HANDLERS.goi_y_methodology(ctx(), {
      mo_ta: "dự án biogas cho hộ gia đình",
    })) as { khop: Array<{ ma: string }> };
    expect(out.khop.map((m) => m.ma)).toEqual(["DEMO-GS-BIOGAS"]);
  });

  it("không khớp gì thì bảo nói thẳng là chưa có, cấm gợi ý từ trí nhớ", async () => {
    const out = (await HANDLERS.goi_y_methodology(ctx(), { mo_ta: "điện gió ngoài khơi" })) as {
      khop: unknown[];
      ghi_chu: string;
    };
    expect(out.khop).toEqual([]);
    expect(out.ghi_chu).toContain("chưa có");
    expect(out.ghi_chu).toContain("trí nhớ");
  });

  it("mỗi mục kèm cờ dữ liệu mẫu và disclaimer của chính nó", async () => {
    const out = (await HANDLERS.goi_y_methodology(ctx(), {})) as {
      khop: Array<{ la_du_lieu_mau: boolean; da_tham_dinh_chuyen_mon: boolean; canh_bao: string }>;
      ghi_chu: string;
    };
    for (const m of out.khop) {
      expect(m.la_du_lieu_mau).toBe(true);
      expect(m.da_tham_dinh_chuyen_mon).toBe(false);
      expect(m.canh_bao).toContain("CHƯA ĐƯỢC THẨM ĐỊNH");
    }
    expect(out.ghi_chu).toContain("Gold Standard");
  });
});

describe("field_giam_sat_cua_methodology", () => {
  it("tách rõ field baseline và field quan sát, kèm đơn vị và tên cột CSV", async () => {
    const out = (await HANDLERS.field_giam_sat_cua_methodology(ctx(), {
      ma_methodology: "DEMO-VCS-FOREST",
    })) as {
      field_baseline: Array<Record<string, unknown>>;
      field_quan_sat: Array<Record<string, unknown>>;
    };
    expect(out.field_baseline.map((f) => f.ma)).toEqual(["baseline_stock_tc_ha"]);
    expect(out.field_baseline[0]).toMatchObject({
      ten: "Trữ lượng carbon nền",
      don_vi: "tC/ha",
      bat_buoc: true,
      rang_buoc: { minimum: 0, scale: 4 },
    });
    expect(out.field_quan_sat.map((f) => f.ma)).toEqual(["area_ha", "loai_rung"]);
    expect(out.field_quan_sat[0].ten_cot_khi_nhap_csv).toEqual([
      "area_ha",
      "Diện tích ô đo",
    ]);
  });

  it("field enum trả kèm đúng danh sách giá trị cho phép", async () => {
    const out = (await HANDLERS.field_giam_sat_cua_methodology(ctx(), {
      ma_methodology: "DEMO-VCS-FOREST",
    })) as { field_quan_sat: Array<{ ma: string; gia_tri_cho_phep?: unknown[] }> };
    const enumField = out.field_quan_sat.find((f) => f.ma === "loai_rung");
    expect(enumField?.gia_tri_cho_phep).toEqual([{ ma: "ngap_man", ten: "Ngập mặn" }]);
  });

  it("không có mã thì lấy methodology mà dự án đang chọn", async () => {
    const out = (await HANDLERS.field_giam_sat_cua_methodology(ctx(), {
      ten_du_an: "Cà Mau",
    })) as { du_an: string; methodology: string };
    expect(out.du_an).toBe("Rừng ngập mặn Cà Mau");
    expect(out.methodology).toBe("DEMO-VCS-FOREST · demo-1.0");
  });

  it("dự án chưa chọn methodology thì nói rõ, không đưa field của dự án khác", async () => {
    const out = (await HANDLERS.field_giam_sat_cua_methodology(ctx(), {
      ten_du_an: "Biogas Đồng Tháp",
    })) as { chua_chon_methodology?: boolean; field_baseline?: unknown[] };
    expect(out.chua_chon_methodology).toBe(true);
    expect(out.field_baseline).toBeUndefined();
  });

  it("mã lạ thì báo catalog không có, kèm cảnh báo dữ liệu mẫu", async () => {
    const out = (await HANDLERS.field_giam_sat_cua_methodology(ctx(), {
      ma_methodology: "VM0007",
    })) as { khong_tim_thay: string };
    expect(out.khong_tim_thay).toContain("VM0007");
    expect(out.khong_tim_thay).toContain("MẪU");
  });

  it("lược đồ hỏng thì nói chưa tra được, không mô tả field theo trí nhớ", async () => {
    const data = withOverrides({
      methodologies: [
        { ...(DATA.methodologies as Record<string, unknown>[])[0], metric_schema: { rac: true } },
      ],
    });
    const out = (await HANDLERS.field_giam_sat_cua_methodology(ctx(data), {
      ma_methodology: "DEMO-VCS-FOREST",
    })) as { loi_luoc_do?: string; field_baseline?: unknown[] };
    expect(out.loi_luoc_do).toContain("không mô tả field theo trí nhớ");
    expect(out.field_baseline).toBeUndefined();
  });
});

describe("kiem_tra_baseline", () => {
  it("nêu đích danh field còn thiếu, bằng tiếng Việt", async () => {
    const out = (await HANDLERS.kiem_tra_baseline(ctx(), { ten_du_an: "Cà Mau" })) as {
      dat: boolean;
      so_field_baseline: number;
      so_field_da_nhap: number;
      con_thieu_hoac_sai: Array<{ field: string; ten: string; van_de: string }>;
    };
    expect(out.dat).toBe(false);
    expect(out.so_field_baseline).toBe(1);
    expect(out.so_field_da_nhap).toBe(0);
    expect(out.con_thieu_hoac_sai).toEqual([
      {
        field: "baseline_stock_tc_ha",
        ten: "Trữ lượng carbon nền",
        van_de: "Bắt buộc nhưng chưa nhập",
      },
    ]);
  });

  it("baseline hợp lệ thì báo đạt", async () => {
    const data = withOverrides({
      projects: [{ ...CA_MAU, baseline: { baseline_stock_tc_ha: "120.5" }, baseline_revision: 2 }],
    });
    const out = (await HANDLERS.kiem_tra_baseline(ctx(data), {})) as {
      dat: boolean;
      so_field_da_nhap: number;
      ban_sua_baseline: number;
      ghi_chu: string;
    };
    expect(out.dat).toBe(true);
    expect(out.so_field_da_nhap).toBe(1);
    expect(out.ban_sua_baseline).toBe(2);
    expect(out.ghi_chu).toContain("tạo được");
  });

  it("bắt giá trị sai kiểu và ngoài khoảng, không chỉ bắt thiếu", async () => {
    const data = withOverrides({
      projects: [{ ...CA_MAU, baseline: { baseline_stock_tc_ha: "-3" } }],
    });
    const out = (await HANDLERS.kiem_tra_baseline(ctx(data), {})) as {
      dat: boolean;
      con_thieu_hoac_sai: Array<{ van_de: string }>;
    };
    expect(out.dat).toBe(false);
    expect(out.con_thieu_hoac_sai[0].van_de).toContain("nhỏ nhất");
  });

  it("field lạ ngoài lược đồ cũng bị nêu — DB sẽ từ chối đúng như vậy", async () => {
    const data = withOverrides({
      projects: [
        { ...CA_MAU, baseline: { baseline_stock_tc_ha: "1", area_ha: "2", bia_dat: 1 } },
      ],
    });
    const out = (await HANDLERS.kiem_tra_baseline(ctx(data), {})) as {
      con_thieu_hoac_sai: Array<{ field: string; van_de: string }>;
    };
    // `area_ha` có thật nhưng thuộc scope observation, `bia_dat` thì không tồn tại.
    expect(out.con_thieu_hoac_sai.map((e) => e.field).sort()).toEqual(["area_ha", "bia_dat"]);
    for (const e of out.con_thieu_hoac_sai) expect(e.van_de).toContain("lược đồ");
  });

  it("chưa chọn methodology thì không kiểm được, và nói rõ vì sao", async () => {
    const out = (await HANDLERS.kiem_tra_baseline(ctx(), { ten_du_an: "Biogas" })) as {
      chua_chon_methodology?: boolean;
      dat?: boolean;
    };
    expect(out.chua_chon_methodology).toBe(true);
    expect(out.dat).toBeUndefined();
  });

  it("nói rõ đây là kiểm tra kỹ thuật, không phải đánh giá chuyên môn", async () => {
    const out = (await HANDLERS.kiem_tra_baseline(ctx(), {})) as { ghi_chu: string };
    expect(out.ghi_chu).toContain("KỸ THUẬT");
    expect(out.ghi_chu).toContain("VVB");
  });
});

describe("cong_viec_theo_buoc", () => {
  it("gom việc theo bước và bỏ qua việc đã xong khi không lọc", async () => {
    const out = (await HANDLERS.cong_viec_theo_buoc(ctx(), {})) as {
      tong_cong_viec_cua_du_an: number;
      so_viec_khop_bo_loc: number;
      theo_buoc: Array<{ buoc: number; so_viec: number; viec: Array<Record<string, unknown>> }>;
    };
    expect(out.tong_cong_viec_cua_du_an).toBe(4);
    expect(out.so_viec_khop_bo_loc).toBe(3);
    const buoc5 = out.theo_buoc.find((s) => s.buoc === 5);
    expect(buoc5?.so_viec).toBe(2);
    // Bước 1 chỉ có việc đã xong, nên rỗng khi lọc mặc định.
    expect(out.theo_buoc.find((s) => s.buoc === 1)?.so_viec).toBe(0);
  });

  it("đánh dấu quá hạn theo hạn thật, và không coi việc đã xong là quá hạn", async () => {
    const out = (await HANDLERS.cong_viec_theo_buoc(ctx(), {})) as {
      theo_buoc: Array<{ buoc: number; viec: Array<{ tieu_de: string; qua_han: boolean }> }>;
    };
    const viec = out.theo_buoc.flatMap((s) => s.viec);
    expect(viec.find((t) => t.tieu_de === "Nhập baseline vào hệ thống")?.qua_han).toBe(true);
    expect(viec.find((t) => t.tieu_de === "Đo trữ lượng carbon nền")?.qua_han).toBe(false);

    const done = (await HANDLERS.cong_viec_theo_buoc(ctx(), { trang_thai: "done" })) as {
      theo_buoc: Array<{ viec: Array<{ tieu_de: string; qua_han: boolean }> }>;
    };
    expect(done.theo_buoc.flatMap((s) => s.viec)[0]).toMatchObject({
      tieu_de: "Viết mô tả ý tưởng",
      qua_han: false,
    });
  });

  it("hiện tên người được giao, lấy qua danh bạ dự án", async () => {
    const out = (await HANDLERS.cong_viec_theo_buoc(ctx(), { trang_thai: "in_progress" })) as {
      theo_buoc: Array<{ viec: Array<{ giao_cho: string | null }> }>;
    };
    expect(out.theo_buoc.flatMap((s) => s.viec)[0].giao_cho).toBe("Trần Thị Bích");
  });

  it("lọc theo trạng thái, và từ chối trạng thái không có thật", async () => {
    const blocked = (await HANDLERS.cong_viec_theo_buoc(ctx(), { trang_thai: "blocked" })) as {
      so_viec_khop_bo_loc: number;
    };
    expect(blocked.so_viec_khop_bo_loc).toBe(1);

    const sai = (await HANDLERS.cong_viec_theo_buoc(ctx(), { trang_thai: "dang_treo" })) as {
      tham_so_sai?: string;
      theo_buoc?: unknown[];
    };
    expect(sai.tham_so_sai).toBeTruthy();
    expect(sai.theo_buoc).toBeUndefined();
  });

  it("nhắc ràng buộc chỉ giao việc được cho Đơn vị phát triển", async () => {
    const out = (await HANDLERS.cong_viec_theo_buoc(ctx(), {})) as { ghi_chu: string };
    expect(out.ghi_chu).toContain("Đơn vị phát triển");
  });
});

describe("công cụ giám sát và MRV", () => {
  it("liệt kê từng kỳ với revision, trạng thái và số record đếm thật", async () => {
    const out = (await HANDLERS.liet_ke_ky_giam_sat(ctx(), { ten_du_an: "Cà Mau" })) as {
      ky_giam_sat: Array<Record<string, unknown>>;
    };
    expect(out.ky_giam_sat).toHaveLength(2);
    expect(out.ky_giam_sat[0]).toMatchObject({
      ten: "Kỳ 2026-1",
      trang_thai: "đã khoá",
      data_revision: 3,
      so_ban_ghi: 1,
      co_the_sinh_bao_cao: true,
    });
    expect(out.ky_giam_sat[1]).toMatchObject({
      ten: "Kỳ 2026-2",
      trang_thai: "đang mở",
      data_revision: 2,
      so_ban_ghi: 1,
      co_the_sinh_bao_cao: false,
    });
  });

  it("tách điều kiện DB khoá kỳ khỏi cảnh báo chất lượng dữ liệu", async () => {
    const out = (await HANDLERS.tom_tat_du_lieu_giam_sat(ctx(), {
      ten_du_an: "Cà Mau",
      ten_ky: "2026-2",
    })) as {
      co_the_goi_rpc_khoa_ky: boolean;
      blocker_do_db_thuc_su_cuong_che: string[];
      canh_bao_chat_luong_du_lieu: string[];
      so_ban_ghi_da_doc: number;
      ky: { data_revision: number };
      ghi_chu: string;
    };
    expect(out).toMatchObject({
      co_the_goi_rpc_khoa_ky: true,
      blocker_do_db_thuc_su_cuong_che: [],
      canh_bao_chat_luong_du_lieu: [],
      so_ban_ghi_da_doc: 1,
      ky: { data_revision: 2 },
    });
    expect(out.ghi_chu).toContain("KHÔNG được nói sai rằng DB đang chặn");
  });

  it("liệt kê report với provenance và không gọi estimate là tín chỉ", async () => {
    const out = (await HANDLERS.liet_ke_bao_cao_mrv(ctx(), {})) as {
      bao_cao: Array<Record<string, unknown>>;
      ghi_chu: string;
    };
    expect(out.bao_cao[0]).toMatchObject({
      ma_bao_cao: "r-1",
      ky: "Kỳ 2026-1",
      uoc_tinh: "128.4200",
      don_vi: "tCO2e",
      methodology: "DEMO-VCS-FOREST · demo-1.0",
      methodology_la_du_lieu_mau: true,
      schema_hash: "hash-1",
      data_revision: 3,
      engine_version: "methodology-engine/1",
    });
    expect(out.ghi_chu).toContain("KHÔNG phải tín chỉ đã phát hành");
    expect(out.ghi_chu).toContain("MẪU");
  });

  it("đọc nguyên trace snapshot, gồm nguồn factor và aggregation", async () => {
    const out = (await HANDLERS.doc_vet_tinh_bao_cao(ctx(), {
      ten_ky: "Kỳ 2026-1",
      phien_ban_bao_cao: 1,
    })) as {
      bao_cao: { uoc_tinh: string };
      lap_luan_tinh_toan: {
        tung_quan_sat: Array<{ factors: Array<{ source: string }> }>;
        aggregation: Array<{ value: string }>;
      };
      cach_dien_giai: string;
    };
    expect(out.bao_cao.uoc_tinh).toBe("128.4200");
    expect(out.lap_luan_tinh_toan.tung_quan_sat[0].factors[0].source).toBe(
      "factor snapshot",
    );
    expect(out.lap_luan_tinh_toan.aggregation[0].value).toBe("128.4200");
    expect(out.cach_dien_giai).toContain("không tự tính lại");
  });
});

describe("công cụ thành viên, tài liệu và catalog", () => {
  it("đọc thành viên qua RPC danh bạ, không truy vấn profiles", async () => {
    const calls: string[] = [];
    const out = (await HANDLERS.thanh_vien_va_phan_cong(ctx(DATA, calls), {})) as {
      thanh_vien: Array<Record<string, unknown>>;
      viec_chua_giao: string[];
    };
    expect(out.thanh_vien[1]).toMatchObject({
      ho_ten: "Trần Thị Bích",
      vai_tro: "đơn vị phát triển",
      email: "dev@example.test",
      so_viec_dang_mo: 1,
    });
    expect(out.viec_chua_giao).toEqual(["Nhập baseline vào hệ thống", "Đối chiếu hai Standard"]);
    expect(calls).toContain("rpc:project_member_directory");
    expect(calls).not.toContain("profiles");
  });

  it("liệt kê tài liệu đã nộp nhưng không bịa checklist còn thiếu", async () => {
    const out = (await HANDLERS.tai_lieu_theo_buoc(ctx(), { buoc: 5 })) as {
      theo_buoc: Array<{ tai_lieu: Array<Record<string, unknown>> }>;
      checklist_bat_buoc_theo_db: unknown[];
      ket_luan_ve_tai_lieu_thieu: string;
    };
    expect(out.theo_buoc[0].tai_lieu[0]).toMatchObject({
      kind: "baseline",
      phien_ban: 1,
      ten_tep: "baseline-camau-v1.pdf",
    });
    expect(out.checklist_bat_buoc_theo_db).toEqual([]);
    expect(out.ket_luan_ve_tai_lieu_thieu).toContain("không được suy diễn");
  });

  it("catalog chỉ mô tả record nhìn thấy và gắn cờ methodology mẫu", async () => {
    const out = (await HANDLERS.liet_ke_standard(ctx(), {})) as {
      standard: Array<Record<string, unknown>>;
      ghi_chu: string;
    };
    expect(out.standard).toEqual([
      {
        ma: "VCS",
        ten: "Verra — Verified Carbon Standard (VCS)",
        so_methodology_nhin_thay: 1,
        so_methodology_mau: 1,
      },
      {
        ma: "GS",
        ten: "Gold Standard",
        so_methodology_nhin_thay: 1,
        so_methodology_mau: 1,
      },
    ]);
    expect(out.ghi_chu).toContain("không phải danh sách đầy đủ ngoài đời");
    expect(out.ghi_chu).toContain("MẪU");
  });
});

describe("bộ công cụ sau khi gỡ nghiệp vụ cũ", () => {
  const LEGACY = [
    "tra_cuu_he_so",
    "liet_ke_mua_vu",
    "tong_ket_mua_vu",
    "thua_thieu_nhat_ky",
    "chi_tiet_thua_vu",
    "liet_ke_nong_ho",
    "liet_ke_lo_tin_chi",
    "chia_doanh_thu",
    "lo_dang_chao_ban",
    "don_hang_cua_toi",
  ];

  it("không còn công cụ nào đọc bảng của hợp tác xã hay chợ tín chỉ", () => {
    const names = TOOLS.map((t) => t.name);
    for (const legacy of LEGACY) {
      expect(names, legacy).not.toContain(legacy);
      expect(Object.keys(HANDLERS), legacy).not.toContain(legacy);
    }
  });

  it("mọi công cụ đều có handler, và mọi handler đều có công cụ", () => {
    // Phép chẵn lẻ mà `tests/chat.test.ts` KHÔNG làm: nó chỉ canh TOOLS ↔ FIXTURE_RESULTS.
    expect(TOOLS.map((t) => t.name).sort()).toEqual(Object.keys(HANDLERS).sort());
  });

  it("mọi vai trò toàn cục đều dùng được cả bộ công cụ dự án", () => {
    for (const role of ["coop_manager", "coop_staff", "buyer", "platform_admin"] as const) {
      expect(toolsForRole(role).map((t) => t.name).sort()).toEqual(
        TOOLS.map((t) => t.name).sort(),
      );
      for (const tool of TOOLS) expect(findTool(tool.name, role), tool.name).not.toBeNull();
    }
    expect(findTool("khong_ton_tai", "platform_admin")).toBeNull();
  });

  it("mọi công cụ đều khai đủ vai trò, mô tả và tham số bắt buộc hợp lệ", () => {
    for (const tool of TOOLS) {
      expect(tool.roles.length, tool.name).toBeGreaterThan(0);
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
      expect(tool.description, `${tool.name} phải nói rõ lúc bắt buộc dùng`).toContain("PHẢI gọi");
      for (const required of tool.parameters.required ?? [])
        expect(Object.keys(tool.parameters.properties), tool.name).toContain(required);
    }
  });

  it("mô tả tool định tuyến thẳng ba câu judge chấm hụt", () => {
    expect(findTool("liet_ke_du_an", "coop_staff")?.description).toContain(
      "quy trình có bao nhiêu bước",
    );
    expect(findTool("field_giam_sat_cua_methodology", "coop_staff")?.description).toContain(
      "chỉ có tên field thì vẫn gọi với args rỗng",
    );
    expect(findTool("doc_vet_tinh_bao_cao", "coop_staff")?.description).toContain(
      "báo cáo MRV lấy dữ liệu từ đâu",
    );
  });
});

describe("system prompt của nền tảng dự án", () => {
  const base = { role: "coop_staff" as const, fullName: "Người thử", coopName: null };

  it("liệt kê công cụ dự án, không còn công cụ nghiệp vụ cũ", () => {
    const prompt = buildSystemPrompt({ ...base, path: "/du-an" });
    expect(prompt).toContain("liet_ke_du_an");
    expect(prompt).toContain("yeu_cau_cua_buoc");
    expect(prompt).not.toContain("liet_ke_nong_ho");
    expect(prompt).not.toContain("không có công cụ nào khả dụng");
  });

  it("mang theo ranh giới trung thực: không bịa yêu cầu của tổ chức chứng nhận", () => {
    const prompt = buildSystemPrompt(base);
    expect(prompt).toContain("KHÔNG được mô tả yêu cầu của");
    expect(prompt).toContain("DỮ LIỆU MẪU");
    expect(prompt).toContain("VVB");
    expect(prompt).toContain("issuance");
  });

  it("giữ nguyên thuật ngữ chuẩn thay vì Việt hoá", () => {
    const prompt = buildSystemPrompt(base);
    for (const term of ["PDD", "baseline scenario", "additionality", "Methodology"])
      expect(prompt, term).toContain(term);
  });

  it("nhận diện các màn hình của nền tảng dự án", () => {
    expect(describePage("/du-an")).toContain("danh sách dự án");
    expect(describePage("/du-an/abc")).toContain("kanban");
    expect(describePage("/du-an/abc/quy-trinh")).toContain("BẢY BƯỚC");
    expect(describePage("/du-an/abc/giam-sat")).toContain("kỳ giám sát");
    expect(describePage("/du-an/abc/giam-sat/k1")).toContain("nhập số liệu");
    expect(describePage("/du-an/abc/bao-cao")).toContain("báo cáo");
    expect(describePage("/du-an/abc/thanh-vien")).toContain("thành viên");
  });

  it("màn hình bảy bước gợi thẳng công cụ điều kiện duyệt", () => {
    expect(describePage("/du-an/abc/quy-trinh")).toContain("yeu_cau_cua_buoc");
  });

  it("không còn nhận diện màn hình của module cũ", () => {
    for (const path of ["/htx/nong-ho", "/cho", "/don-hang", "/quan-tri", "/thiet-lap"])
      expect(describePage(path), path).toBeNull();
  });
});
