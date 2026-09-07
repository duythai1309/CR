import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/0018_project_support_and_identity_debt.sql",
);
const sql = readFileSync(migrationPath, "utf8");

function definition(name: string, nextMarker: string): string {
  const plain = sql.indexOf(`create function public.${name}`);
  const replaced = sql.indexOf(`create or replace function public.${name}`);
  const start = plain >= 0 ? plain : replaced;
  const end = sql.indexOf(nextMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("migration 0018 — hợp đồng bảo mật", () => {
  it("không phá bảng/type và không nới profiles_select", () => {
    expect(sql).not.toMatch(/drop\s+(table|type)\b/i);
    expect(sql).not.toMatch(/create\s+policy\s+profiles_select/i);
    expect(sql).not.toMatch(/alter\s+table\s+public\.profiles/i);
  });

  it("RPC lịch sử duyệt chỉ trả năm cột và dùng khuôn SECURITY DEFINER", () => {
    const fn = definition("project_stage_approval_directory", "-- ---------------------------------------------------------------- user_role");
    expect(fn).toContain("stage_id uuid");
    expect(fn).toContain("ordinal smallint");
    expect(fn).toContain("approved_at timestamptz");
    expect(fn).toContain("approved_by uuid");
    expect(fn).toContain("approver_name text");
    expect(fn).toMatch(/security definer set search_path = public/i);
    expect(fn).toContain("left join public.profiles p on p.id = s.approved_by");
  });

  it("phiên support có lý do, hết hạn tối đa 60 phút và client không có quyền ghi audit", () => {
    expect(sql).toContain("length(trim(reason)) between 10 and 1000");
    expect(sql).toContain("expires_at <= opened_at + interval '60 minutes'");
    expect(sql).toContain("grant select on public.project_support_sessions to authenticated");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)[^;]*project_support_sessions/i);
  });

  it("support chỉ được ánh xạ thành viewer; helper ghi vẫn không bị thay", () => {
    const roleFn = sql.slice(
      sql.indexOf("create or replace function public.app_project_role"),
      sql.indexOf("-- Storage 0013"),
    );
    expect(roleFn).toContain("then 'viewer'");
    expect(sql).not.toContain("create or replace function public.app_project_can_write");
  });

  it("không tái tạo enum và đăng ký mới luôn nhận tài khoản không đặc quyền", () => {
    expect(sql).not.toMatch(/create\s+type\s+public\.user_role/i);
    expect(sql).not.toMatch(/alter\s+type\s+public\.user_role/i);
    const signupFn = definition("handle_new_user", "comment on type public.user_role");
    expect(signupFn).toContain("'coop_staff'::public.user_role");
    expect(signupFn).not.toContain("raw_user_meta_data ->> 'role'");
  });

  it("mọi RPC public mới bị thu quyền mặc định rồi chỉ cấp authenticated", () => {
    expect(sql).toMatch(
      /revoke all on function[\s\S]*project_stage_approval_directory\(uuid\)[\s\S]*from public, anon, authenticated, service_role;/i,
    );
    expect(sql).toMatch(
      /grant execute on function[\s\S]*begin_project_support\(uuid, text, integer\)[\s\S]*project_stage_approval_directory\(uuid\)[\s\S]*to authenticated;/i,
    );
  });
});
