import { existsSync, readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const PASSWORD = "MatKhau12345";
const RUN = Date.now().toString().slice(-9);
const SUPPORT_PROJECT_NAME = `E2E-TEST-${RUN} phiên hỗ trợ`;
const HIDDEN_PROJECT_NAME = `E2E-TEST-${RUN} chưa mở hỗ trợ`;
const MISSING_PROJECT_ID = "e2e99999-9999-4999-8999-999999999999";

/** Chỉ import helpers sau khi biết cấu hình tồn tại, để thiếu .env.local được skip sạch. */
function hasE2eConfig(): boolean {
  const path = new URL("../../.env.local", import.meta.url);
  if (!existsSync(path)) return false;
  const raw = readFileSync(path, "utf8");
  return /^NEXT_PUBLIC_SUPABASE_URL=.+$/m.test(raw)
    && /^NEXT_PUBLIC_SUPABASE_ANON_KEY=.+$/m.test(raw);
}

type Db = SupabaseClient;

const describeDb = describe.skipIf(!hasE2eConfig());

describeDb("phiên hỗ trợ dự án chỉ đọc (0018)", () => {
  let owner: Db;
  let outsider: Db;
  let admin: Db;
  let ownerId: string;
  let projectId: string;
  let hiddenProjectId: string;
  let taskId: string;
  let supportSessionId: string;

  beforeAll(async () => {
    const { signedIn } = await import("./helpers");
    owner = await signedIn("duan-owner@test.local", PASSWORD) as Db;
    outsider = await signedIn("duan-outsider@test.local", PASSWORD) as Db;

    ownerId = (await owner.auth.getUser()).data.user!.id;

    const created = await owner.rpc("create_project", {
      p_name: SUPPORT_PROJECT_NAME,
      p_description: "Dữ liệu kiểm thử quyền đọc của phiên hỗ trợ.",
    });
    expect(created.error).toBeNull();
    projectId = created.data as string;

    const hidden = await owner.rpc("create_project", {
      p_name: HIDDEN_PROJECT_NAME,
      p_description: "Admin không mở phiên cho dự án này.",
    });
    expect(hidden.error).toBeNull();
    hiddenProjectId = hidden.data as string;

    const firstStage = await owner
      .from("project_stages")
      .select("id")
      .eq("project_id", projectId)
      .eq("ordinal", 1)
      .single();
    const task = await owner
      .from("project_tasks")
      .insert({
        project_id: projectId,
        stage_id: (firstStage.data as { id: string }).id,
        title: "E2E-TEST dữ liệu con cho phiên hỗ trợ",
      })
      .select("id")
      .single();
    expect(task.error).toBeNull();
    taskId = (task.data as { id: string }).id;

    const approved = await owner.rpc("approve_project_stage", {
      p_project_id: projectId,
      p_ordinal: 1,
    });
    expect(approved.error).toBeNull();

    /*
     * Kiểm migration trước khi đăng nhập fixture admin mới. Nhờ vậy lượt TDD hiện tại
     * đỏ đúng vì function/bảng 0018 chưa tồn tại, thay vì đỏ sớm vì seed tài khoản thứ
     * năm cũng chưa được người vận hành áp. Sau khi có 0018, fixture admin là bắt buộc.
     */
    const functionProbe = await outsider.rpc("begin_project_support", {
      p_project_id: projectId,
      p_reason: "Kiểm tra migration hỗ trợ",
      p_duration_minutes: 30,
    });
    const tableProbe = await outsider.from("project_support_sessions").select("id").limit(1);
    if (functionProbe.error?.message.includes("begin_project_support")
      || tableProbe.error?.message.includes("project_support_sessions")) {
      throw new Error([
        `begin_project_support: ${functionProbe.error?.message ?? "đã tồn tại"}`,
        `project_support_sessions: ${tableProbe.error?.message ?? "đã tồn tại"}`,
      ].join("\n"));
    }

    admin = await signedIn("duan-admin@test.local", PASSWORD) as Db;
  });

  describe("mở phiên", () => {
    it("admin mở phiên 30 phút với lý do hợp lệ và nhận id cùng hạn dùng", async () => {
      const { data, error } = await admin.rpc("begin_project_support", {
        p_project_id: projectId,
        p_reason: "Điều tra lỗi hiển thị của khách hàng",
        p_duration_minutes: 30,
      });
      expect(error).toBeNull();
      const rows = data as Array<{ support_session_id: string; expires_at: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0].support_session_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(new Date(rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
      supportSessionId = rows[0].support_session_id;
    });

    it("từ chối lý do chỉ có 9 ký tự", async () => {
      const { error } = await admin.rpc("begin_project_support", {
        p_project_id: projectId,
        p_reason: "123456789",
        p_duration_minutes: 30,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("10");
    });

    it("từ chối thời hạn 61 phút", async () => {
      const { error } = await admin.rpc("begin_project_support", {
        p_project_id: projectId,
        p_reason: "Lý do đủ dài để kiểm thử",
        p_duration_minutes: 61,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("5 đến 60");
    });

    it("từ chối thời hạn 4 phút", async () => {
      const { error } = await admin.rpc("begin_project_support", {
        p_project_id: projectId,
        p_reason: "Lý do đủ dài để kiểm thử",
        p_duration_minutes: 4,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("5 đến 60");
    });

    it("từ chối UUID dự án không tồn tại", async () => {
      const { error } = await admin.rpc("begin_project_support", {
        p_project_id: MISSING_PROJECT_ID,
        p_reason: "Điều tra một dự án không tồn tại",
        p_duration_minutes: 30,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("Không tìm thấy dự án");
    });

    it("từ chối tài khoản thường mở phiên hỗ trợ", async () => {
      const { error } = await outsider.rpc("begin_project_support", {
        p_project_id: projectId,
        p_reason: "Người ngoài thử tự mở quyền xem",
        p_duration_minutes: 30,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("Chỉ quản trị nền tảng");
    });
  });

  describe("phiên chỉ cho đọc", () => {
    it("admin có phiên đọc được dự án, thành viên, bảy bước và công việc", async () => {
      const [projects, members, stages, tasks] = await Promise.all([
        admin.from("projects").select("id, name").eq("id", projectId),
        admin.from("project_members").select("user_id, role").eq("project_id", projectId),
        admin.from("project_stages").select("id").eq("project_id", projectId),
        admin.from("project_tasks").select("id").eq("project_id", projectId).eq("id", taskId),
      ]);
      for (const result of [projects, members, stages, tasks]) expect(result.error).toBeNull();
      expect(projects.data).toEqual([{ id: projectId, name: SUPPORT_PROJECT_NAME }]);
      expect(members.data).toHaveLength(1);
      expect(stages.data).toHaveLength(7);
      expect(tasks.data).toEqual([{ id: taskId }]);
    });

    it("admin có phiên vẫn không đổi được tên dự án và DB giữ nguyên giá trị", async () => {
      const attempted = await admin
        .from("projects")
        .update({ name: `${SUPPORT_PROJECT_NAME} BỊ SỬA` })
        .eq("id", projectId)
        .select("id");
      expect(attempted.data ?? []).toEqual([]);

      const readBack = await owner.from("projects").select("name").eq("id", projectId).single();
      expect(readBack.error).toBeNull();
      expect((readBack.data as { name: string }).name).toBe(SUPPORT_PROJECT_NAME);
    });

    it("admin không thể INSERT, UPDATE hay DELETE trực tiếp bảng audit", async () => {
      const now = new Date();
      const inserted = await admin.from("project_support_sessions").insert({
        project_id: projectId,
        admin_id: (await admin.auth.getUser()).data.user!.id,
        reason: "Thử chèn trực tiếp vào audit",
        opened_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
      });
      const updated = await admin
        .from("project_support_sessions")
        .update({ reason: "Thử sửa trực tiếp bản ghi audit" })
        .eq("id", supportSessionId);
      const deleted = await admin
        .from("project_support_sessions")
        .delete()
        .eq("id", supportSessionId);
      expect(inserted.error).not.toBeNull();
      expect(updated.error).not.toBeNull();
      expect(deleted.error).not.toBeNull();
    });

    it("tài khoản thường không nhìn thấy audit dù phiên đã tồn tại", async () => {
      const { data, error } = await outsider
        .from("project_support_sessions")
        .select("id")
        .eq("id", supportSessionId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("ngoài cửa sổ hỗ trợ", () => {
    it("admin không có phiên cho một dự án thì SELECT trả tập rỗng", async () => {
      const { data, error } = await admin.from("projects").select("id").eq("id", hiddenProjectId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
      // Không giả lập hết hạn: fixture chỉ dùng anon client, không dùng service role để
      // chèn audit. Dự án chưa từng mở phiên chứng minh cùng nhánh helper trả null.
    });
  });

  /**
   * Ba ca về `project_stage_approval_directory` đã bỏ: 0028 gỡ hàm đó cùng cả tính năng
   * duyệt. Ca dưới đây canh việc gỡ, để danh bạ người duyệt không lặng lẽ sống lại.
   */
  it("RPC danh bạ người duyệt không còn tồn tại", async () => {
    const { error } = await owner.rpc("project_stage_approval_directory", {
      p_project_id: projectId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/function|not find|schema cache/i);
  });
});
