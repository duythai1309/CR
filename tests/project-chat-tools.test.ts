import { describe, expect, it } from "vitest";
import { HANDLERS } from "@/lib/chat/handlers";
import { TOOLS, findTool, toolsForContext, toolsForRole } from "@/lib/chat/tools";
import { buildSystemPrompt, describePage } from "@/lib/chat/prompt";
import type { Profile } from "@/lib/auth";

/**
 * Công cụ trợ lý cho nền tảng dự án.
 *
 * `tests/chat.test.ts` chỉ canh `TOOLS` ↔ `FIXTURE_RESULTS`, **không** canh `HANDLERS` —
 * rủi ro R11 trong `docs/audit/audit-keep.md`. Nên hai handler mới được gọi thật ở đây,
 * trên một client giả, thay vì tin vào màu xanh của bộ test cũ.
 */

/** Client giả: dựng lại đúng chuỗi gọi PostgREST mà handler dùng, và awaitable. */
function fakeDb(tables: Record<string, unknown[]>, calls: string[] = []) {
  const builder = (table: string) => {
    const state = { table, filtered: null as string | null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: () => chain,
      ilike: (_col: string, pattern: string) => {
        state.filtered = String(pattern).replace(/%/g, "").toLowerCase();
        return chain;
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => {
        calls.push(table);
        let rows = tables[table] ?? [];
        if (state.filtered)
          rows = rows.filter((r) =>
            String((r as { name?: string }).name ?? "")
              .toLowerCase()
              .includes(state.filtered!),
          );
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    return chain;
  };
  return { from: (table: string) => builder(table) };
}

const profile = { id: "u-1", full_name: "Người thử", role: "coop_staff" } as unknown as Profile;

const DATA = {
  projects: [
    {
      id: "p-1",
      name: "Rừng ngập mặn Cà Mau",
      description: "Giai đoạn 1",
      deleted_at: null,
      standard_id: "s-1",
      methodology_id: "m-1",
      standard_locked_at: "2026-02-01T00:00:00Z",
      methodology_locked_at: "2026-02-02T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "p-2",
      name: "Biogas Đồng Tháp",
      description: "",
      deleted_at: null,
      standard_id: null,
      methodology_id: null,
      standard_locked_at: null,
      methodology_locked_at: null,
      updated_at: "2026-08-01T00:00:00Z",
    },
  ],
  project_members: [
    { project_id: "p-1", user_id: "u-1", role: "owner" },
    { project_id: "p-1", user_id: "u-2", role: "developer" },
    { project_id: "p-2", user_id: "u-1", role: "developer" },
  ],
  project_stages: [
    { project_id: "p-1", ordinal: 1, title: "Project Idea", approved_at: "2026-03-01T00:00:00Z" },
    { project_id: "p-1", ordinal: 2, title: "Feasibility", approved_at: "2026-03-02T00:00:00Z" },
    { project_id: "p-1", ordinal: 3, title: "Chọn Standard", approved_at: null },
  ],
  standards: [{ id: "s-1", code: "VCS" }],
  methodologies: [{ id: "m-1", code: "DEMO-VCS-FOREST", version: "demo-1.0", is_sample: true }],
  project_tasks: [
    { status: "todo", stage_id: "st-1" },
    { status: "done", stage_id: "st-1" },
    { status: "blocked", stage_id: "st-2" },
  ],
  monitoring_periods: [
    {
      id: "k-1",
      name: "Kỳ 2026-1",
      start_date: "2026-01-01",
      end_date: "2026-06-30",
      status: "locked",
      version: 1,
      data_revision: 3,
    },
  ],
  mrv_reports: [
    {
      version: 1,
      status: "preview",
      generated_at: "2026-08-15T00:00:00Z",
      results: { estimated_credit: { value: "128.4200", unit: "tCO2e" } },
    },
  ],
};

const ctx = (data: Record<string, unknown[]> = DATA, calls: string[] = []) =>
  ({ supabase: fakeDb(data, calls), profile }) as never;

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
    });
    expect(out.du_an[1].vai_tro_trong_du_an).toBe("đơn vị phát triển");
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
    expect(out.ghi_chu).toContain("ước tính");
  });

  it("không có dự án nào thì nói rõ, không trả mảng rỗng trần", async () => {
    const out = (await HANDLERS.liet_ke_du_an(ctx({ projects: [] }), {})) as {
      du_an: unknown[];
      ghi_chu: string;
    };
    expect(out.du_an).toEqual([]);
    expect(out.ghi_chu).toContain("chưa là thành viên");
  });

  it("chỉ đọc, không gọi bảng nào ngoài phạm vi nền tảng dự án", async () => {
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
      bay_buoc: Array<{ buoc: number; da_duyet: boolean }>;
      cong_viec: Record<string, number>;
      ky_giam_sat: Array<Record<string, unknown>>;
      bao_cao_gan_nhat: Record<string, unknown> | null;
    };
    expect(out.du_an).toBe("Rừng ngập mặn Cà Mau");
    expect(out.bay_buoc.map((b) => b.da_duyet)).toEqual([true, true, false]);
    expect(out.cong_viec).toMatchObject({ tong: 3, chua_lam: 1, xong: 1, vuong: 1, dang_lam: 0 });
    expect(out.ky_giam_sat[0]).toMatchObject({ ten: "Kỳ 2026-1", trang_thai: "đã khoá" });
    expect(out.bao_cao_gan_nhat).toMatchObject({ uoc_tinh: "128.4200", don_vi: "tCO2e" });
  });

  it("cắt từ phân loại thừa ở đầu tên dự án", async () => {
    const out = (await HANDLERS.tien_do_du_an(ctx(), { ten_du_an: "Biogas" })) as {
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

  it("luôn kèm ghi chú rằng con số là ước tính chưa thẩm định", async () => {
    const out = (await HANDLERS.tien_do_du_an(ctx(), {})) as { ghi_chu: string };
    expect(out.ghi_chu).toContain("ƯỚC TÍNH");
    expect(out.ghi_chu).toContain("không phải tín chỉ");
  });
});

describe("phân phối công cụ theo ngữ cảnh", () => {
  it("hai công cụ dự án mở cho mọi vai trò toàn cục", () => {
    for (const role of ["coop_manager", "coop_staff", "buyer", "platform_admin"] as const) {
      expect(findTool("liet_ke_du_an", role)).not.toBeNull();
      expect(findTool("tien_do_du_an", role)).not.toBeNull();
    }
  });

  it("người dùng nền tảng dự án (chưa thuộc HTX) KHÔNG được mời tra cứu dữ liệu HTX", () => {
    const names = toolsForContext("coop_staff", { hasCooperative: false }).map((t) => t.name);
    expect(names).toContain("liet_ke_du_an");
    expect(names).toContain("tien_do_du_an");
    expect(names).not.toContain("liet_ke_mua_vu");
    expect(names).not.toContain("liet_ke_nong_ho");
  });

  it("cán bộ HTX thật vẫn thấy đủ công cụ như trước", () => {
    const before = toolsForRole("coop_staff").map((t) => t.name);
    const after = toolsForContext("coop_staff", { hasCooperative: true }).map((t) => t.name);
    expect(after).toEqual(before);
    expect(after).toContain("liet_ke_mua_vu");
  });

  it("lọc theo ngữ cảnh KHÔNG nới quyền — vẫn là tập con của quyền theo vai trò", () => {
    for (const role of ["coop_manager", "coop_staff", "buyer", "platform_admin"] as const) {
      const allowed = new Set(toolsForRole(role).map((t) => t.name));
      for (const hasCooperative of [true, false])
        for (const t of toolsForContext(role, { hasCooperative }))
          expect(allowed.has(t.name)).toBe(true);
    }
  });

  it("mọi công cụ cần hợp tác xã đều được đánh dấu tường minh", () => {
    const coopScoped = TOOLS.filter((t) => t.needsCooperative).map((t) => t.name);
    expect(coopScoped).toContain("tong_ket_mua_vu");
    expect(coopScoped).not.toContain("tra_cuu_he_so");
    expect(coopScoped).not.toContain("liet_ke_du_an");
  });
});

describe("system prompt trong ngữ cảnh dự án", () => {
  it("không liệt kê công cụ HTX cho người chưa thuộc hợp tác xã", () => {
    const prompt = buildSystemPrompt({
      role: "coop_staff",
      fullName: "A",
      coopName: null,
      path: "/du-an",
    });
    expect(prompt).toContain("liet_ke_du_an");
    expect(prompt).not.toContain("liet_ke_nong_ho");
    expect(prompt).not.toContain("không có công cụ nào khả dụng");
  });

  it("nhận diện các màn hình của nền tảng dự án", () => {
    expect(describePage("/du-an")).toContain("danh sách dự án");
    expect(describePage("/du-an/abc")).toContain("kanban");
    expect(describePage("/du-an/abc/quy-trinh")).toContain("bảy bước");
    expect(describePage("/du-an/abc/giam-sat")).toContain("kỳ giám sát");
    expect(describePage("/du-an/abc/giam-sat/k1")).toContain("nhập số liệu");
    expect(describePage("/du-an/abc/bao-cao")).toContain("báo cáo");
    expect(describePage("/du-an/abc/thanh-vien")).toContain("thành viên");
  });

  it("không làm hỏng nhận diện màn hình cũ", () => {
    expect(describePage("/htx/nong-ho")).toBe("danh sách nông hộ");
    expect(describePage("/cho")).toBe("chợ tín chỉ");
    expect(describePage("/khong-biet")).toBeNull();
  });
});
