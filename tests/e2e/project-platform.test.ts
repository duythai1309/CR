import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedIn } from "./helpers";
import { parseCSV, prepareImportRecords } from "@/lib/monitoring/import";

/**
 * Luồng thật của nền tảng dự án trên cơ sở dữ liệu thật, chạy bằng khoá công khai và
 * phiên đăng nhập thường — nên mọi truy vấn chịu đúng RLS như từ trình duyệt.
 *
 * KHÔNG dùng service role ở bất kỳ đâu. Phần duy nhất cần service role là sinh báo cáo
 * MRV; nếu thiếu khoá thì ca đó **tự bỏ qua kèm lý do**, không giả lập và không lách.
 *
 * Dữ liệu để lại: xem `docs/design/e2e-report.md`. Dự án **không xoá được** — nhiều khoá
 * ngoại là `on delete restrict` và `project_guard_stage` chặn xoá stage — nên mọi bản ghi
 * đều mang tiền tố `E2E-TEST-` để phân biệt với dữ liệu thật.
 */

const PASSWORD = "MatKhau12345";
const RUN = Date.now().toString().slice(-9);
const PROJECT_NAME = `E2E-TEST-${RUN} Rừng ngập mặn`;
const OTHER_PROJECT_NAME = `E2E-TEST-${RUN} Dự án thứ hai`;

/** `src/types/database.ts` chưa được sinh lại nên bảng mới chưa có kiểu; xem mục C9. */
type Db = SupabaseClient;

let owner: Db;
let developer: Db;
let viewer: Db;
let outsider: Db;

let ownerId: string;
let developerId: string;
let viewerId: string;
let outsiderId: string;

let projectId: string;
let otherProjectId: string;
let stages: Array<{ id: string; ordinal: number; title: string }> = [];
let taskId: string;
let standardId: string;
let methodologyId: string;
let periodId: string;
let templateId: string;

const untyped = (client: unknown) => client as Db;

beforeAll(async () => {
  owner = untyped(await signedIn("duan-owner@test.local", PASSWORD));
  developer = untyped(await signedIn("duan-dev@test.local", PASSWORD));
  viewer = untyped(await signedIn("duan-viewer@test.local", PASSWORD));
  outsider = untyped(await signedIn("duan-outsider@test.local", PASSWORD));

  ownerId = (await owner.auth.getUser()).data.user!.id;
  developerId = (await developer.auth.getUser()).data.user!.id;
  viewerId = (await viewer.auth.getUser()).data.user!.id;
  outsiderId = (await outsider.auth.getUser()).data.user!.id;
});

/* ------------------------------------------------------------------ tạo dự án */

describe("tạo dự án và bảy bước", () => {
  it("create_project sinh dự án, owner và đủ bảy stage trong một transaction", async () => {
    const { data, error } = await owner.rpc("create_project", {
      p_name: PROJECT_NAME,
      p_description: "Dự án do bộ kiểm thử end-to-end tạo.",
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
    projectId = data as string;

    const { data: members } = await owner
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId);
    expect(members).toEqual([{ user_id: ownerId, role: "owner" }]);

    const { data: rows } = await owner
      .from("project_stages")
      .select("id, ordinal, title")
      .eq("project_id", projectId)
      .order("ordinal");
    stages = (rows ?? []) as typeof stages;

    expect(stages.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(stages.map((s) => s.title)).toEqual([
      "Project Idea",
      "Feasibility Assessment",
      "Chọn Standard",
      "Chọn Methodology",
      "Baseline",
      "Additionality",
      "Project Design/PDD",
    ]);
  });

  it("tạo dự án thứ hai để thử cách ly giữa hai dự án", async () => {
    const { data, error } = await owner.rpc("create_project", {
      p_name: OTHER_PROJECT_NAME,
      p_description: "",
    });
    expect(error).toBeNull();
    otherProjectId = data as string;
  });

  it("không thêm được stage thứ tám, cũng không xoá được stage nào", async () => {
    const added = await owner
      .from("project_stages")
      .insert({ project_id: projectId, ordinal: 1, title: "Bước giả" });
    expect(added.error).not.toBeNull();

    const removed = await owner.from("project_stages").delete().eq("project_id", projectId);
    expect(removed.error).not.toBeNull();

    const { data: after } = await owner
      .from("project_stages")
      .select("id")
      .eq("project_id", projectId);
    expect(after).toHaveLength(7);
  });
});

/* ------------------------------------------------------------------ thành viên */

describe("thành viên và danh bạ (0015)", () => {
  it("owner thêm developer và viewer bằng RPC", async () => {
    for (const [userId, role] of [
      [developerId, "developer"],
      [viewerId, "viewer"],
    ] as const) {
      const { error } = await owner.rpc("set_project_member", {
        p_project_id: projectId,
        p_user_id: userId,
        p_role: role,
      });
      expect(error).toBeNull();
    }

    const { data } = await owner
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", projectId);
    expect(data).toHaveLength(3);
  });

  it("project_member_directory trả HỌ TÊN, không phải UUID trần — mục C5", async () => {
    const { data, error } = await owner.rpc("project_member_directory", {
      p_project_id: projectId,
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{ user_id: string; full_name: string; role: string; email: string | null }>;
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r.full_name.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.role)).toContain("owner");
  });

  it("owner thấy email; developer thấy tên nhưng KHÔNG thấy email", async () => {
    const asOwner = await owner.rpc("project_member_directory", { p_project_id: projectId });
    const asDev = await developer.rpc("project_member_directory", { p_project_id: projectId });

    const ownerRows = (asOwner.data ?? []) as Array<{ email: string | null }>;
    const devRows = (asDev.data ?? []) as Array<{ email: string | null; full_name: string }>;

    expect(ownerRows.every((r) => typeof r.email === "string" && r.email.length > 0)).toBe(true);
    expect(devRows).toHaveLength(3);
    expect(devRows.every((r) => r.email === null)).toBe(true);
    expect(devRows.every((r) => r.full_name.length > 0)).toBe(true);
  });

  it("người ngoài dự án gọi danh bạ trả RỖNG, không lỗi, không lộ dự án có tồn tại", async () => {
    const { data, error } = await outsider.rpc("project_member_directory", {
      p_project_id: projectId,
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("owner tra được người để mời bằng email chính xác", async () => {
    const { data, error } = await owner.rpc("project_lookup_invitee", {
      p_project_id: projectId,
      p_email: "duan-outsider@test.local",
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{ user_id: string; already_member: boolean }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(outsiderId);
    expect(rows[0].already_member).toBe(false);
  });

  it("đã là thành viên thì already_member = true", async () => {
    const { data } = await owner.rpc("project_lookup_invitee", {
      p_project_id: projectId,
      p_email: "duan-dev@test.local",
    });
    expect(((data ?? []) as Array<{ already_member: boolean }>)[0].already_member).toBe(true);
  });

  it("developer và người ngoài KHÔNG tra cứu được người để mời", async () => {
    for (const client of [developer, outsider]) {
      const { error } = await client.rpc("project_lookup_invitee", {
        p_project_id: projectId,
        p_email: "duan-dev@test.local",
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("Chỉ owner");
    }
  });

  it("ký tự đại diện không liệt kê được người dùng", async () => {
    const { data } = await owner.rpc("project_lookup_invitee", {
      p_project_id: projectId,
      p_email: "%",
    });
    expect(data).toEqual([]);
  });

  it("không mất được owner cuối cùng", async () => {
    const { error } = await owner.rpc("set_project_member", {
      p_project_id: projectId,
      p_user_id: ownerId,
      p_role: null,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("owner cuối cùng");
  });

  it("profiles_select KHÔNG bị nới: developer vẫn không đọc được hồ sơ người ngoài", async () => {
    const { data } = await developer.from("profiles").select("id").eq("id", outsiderId);
    expect(data).toEqual([]);
  });
});

/* ------------------------------------------------------------------ công việc */

describe("công việc và cách ly giữa dự án", () => {
  it("owner tạo công việc và giao cho developer", async () => {
    const { data, error } = await owner
      .from("project_tasks")
      .insert({
        project_id: projectId,
        stage_id: stages[0].id,
        title: "E2E-TEST thu thập dữ liệu ô đo",
        assignee_id: developerId,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    taskId = (data as { id: string }).id;
  });

  it("developer đổi trạng thái công việc", async () => {
    const { error } = await developer
      .from("project_tasks")
      .update({ status: "in_progress" })
      .eq("id", taskId);
    expect(error).toBeNull();

    const { data } = await developer.from("project_tasks").select("status").eq("id", taskId).single();
    expect((data as { status: string }).status).toBe("in_progress");
  });

  it("KHÔNG giao được việc cho viewer", async () => {
    const { error } = await owner
      .from("project_tasks")
      .insert({
        project_id: projectId,
        stage_id: stages[0].id,
        title: "E2E-TEST giao cho viewer",
        assignee_id: viewerId,
      });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("assignee_role");
  });

  it("KHÔNG giao được việc cho người ngoài dự án", async () => {
    const { error } = await owner.from("project_tasks").insert({
      project_id: projectId,
      stage_id: stages[0].id,
      title: "E2E-TEST giao cho người ngoài",
      assignee_id: outsiderId,
    });
    expect(error).not.toBeNull();
  });

  it("công việc KHÔNG nhảy được sang stage của dự án khác", async () => {
    const { data: otherStages } = await owner
      .from("project_stages")
      .select("id")
      .eq("project_id", otherProjectId)
      .order("ordinal")
      .limit(1);
    const foreignStage = (otherStages as Array<{ id: string }>)[0].id;

    const { error } = await owner
      .from("project_tasks")
      .update({ stage_id: foreignStage })
      .eq("id", taskId);
    expect(error).not.toBeNull();
  });

  it("công việc KHÔNG đổi được project_id — chặn ở quyền cột", async () => {
    const { error } = await owner
      .from("project_tasks")
      .update({ project_id: otherProjectId })
      .eq("id", taskId);
    expect(error).not.toBeNull();

    const { data } = await owner.from("project_tasks").select("project_id").eq("id", taskId).single();
    expect((data as { project_id: string }).project_id).toBe(projectId);
  });

  it("viewer KHÔNG ghi được công việc", async () => {
    const inserted = await viewer.from("project_tasks").insert({
      project_id: projectId,
      stage_id: stages[0].id,
      title: "E2E-TEST viewer thử ghi",
    });
    expect(inserted.error).not.toBeNull();

    await viewer.from("project_tasks").update({ title: "viewer sửa" }).eq("id", taskId);
    const { data } = await owner.from("project_tasks").select("title").eq("id", taskId).single();
    expect((data as { title: string }).title).not.toBe("viewer sửa");
  });

  it("người ngoài dự án đọc rỗng và ghi bị chặn", async () => {
    const { data: projects } = await outsider.from("projects").select("id").eq("id", projectId);
    expect(projects).toEqual([]);

    const { data: tasks } = await outsider.from("project_tasks").select("id").eq("id", taskId);
    expect(tasks).toEqual([]);

    const { error } = await outsider.from("project_tasks").insert({
      project_id: projectId,
      stage_id: stages[0].id,
      title: "E2E-TEST người ngoài thử ghi",
    });
    expect(error).not.toBeNull();
  });

  it("người ngoài KHÔNG tự thêm mình làm thành viên", async () => {
    const direct = await outsider
      .from("project_members")
      .insert({ project_id: projectId, user_id: outsiderId, role: "owner" });
    expect(direct.error).not.toBeNull();

    const viaRpc = await outsider.rpc("set_project_member", {
      p_project_id: projectId,
      p_user_id: outsiderId,
      p_role: "owner",
    });
    expect(viaRpc.error).not.toBeNull();
  });

  it("developer KHÔNG xoá được dự án, kể cả xoá mềm", async () => {
    const hard = await developer.from("projects").delete().eq("id", projectId);
    expect(hard.error).not.toBeNull();

    await developer.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", projectId);
    const { data } = await owner.from("projects").select("deleted_at").eq("id", projectId).single();
    expect((data as { deleted_at: string | null }).deleted_at).toBeNull();
  });
});

/* ------------------------------------------------------------------ bước 3–7 */

describe("chọn và khoá Standard rồi Methodology", () => {
  it("chọn Standard VCS rồi khoá", async () => {
    const { data: standardsRows } = await owner.from("standards").select("id, code").eq("code", "VCS");
    standardId = (standardsRows as Array<{ id: string }>)[0].id;

    const { error } = await owner
      .from("projects")
      .update({ standard_id: standardId, standard_locked_at: new Date().toISOString() })
      .eq("id", projectId);
    expect(error).toBeNull();
  });

  it("Standard đã khoá thì không đổi được nữa", async () => {
    const { data: gs } = await owner.from("standards").select("id").eq("code", "GS").single();
    const { error } = await owner
      .from("projects")
      .update({ standard_id: (gs as { id: string }).id })
      .eq("id", projectId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("Standard đã khóa");
  });

  it("chỉ chọn được Methodology đã published THUỘC Standard đã khoá", async () => {
    const { data: wrong } = await owner
      .from("methodologies")
      .select("id, code, standard_id")
      .eq("code", "DEMO-GS-BIOGAS")
      .single();

    const rejected = await owner
      .from("projects")
      .update({ methodology_id: (wrong as { id: string }).id })
      .eq("id", projectId);
    expect(rejected.error).not.toBeNull();

    const { data: right } = await owner
      .from("methodologies")
      .select("id")
      .eq("code", "DEMO-VCS-FOREST")
      .single();
    methodologyId = (right as { id: string }).id;

    const { error } = await owner
      .from("projects")
      .update({ methodology_id: methodologyId, methodology_locked_at: new Date().toISOString() })
      .eq("id", projectId);
    expect(error).toBeNull();
  });

  it("viewer KHÔNG đổi được lựa chọn của dự án", async () => {
    await viewer.from("projects").update({ description: "viewer sửa" }).eq("id", projectId);
    const { data } = await owner.from("projects").select("description").eq("id", projectId).single();
    expect((data as { description: string }).description).not.toBe("viewer sửa");
  });
});

describe("baseline và duyệt bảy bước", () => {
  it("baseline chỉ bị kiểm HÌNH DẠNG lúc ghi, không kiểm nội dung", async () => {
    // Phát hiện của bước 7: `projects.baseline` chỉ có `check (jsonb_typeof = 'object')`.
    // Giá trị sai kiểu (số thay vì chuỗi canonical cho field `decimal`) VẪN lưu được —
    // cố ý, để lưu bản nháp. Nội dung được kiểm ở hai cổng, xem hai ca ngay dưới.
    const rejectedShape = await owner
      .from("projects")
      .update({ baseline: [] })
      .eq("id", projectId);
    expect(rejectedShape.error).not.toBeNull();

    const { error } = await owner
      .from("projects")
      .update({ baseline: { baseline_stock_tc_ha: 42 } })
      .eq("id", projectId);
    expect(error).toBeNull();
  });

  it("lưu baseline làm baseline_revision tăng", async () => {
    const before = await owner.from("projects").select("baseline_revision").eq("id", projectId).single();
    const { error } = await owner
      .from("projects")
      .update({ baseline: { baseline_stock_tc_ha: "sai-kieu" } })
      .eq("id", projectId);
    expect(error).toBeNull();

    const after = await owner.from("projects").select("baseline_revision").eq("id", projectId).single();
    expect((after.data as { baseline_revision: number }).baseline_revision).toBeGreaterThan(
      (before.data as { baseline_revision: number }).baseline_revision,
    );
  });

  it("không duyệt nhảy cóc: bước 3 khi bước 1 chưa duyệt thì bị từ chối", async () => {
    const { error } = await owner.rpc("approve_project_stage", {
      p_project_id: projectId,
      p_ordinal: 3,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("Cần duyệt các stage trước");
  });

  it("developer KHÔNG duyệt được bước", async () => {
    const { error } = await developer.rpc("approve_project_stage", {
      p_project_id: projectId,
      p_ordinal: 1,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("Chỉ owner");
  });

  it("bốn bước đầu duyệt được dù baseline còn sai", async () => {
    for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
      const { error } = await owner.rpc("approve_project_stage", {
        p_project_id: projectId,
        p_ordinal: ordinal,
      });
      expect(error, `bước ${ordinal}`).toBeNull();
    }
  });

  it("CỔNG 1 — bước 5 từ chối baseline sai nội dung", async () => {
    const { error } = await owner.rpc("approve_project_stage", {
      p_project_id: projectId,
      p_ordinal: 5,
    });
    expect(error).not.toBeNull();
  });

  it("sửa baseline hợp lệ rồi duyệt nốt ba bước còn lại", async () => {
    const fixed = await owner
      .from("projects")
      .update({ baseline: { baseline_stock_tc_ha: "42.5" } })
      .eq("id", projectId);
    expect(fixed.error).toBeNull();

    for (let ordinal = 5; ordinal <= 7; ordinal += 1) {
      const { error } = await owner.rpc("approve_project_stage", {
        p_project_id: projectId,
        p_ordinal: ordinal,
      });
      expect(error, `bước ${ordinal}`).toBeNull();
    }

    const { data } = await owner
      .from("project_stages")
      .select("ordinal, approved_at, approved_by")
      .eq("project_id", projectId)
      .order("ordinal");
    const rows = data as Array<{ approved_at: string | null; approved_by: string | null }>;
    expect(rows.every((r) => r.approved_at !== null)).toBe(true);
    expect(rows.every((r) => r.approved_by === ownerId)).toBe(true);
  });
});

/* ------------------------------------------------------------------ giám sát */

describe("kỳ giám sát, nhập số liệu và khoá kỳ", () => {
  it("developer KHÔNG tạo được kỳ giám sát", async () => {
    const { error } = await developer.rpc("create_monitoring_period", {
      p_project_id: projectId,
      p_name: "E2E-TEST kỳ của developer",
      p_start_date: "2026-01-01",
      p_end_date: "2026-06-30",
      p_version: 1,
    });
    expect(error).not.toBeNull();
  });

  it("CỔNG 2 — tạo kỳ giám sát cũng từ chối baseline sai nội dung", async () => {
    const broken = await owner
      .from("projects")
      .update({ baseline: { baseline_stock_tc_ha: 42 } })
      .eq("id", projectId);
    expect(broken.error).toBeNull();

    const { error } = await owner.rpc("create_monitoring_period", {
      p_project_id: projectId,
      p_name: `E2E-TEST kỳ hỏng ${RUN}`,
      p_start_date: "2026-01-01",
      p_end_date: "2026-06-30",
      p_version: 99,
    });
    expect(error).not.toBeNull();

    const restored = await owner
      .from("projects")
      .update({ baseline: { baseline_stock_tc_ha: "42.5" } })
      .eq("id", projectId);
    expect(restored.error).toBeNull();
  });

  it("owner tạo kỳ và kỳ chụp lại lược đồ, baseline, hệ số", async () => {
    const { data, error } = await owner.rpc("create_monitoring_period", {
      p_project_id: projectId,
      p_name: `E2E-TEST kỳ ${RUN}`,
      p_start_date: "2026-01-01",
      p_end_date: "2026-06-30",
      p_version: 1,
    });
    expect(error).toBeNull();
    periodId = data as string;

    const { data: period } = await owner
      .from("monitoring_periods")
      .select("status, schema_snapshot, baseline_snapshot, factors_snapshot, data_revision, schema_hash")
      .eq("id", periodId)
      .single();
    const row = period as Record<string, unknown>;
    expect(row.status).toBe("open");
    expect(row.data_revision).toBe(0);
    expect(row.baseline_snapshot).toEqual({ baseline_stock_tc_ha: "42.5" });
    expect(Array.isArray(row.factors_snapshot)).toBe(true);
    expect(typeof row.schema_hash).toBe("string");
  });

  it("developer nhập một quan sát bằng tay", async () => {
    const { error } = await developer.rpc("save_monitoring_records", {
      p_period_id: periodId,
      p_records: [
        {
          record_key: "O-001",
          observed_on: "2026-02-10",
          values: { area_ha: "1.5", plot_code: "P1", stock_tc_ha: "60.0" },
          raw_input: {},
          source_row: null,
        },
      ],
      p_expected_revision: 0,
    });
    expect(error).toBeNull();

    const { data } = await developer
      .from("monitoring_data")
      .select("record_key, revision")
      .eq("period_id", periodId);
    expect(data).toHaveLength(1);
    expect((data as Array<{ revision: number }>)[0].revision).toBe(1);
  });

  it("revision sai bị từ chối — chống ghi đè lẫn nhau", async () => {
    const { error } = await developer.rpc("save_monitoring_records", {
      p_period_id: periodId,
      p_records: [
        {
          record_key: "O-999",
          observed_on: "2026-02-11",
          values: { area_ha: "1", plot_code: "P9", stock_tc_ha: "1" },
          raw_input: {},
          source_row: null,
        },
      ],
      p_expected_revision: 0,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("revision");
  });

  it("quan sát ngoài khoảng ngày của kỳ bị từ chối", async () => {
    const { error } = await developer.rpc("save_monitoring_records", {
      p_period_id: periodId,
      p_records: [
        {
          record_key: "O-OUT",
          observed_on: "2027-01-01",
          values: { area_ha: "1", plot_code: "PX", stock_tc_ha: "1" },
          raw_input: {},
          source_row: null,
        },
      ],
      p_expected_revision: 1,
    });
    expect(error).not.toBeNull();
  });

  it("viewer KHÔNG nhập được số liệu", async () => {
    const { error } = await viewer.rpc("save_monitoring_records", {
      p_period_id: periodId,
      p_records: [
        {
          record_key: "O-V",
          observed_on: "2026-02-12",
          values: { area_ha: "1", plot_code: "PV", stock_tc_ha: "1" },
          raw_input: {},
          source_row: null,
        },
      ],
      p_expected_revision: 1,
    });
    expect(error).not.toBeNull();
  });

  it("nhập từ CSV qua đúng đường mà server action dùng", async () => {
    const csv = [
      "record_key,observed_on,plot_code,area_ha,stock_tc_ha",
      "O-002,2026-03-01,P2,2.25,58.5",
      "O-003,2026-03-02,P3,3.0,61.25",
    ].join("\n");

    const { data: period } = await owner
      .from("monitoring_periods")
      .select("schema_snapshot, data_revision")
      .eq("id", periodId)
      .single();
    const snapshot = (period as { schema_snapshot: unknown }).schema_snapshot;
    const revision = (period as { data_revision: number }).data_revision;

    const records = prepareImportRecords(snapshot, parseCSV(csv, ","), { scope: "observation" });
    expect(records).toHaveLength(2);

    const { error } = await developer.rpc("save_monitoring_records", {
      p_period_id: periodId,
      p_records: records,
      p_expected_revision: revision,
      p_mapping: { source: "csv", options: { scope: "observation" } },
    });
    expect(error).toBeNull();

    const { data } = await developer
      .from("monitoring_data")
      .select("record_key")
      .eq("period_id", periodId)
      .order("record_key");
    expect((data as Array<{ record_key: string }>).map((r) => r.record_key)).toEqual([
      "O-001",
      "O-002",
      "O-003",
    ]);
  });

  it("CSV có một dòng sai thì KHÔNG dòng nào được nhập", async () => {
    const csv = [
      "record_key,observed_on,plot_code,area_ha,stock_tc_ha",
      "O-004,2026-03-03,P4,4.0,50.0",
      "O-005,2026-03-04,P5,không-phải-số,50.0",
    ].join("\n");

    const { data: before } = await owner
      .from("monitoring_data")
      .select("record_key")
      .eq("period_id", periodId);

    const { data: periodRow } = await owner
      .from("monitoring_periods")
      .select("schema_snapshot")
      .eq("id", periodId)
      .single();

    expect(() =>
      prepareImportRecords(
        (periodRow as { schema_snapshot: unknown }).schema_snapshot,
        parseCSV(csv, ","),
        { scope: "observation" },
      ),
    ).toThrow();

    const { data: after } = await owner
      .from("monitoring_data")
      .select("record_key")
      .eq("period_id", periodId);
    expect(after).toHaveLength((before as unknown[]).length);
  });

  it("owner khoá kỳ và dữ liệu được đóng băng vào data_snapshot", async () => {
    const { data: period } = await owner
      .from("monitoring_periods")
      .select("data_revision")
      .eq("id", periodId)
      .single();

    const { error } = await owner.rpc("lock_monitoring_period", {
      p_period_id: periodId,
      p_expected_revision: (period as { data_revision: number }).data_revision,
    });
    expect(error).toBeNull();

    const { data: locked } = await owner
      .from("monitoring_periods")
      .select("status, locked_at, data_snapshot")
      .eq("id", periodId)
      .single();
    const row = locked as { status: string; locked_at: string | null; data_snapshot: unknown[] };
    expect(row.status).toBe("locked");
    expect(row.locked_at).not.toBeNull();
    expect(row.data_snapshot).toHaveLength(3);
  });

  it("kỳ đã khoá KHÔNG ghi thêm và KHÔNG xoá được quan sát", async () => {
    const write = await developer.rpc("save_monitoring_records", {
      p_period_id: periodId,
      p_records: [
        {
          record_key: "O-006",
          observed_on: "2026-04-01",
          values: { area_ha: "1", plot_code: "P6", stock_tc_ha: "1" },
          raw_input: {},
          source_row: null,
        },
      ],
      p_expected_revision: 3,
    });
    expect(write.error).not.toBeNull();

    const remove = await developer.rpc("delete_monitoring_record", {
      p_period_id: periodId,
      p_record_key: "O-001",
      p_expected_revision: 3,
    });
    expect(remove.error).not.toBeNull();

    const { data } = await owner.from("monitoring_data").select("record_key").eq("period_id", periodId);
    expect(data).toHaveLength(3);
  });
});

/* ------------------------------------------------------------------ báo cáo MRV */

/**
 * `create_mrv_report` được cấp CHỈ cho `service_role` (`0013:994-995`) vì nó nhận
 * `p_requested_by` như tham số. Thiếu `SUPABASE_SERVICE_ROLE_KEY` thì đường ghi báo cáo
 * không tồn tại — bộ test bỏ qua kèm lý do thay vì giả lập bằng khoá khác.
 */
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

describe("sinh báo cáo MRV", () => {
  it("người dùng thường KHÔNG gọi được create_mrv_report — đúng thiết kế", async () => {
    const { data: templates } = await owner
      .from("report_templates")
      .select("id")
      .eq("methodology_id", methodologyId)
      .limit(1);
    templateId = (templates as Array<{ id: string }>)[0].id;

    const { error } = await owner.rpc("create_mrv_report", {
      p_period_id: periodId,
      p_template_id: templateId,
      p_results: {},
      p_trace: {},
      p_engine_version: "e2e",
      p_requested_by: ownerId,
      p_status: "preview",
    });
    expect(error).not.toBeNull();
  });

  it.skipIf(!serviceKey)(
    "backend sinh được báo cáo preview từ kỳ đã khoá",
    async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const { estimateMrvReport } = await import("@/lib/mrv/report");
      const { readFileSync } = await import("node:fs");

      const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
      const url = raw
        .split("\n")
        .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="))!
        .split("=")[1]
        .trim();
      const service = createClient(url, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: period } = await owner
        .from("monitoring_periods")
        .select("*")
        .eq("id", periodId)
        .single();
      const { data: rows } = await owner
        .from("monitoring_data")
        .select("*")
        .eq("period_id", periodId)
        .order("record_key");

      const estimate = estimateMrvReport(
        period as never,
        rows as never,
        "estimated_change_tco2e",
      );
      expect(estimate.status).toBe("preview");

      const { data, error } = await service.rpc("create_mrv_report", {
        p_period_id: periodId,
        p_template_id: templateId,
        p_results: estimate.results,
        p_trace: estimate.calculation_trace,
        p_engine_version: estimate.engine_version,
        p_requested_by: ownerId,
        p_status: "preview",
      });
      expect(error).toBeNull();
      expect(typeof data).toBe("string");

      const { data: report } = await owner
        .from("mrv_reports")
        .select("status, data_revision, schema_hash, results")
        .eq("id", data as string)
        .single();
      expect((report as { status: string }).status).toBe("preview");
    },
  );

  it.skipIf(!serviceKey)("dữ liệu MẪU chưa thẩm định KHÔNG xuất được bản final", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    const url = raw
      .split("\n")
      .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="))!
      .split("=")[1]
      .trim();
    const service = createClient(url, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await service.rpc("create_mrv_report", {
      p_period_id: periodId,
      p_template_id: templateId,
      p_results: {},
      p_trace: {},
      p_engine_version: "e2e",
      p_requested_by: ownerId,
      p_status: "final",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("Final cần methodology");
  });
});

/* ------------------------------------------------------------------ dọn dẹp */

describe("dọn dẹp", () => {
  it("gỡ được thành viên phụ và xoá mềm dự án", async () => {
    // Gỡ liên kết assignee trước, vì khoá ngoại ba cột chặn việc đổi vai trò/gỡ thành
    // viên còn đang được giao việc (`0013:131-132`).
    await owner.from("project_tasks").update({ assignee_id: null }).eq("id", taskId);

    for (const userId of [developerId, viewerId]) {
      const { error } = await owner.rpc("set_project_member", {
        p_project_id: projectId,
        p_user_id: userId,
        p_role: null,
      });
      expect(error).toBeNull();
    }

    await owner.from("project_tasks").delete().eq("id", taskId);

    for (const id of [projectId, otherProjectId]) {
      const { error } = await owner
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      expect(error).toBeNull();
    }
  });

  it("xoá cứng dự án bị chặn — dữ liệu test ở lại, có nhãn E2E-TEST", async () => {
    const { error } = await owner.from("projects").delete().eq("id", projectId);
    expect(error).not.toBeNull();

    const { data } = await owner
      .from("projects")
      .select("name, deleted_at")
      .eq("id", projectId)
      .single();
    expect((data as { name: string }).name).toContain("E2E-TEST-");
    expect((data as { deleted_at: string | null }).deleted_at).not.toBeNull();
  });
});
