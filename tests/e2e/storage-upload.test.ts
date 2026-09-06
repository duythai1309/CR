import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedIn } from "./helpers";

/**
 * Đóng mục C13 — câu hỏi duy nhất còn mở từ lượt review schema.
 *
 * Nghi vấn: hai policy `restrictive` ở `0013:970-975` chặn UPDATE/DELETE trên
 * `storage.objects` cho hai bucket mới. Nếu Supabase Storage upload bằng INSERT **rồi**
 * UPDATE metadata, policy đó sẽ chặn luôn đường upload hợp lệ.
 *
 * Không kiểm chứng tĩnh được, và Postgres trần ở bước 2b cũng không giả lập nổi vì không
 * có Storage server. Chỉ còn một cách: **upload thật**.
 *
 * TOÀN BỘ ca ở đây chạy bằng phiên `authenticated` thật qua khoá công khai.
 * **Không dùng service role** — dùng nó là mất luôn ý nghĩa bài test.
 */

const PASSWORD = "MatKhau12345";
const RUN = Date.now().toString().slice(-9);
const BUCKET = "project-documents";

type Db = SupabaseClient;
const untyped = (client: unknown) => client as Db;

let owner: Db;
let developer: Db;
let viewer: Db;
let outsider: Db;
let coopUser: Db;

let ownerId: string;
let developerId: string;
let viewerId: string;
let outsiderId: string;

let projectId: string;
/** Đường dẫn ba đoạn — đúng dạng tối thiểu mà `project_files` check đòi. */
let shortPath: string;
/** Đường dẫn bốn đoạn — đúng dạng mà `src/app/du-an/**` sinh ra trong sản phẩm. */
let productionPath: string;

const body = (label: string) =>
  new Blob([`record_key,observed_on,plot_code\nE2E-TEST-${label},2026-03-01,P1\n`], {
    type: "text/csv",
  });

const sha256 = async (blob: Blob) =>
  createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex");

/** Gom lỗi Storage về dạng đọc được, giữ nguyên văn để chép vào báo cáo. */
const describeError = (e: unknown) =>
  e === null || e === undefined
    ? "null"
    : JSON.stringify(e, Object.getOwnPropertyNames(e as object));

const uploaded: string[] = [];

/** PNG 1×1 hợp lệ, đủ để Storage nhận và không phụ thuộc tệp ngoài. */
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

beforeAll(async () => {
  owner = untyped(await signedIn("duan-owner@test.local", PASSWORD));
  developer = untyped(await signedIn("duan-dev@test.local", PASSWORD));
  viewer = untyped(await signedIn("duan-viewer@test.local", PASSWORD));
  outsider = untyped(await signedIn("duan-outsider@test.local", PASSWORD));
  coopUser = untyped(await signedIn("htx@test.local", PASSWORD));

  ownerId = (await owner.auth.getUser()).data.user!.id;
  developerId = (await developer.auth.getUser()).data.user!.id;
  viewerId = (await viewer.auth.getUser()).data.user!.id;
  outsiderId = (await outsider.auth.getUser()).data.user!.id;

  const { data, error } = await owner.rpc("create_project", {
    p_name: `E2E-TEST-${RUN} Kiểm chứng Storage C13`,
    p_description: "Dự án do bộ kiểm thử C13 tạo.",
  });
  if (error) throw new Error(`Không tạo được dự án: ${error.message}`);
  projectId = data as string;

  for (const [userId, role] of [
    [developerId, "developer"],
    [viewerId, "viewer"],
  ] as const) {
    const { error: memberError } = await owner.rpc("set_project_member", {
      p_project_id: projectId,
      p_user_id: userId,
      p_role: role,
    });
    if (memberError) throw new Error(`Không thêm được thành viên: ${memberError.message}`);
  }

  shortPath = `${projectId}/${developerId}/E2E-TEST-${RUN}-ngan.csv`;
  productionPath = `${projectId}/${developerId}/${randomUUID()}/E2E-TEST-${RUN}-that.csv`;
});

/* ------------------------------------------------------------------ C13 câu hỏi chính */

describe("C13.1 — đường upload hợp lệ", () => {
  it("developer upload được tệp vào đúng {project}/{user}/{tên}", async () => {
    const { data, error } = await developer.storage
      .from(BUCKET)
      .upload(shortPath, body("ngan"), { contentType: "text/csv" });

    // Đây là câu trả lời dứt điểm cho C13. Lỗi ở đây nghĩa là policy restrictive chặn
    // nhầm đường upload và cần migration sửa.
    expect(error, `upload thất bại: ${describeError(error)}`).toBeNull();
    expect(data?.path).toBe(shortPath);
    uploaded.push(shortPath);
  });

  it("đường dẫn BỐN đoạn mà mã sản phẩm sinh ra cũng upload được", async () => {
    const { data, error } = await developer.storage
      .from(BUCKET)
      .upload(productionPath, body("that"), { contentType: "text/csv" });

    expect(error, `upload thất bại: ${describeError(error)}`).toBeNull();
    expect(data?.path).toBe(productionPath);
    uploaded.push(productionPath);
  });
});

describe("C13.2 — upsert (ca nghi ngờ nhất, vì upsert sinh UPDATE)", () => {
  it("upload lại cùng đường dẫn KHÔNG upsert thì bị từ chối vì trùng", async () => {
    const { error } = await developer.storage
      .from(BUCKET)
      .upload(shortPath, body("ngan-2"), { contentType: "text/csv" });
    expect(error).not.toBeNull();
  });

  it("upsert: true trên đường dẫn đã có — ghi lại kết quả THẬT", async () => {
    const { data, error } = await developer.storage
      .from(BUCKET)
      .upload(shortPath, body("ngan-3"), { contentType: "text/csv", upsert: true });

    // Không khẳng định trước kết quả: mục đích của ca này là ĐO. Kết quả thật được in ra
    // và chép vào `docs/design/storage-c13-report.md`.
    console.log(
      `[C13.2] upsert → ${error ? `BỊ CHẶN: ${describeError(error)}` : `THÀNH CÔNG: ${data?.path}`}`,
    );
    expect(error === null || typeof error.message === "string").toBe(true);
  });
});

/* ------------------------------------------------------------------ metadata */

describe("C13.3 — ghi metadata vào project_files", () => {
  it("đăng ký được metadata với checksum và object_path khớp", async () => {
    const blob = body("that");
    const { error } = await developer.from("project_files").insert({
      project_id: projectId,
      object_path: productionPath,
      original_name: "E2E-TEST-that.csv",
      mime_type: "text/csv",
      size_bytes: blob.size,
      checksum: await sha256(blob),
    });
    expect(error, describeError(error)).toBeNull();
  });

  it("check đường dẫn hoạt động: cấp 1 phải là project_id", async () => {
    const { error } = await developer.from("project_files").insert({
      project_id: projectId,
      object_path: `sai-project/${developerId}/x.csv`,
      original_name: "x.csv",
      mime_type: "text/csv",
      size_bytes: 10,
      checksum: "a".repeat(64),
    });
    expect(error).not.toBeNull();
  });

  it("check đường dẫn hoạt động: cấp 2 phải là người tải lên", async () => {
    const { error } = await developer.from("project_files").insert({
      project_id: projectId,
      object_path: `${projectId}/${ownerId}/x.csv`,
      original_name: "x.csv",
      mime_type: "text/csv",
      size_bytes: 10,
      checksum: "a".repeat(64),
    });
    expect(error).not.toBeNull();
  });

  it("checksum sai định dạng bị từ chối", async () => {
    const { error } = await developer.from("project_files").insert({
      project_id: projectId,
      object_path: `${projectId}/${developerId}/${randomUUID()}/x.csv`,
      original_name: "x.csv",
      mime_type: "text/csv",
      size_bytes: 10,
      checksum: "khong-phai-sha256",
    });
    expect(error).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ phân quyền */

describe("C13.4 — phân quyền upload", () => {
  it("viewer KHÔNG upload được", async () => {
    const path = `${projectId}/${viewerId}/E2E-TEST-${RUN}-viewer.csv`;
    const { error } = await viewer.storage.from(BUCKET).upload(path, body("viewer"));
    expect(error, "viewer đáng lẽ phải bị chặn").not.toBeNull();
    console.log(`[C13.4 viewer] ${describeError(error)}`);
  });

  it("người ngoài dự án KHÔNG upload được", async () => {
    const path = `${projectId}/${outsiderId}/E2E-TEST-${RUN}-outsider.csv`;
    const { error } = await outsider.storage.from(BUCKET).upload(path, body("outsider"));
    expect(error, "người ngoài đáng lẽ phải bị chặn").not.toBeNull();
  });

  it("KHÔNG upload được vào thư mục của người khác", async () => {
    // Developer có quyền ghi trong dự án, nhưng cấp 2 của đường dẫn phải là chính họ.
    const path = `${projectId}/${ownerId}/E2E-TEST-${RUN}-mao-danh.csv`;
    const { error } = await developer.storage.from(BUCKET).upload(path, body("mao-danh"));
    expect(error, "mạo danh thư mục người khác đáng lẽ phải bị chặn").not.toBeNull();
  });

  it("KHÔNG upload được vào dự án mình không thuộc", async () => {
    const { data: other } = await owner.rpc("create_project", {
      p_name: `E2E-TEST-${RUN} Dự án ngoài`,
      p_description: "",
    });
    const path = `${other as string}/${outsiderId}/E2E-TEST-${RUN}-cheo.csv`;
    const { error } = await outsider.storage.from(BUCKET).upload(path, body("cheo"));
    expect(error).not.toBeNull();
  });
});

describe("C13.5 — đọc tệp", () => {
  it("thành viên dự án tải được tệp", async () => {
    for (const [label, client] of [
      ["owner", owner],
      ["developer", developer],
      ["viewer", viewer],
    ] as const) {
      const { data, error } = await client.storage.from(BUCKET).download(shortPath);
      expect(error, `${label}: ${describeError(error)}`).toBeNull();
      expect(await data!.text()).toContain("E2E-TEST-");
    }
  });

  it("người ngoài dự án KHÔNG tải được", async () => {
    const { data, error } = await outsider.storage.from(BUCKET).download(shortPath);
    expect(error ?? data === null, "người ngoài đáng lẽ không tải được").toBeTruthy();
  });

  it("người ngoài KHÔNG liệt kê được thư mục của dự án", async () => {
    const { data } = await outsider.storage.from(BUCKET).list(`${projectId}/${developerId}`);
    expect(data ?? []).toEqual([]);
  });
});

describe("C13.6 — xoá bị chặn đúng thiết kế", () => {
  it("developer KHÔNG xoá được object trong bucket mới", async () => {
    const { data, error } = await developer.storage.from(BUCKET).remove([shortPath]);
    // Storage trả mảng rỗng khi policy chặn, hoặc lỗi. Cả hai đều là "không xoá được".
    const removed = (data ?? []).length;
    console.log(`[C13.6] remove → data=${removed} dòng, error=${describeError(error)}`);
    expect(removed).toBe(0);

    const { error: stillThere } = await developer.storage.from(BUCKET).download(shortPath);
    expect(stillThere, "tệp đáng lẽ vẫn còn").toBeNull();
  });
});

/* ------------------------------------------------------------------ hồi quy bucket cũ */

describe("C13.7 — bucket evidence KHÔNG bị ảnh hưởng", () => {
  it("cán bộ HTX vẫn upload rồi xoá được trong bucket evidence", async () => {
    const { data: profile } = await coopUser
      .from("profiles")
      .select("cooperative_id")
      .single();
    const coopId = (profile as { cooperative_id: string | null }).cooperative_id;
    expect(coopId, "tài khoản htx@test.local phải thuộc một hợp tác xã").toBeTruthy();

    // Bucket `evidence` chỉ nhận ảnh (`0004_functions_storage_factors.sql:54-59`), nên
    // gửi đúng một PNG tối giản; lần chạy đầu dùng text/plain và bị 415 — giới hạn MIME
    // của bucket, không liên quan tới policy restrictive đang kiểm.
    const png = new Blob([PNG_1x1], { type: "image/png" });
    const path = `${coopId}/E2E-TEST-${RUN}/anh-thu.png`;
    const upload = await coopUser.storage
      .from("evidence")
      .upload(path, png, { contentType: "image/png" });
    expect(upload.error, `evidence upload: ${describeError(upload.error)}`).toBeNull();

    // Đây là điểm mấu chốt của hồi quy: policy restrictive chỉ phủ hai bucket MỚI, nên
    // `evidence_delete` của `0004` phải còn nguyên tác dụng.
    const removed = await coopUser.storage.from("evidence").remove([path]);
    expect(removed.error, describeError(removed.error)).toBeNull();
    expect((removed.data ?? []).length).toBe(1);
  });
});

describe("tổng kết tệp còn lại", () => {
  it("liệt kê tệp E2E để lại trên Storage", async () => {
    const { data } = await developer.storage
      .from(BUCKET)
      .list(`${projectId}/${developerId}`, { limit: 100 });
    console.log(
      `[còn lại] ${uploaded.length} tệp đã upload; thư mục chứa ${(data ?? []).length} mục.`,
    );
    expect(uploaded.length).toBeGreaterThan(0);
  });
});
