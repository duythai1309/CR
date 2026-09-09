import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Profile } from "@/lib/auth";
import {
  parseMetricSchema,
  validateValues,
  type MetricField,
  type MetricSchema,
} from "@/lib/methodology/schema";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * Chuỗi do model sinh ra đi thẳng vào bộ lọc của PostgREST. Với `.ilike()` thì
 * tham số được đóng gói an toàn, nhưng `.or()` nhận cả một biểu thức dạng chuỗi —
 * dấu phẩy và ngoặc trong đó sẽ bẻ cú pháp bộ lọc. Cắt sạch trước khi ghép.
 */
const safeFilterTerm = (s: string): string => s.replace(/[,()%*\\"']/g, " ").trim();

/**
 * Bỏ từ phân loại đứng đầu tên riêng trước khi đem đi tìm.
 *
 * Người hỏi nói "dự án Rừng ngập mặn Cà Mau" theo đúng lối nói tự nhiên, và model chép
 * nguyên cụm đó vào tham số. Tìm kiếm dùng `ilike '%...%'` nên cụm thừa một chữ là
 * không khớp gì cả — dự án tên "Rừng ngập mặn Cà Mau" không bao giờ tìm ra bằng chuỗi
 * "Dự án Rừng ngập mặn Cà Mau".
 *
 * Chỉ cắt từ đứng ĐẦU. Cố ý không cắt "rừng", "điện", "biogas"… vì đó là một phần tên
 * thật của dự án.
 */
const CLASSIFIER = /^(dự\s+án|phương\s+pháp\s+luận|methodology|standard|bước)\s+/i;

export function tenRieng(raw: string): string {
  let s = raw.trim();
  // Lặp vì người ta hay nói chồng: "dự án dự án Cà Mau".
  for (let i = 0; i < 2 && CLASSIFIER.test(s); i++) s = s.replace(CLASSIFIER, "").trim();
  return s || raw.trim();
}

const num = (v: unknown): number => Number(v ?? 0);

function fail(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message);
}

/**
 * Cửa ép kiểu DUY NHẤT của tệp này.
 *
 * `src/types/database.ts` sinh từ cơ sở dữ liệu thật và chưa thể sinh lại (mục C9 trong
 * `docs/design/schema-review-findings.md`: phải áp 0013–0015 lên DB trước, mà việc đó
 * chưa được phép). Truy vấn vẫn chạy bằng phiên của người dùng nên RLS là thứ quyết định
 * thấy gì — ép kiểu ở đây chỉ mất kiểm tra tên cột lúc biên dịch, không mở thêm quyền.
 *
 * KHÔNG dùng service role ở bất kỳ đâu trong tệp này.
 */
const projectTables = (supabase: Client): SupabaseClient =>
  supabase as unknown as SupabaseClient;

type Db = SupabaseClient;

/* ------------------------------------------------------------------ hình dạng bảng */

interface ProjectRow {
  id: string;
  name: string;
  description?: string;
  deleted_at: string | null;
  standard_id: string | null;
  methodology_id: string | null;
  standard_locked_at?: string | null;
  methodology_locked_at?: string | null;
  baseline?: unknown;
  baseline_revision?: number;
  updated_at?: string;
}
interface MemberRow {
  project_id?: string;
  user_id: string;
  role: string;
}
interface StageRow {
  project_id?: string;
  ordinal: number;
  title: string;
  approved_at: string | null;
  approved_by?: string | null;
}
interface TaskRow {
  id?: string;
  stage_id: string;
  title?: string;
  status: string;
  assignee_id: string | null;
  due_at: string | null;
  position?: number;
}
interface MethodologyRow {
  id: string;
  standard_id: string;
  code: string;
  version: string;
  name: string;
  project_type: string;
  is_sample: boolean;
  professionally_validated: boolean;
  disclaimer: string;
  metric_schema?: unknown;
  schema_hash?: string;
}
interface StandardRow {
  id: string;
  code: string;
  name?: string;
}
interface PeriodRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  version: number;
  data_revision: number;
  locked_at?: string | null;
}
interface ReportRow {
  id?: string;
  period_id?: string;
  methodology_id?: string;
  standard_id?: string;
  version: number;
  status: string;
  schema_hash?: string;
  data_revision?: number;
  baseline_revision?: number;
  engine_version?: string;
  calculation_trace?: unknown;
  generated_at: string;
  results?: { estimated_credit?: { value?: string; unit?: string } };
}
interface MonitoringDataRow {
  period_id?: string;
  record_key: string;
  observed_on?: string;
  metric_values: unknown;
  revision?: number;
  entered_by?: string;
  updated_at?: string;
}
interface DocumentRow {
  id: string;
  stage_id: string;
  file_id: string;
  kind: string;
  version: number;
  created_at: string;
}
interface FileRow {
  id: string;
  original_name: string;
  uploaded_by?: string;
  created_at?: string;
}

const PROJECT_COLUMNS =
  "id, name, description, deleted_at, standard_id, methodology_id, " +
  "standard_locked_at, methodology_locked_at, baseline, baseline_revision, updated_at";

const METHODOLOGY_COLUMNS =
  "id, standard_id, code, version, name, project_type, is_sample, " +
  "professionally_validated, disclaimer, schema_hash";

const TASK_STATUS_VI: Record<string, string> = {
  todo: "chưa làm",
  in_progress: "đang làm",
  done: "xong",
  blocked: "vướng",
};

const OPEN_STATUSES = ["todo", "in_progress", "blocked"];

/**
 * Cảnh báo bắt buộc kèm theo mọi lần nhắc tới catalog methodology.
 *
 * Bốn methodology trong hệ thống do nhóm tự soạn (`0014_project_platform_samples.sql`),
 * `is_sample = true` và `professionally_validated = false`. Trợ lý tư vấn cho người làm
 * hồ sơ tín chỉ thật, nên câu này đi kèm dữ liệu chứ không phó mặc cho model nhớ.
 */
export const CANH_BAO_MAU =
  "Catalog của hệ thống hiện CHỈ có methodology MẪU do nhóm tự soạn, chưa được thẩm " +
  "định chuyên môn và KHÔNG phải methodology được Verra hay Gold Standard công nhận. " +
  "Phải nói rõ điều này mỗi lần nhắc tới chúng, và không được mô tả yêu cầu thật của " +
  "tổ chức chứng nhận nếu dữ liệu không có.";

/* --------------------------------------------------------------------- tiện ích chung */

/**
 * Tìm dự án theo tên trong số dự án mà RLS cho người hỏi thấy.
 *
 * `projects_read` (`0013:887`) chỉ trả dự án mà người hỏi là thành viên, nên không cần
 * và không được lọc thêm theo vai trò toàn cục ở đây. Dự án đã xoá mềm vẫn đọc được
 * nhưng không bao giờ được chọn làm mặc định — người hỏi "dự án của tôi" không có ý
 * nói tới thùng rác.
 */
async function resolveProject(db: Db, name: string | null): Promise<ProjectRow | null> {
  let q = db
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (name) q = q.ilike("name", `%${safeFilterTerm(tenRieng(name))}%`);

  const { data, error } = await q;
  fail(error);
  const rows = (data ?? []) as unknown as ProjectRow[];
  return rows.find((p) => p.deleted_at === null) ?? rows[0] ?? null;
}

const khongTimThayDuAn = (name: string | null) => ({
  khong_tim_thay: name
    ? `Không có dự án nào khớp "${name}" trong số dự án của người hỏi.`
    : "Người hỏi chưa là thành viên của dự án carbon nào.",
});

/** Methodology mà một dự án đang chọn; `null` khi dự án chưa chọn. */
async function loadMethodology(db: Db, id: string | null): Promise<MethodologyRow | null> {
  if (!id) return null;
  const { data, error } = await db
    .from("methodologies")
    .select(`${METHODOLOGY_COLUMNS}, metric_schema`)
    .eq("id", id)
    .limit(1);
  fail(error);
  return ((data ?? []) as unknown as MethodologyRow[])[0] ?? null;
}

/**
 * `metric_schema` đọc từ DB là JSON tự do; đưa qua đúng bộ parse mà form nhập liệu và
 * bộ tính dùng, để trợ lý không mô tả một lược đồ mà hệ thống thật sẽ từ chối.
 */
function parseSchema(value: unknown): MetricSchema | null {
  try {
    return parseMetricSchema(value);
  } catch {
    return null;
  }
}

const fieldLabel = (f: MetricField): string =>
  f.label.vi ?? Object.values(f.label)[0] ?? f.id;

const describeField = (f: MetricField) => ({
  ma: f.id,
  ten: fieldLabel(f),
  kieu: f.type,
  don_vi: f.unit === "1" ? null : f.unit,
  bat_buoc: f.required,
  bat_buoc_neu: f.required_if
    ? `khi field '${f.required_if.field}' bằng ${JSON.stringify(f.required_if.equals)}`
    : null,
  gia_tri_cho_phep: f.options?.map((o) => ({
    ma: o.value,
    ten: o.label.vi ?? Object.values(o.label)[0] ?? o.value,
  })),
  rang_buoc: f.validation ?? null,
  ten_cot_khi_nhap_csv: f.import?.aliases ?? [],
});

/** Thông điệp lỗi của `validateValues` là tiếng Anh kỹ thuật; dịch trước khi đưa model. */
const LOI_VI: Record<string, string> = {
  "Required field": "Bắt buộc nhưng chưa nhập",
  "Unknown field or wrong scope": "Không thuộc lược đồ, hoặc nhầm nhóm baseline/observation",
  "Expected values object": "Baseline phải là một object",
  "Expected canonical decimal string": "Phải là số thập phân dạng chuỗi, ví dụ \"12.5\"",
  "Expected safe integer": "Phải là số nguyên",
  "Below minimum": "Nhỏ hơn giá trị nhỏ nhất cho phép",
  "Above maximum": "Lớn hơn giá trị lớn nhất cho phép",
  "Below exclusive minimum": "Phải lớn hơn hẳn cận dưới",
  "Exceeds precision scale": "Nhiều chữ số thập phân hơn mức cho phép",
  "Expected boolean": "Phải là đúng/sai",
  "Invalid ISO date": "Ngày phải theo dạng YYYY-MM-DD",
  "Unknown enum code": "Không nằm trong danh sách giá trị cho phép",
};

/**
 * Đối chiếu baseline của dự án với lược đồ của methodology đã chọn.
 *
 * Dùng chung cho `kiem_tra_baseline` và cho điều kiện bước ≥ 5 của `yeu_cau_cua_buoc`,
 * để hai công cụ không bao giờ nói ngược nhau.
 */
function checkBaseline(
  schema: MetricSchema | null,
  baseline: unknown,
): { ok: boolean; loi: Array<{ field: string; ten: string; van_de: string }> } | null {
  if (!schema) return null;
  const byId = new Map(schema.fields.map((f) => [f.id, f]));
  const errors = validateValues(schema, baseline ?? {}, "baseline").map((e) => ({
    field: e.field,
    ten: e.field ? (byId.has(e.field) ? fieldLabel(byId.get(e.field)!) : e.field) : "—",
    van_de: LOI_VI[e.message] ?? e.message,
  }));
  return { ok: errors.length === 0, loi: errors };
}

/** Danh bạ thành viên qua RPC `project_member_directory` (`0015_project_identity.sql`). */
async function memberNames(db: Db, projectId: string): Promise<Map<string, string>> {
  const { data } = await db.rpc("project_member_directory", { p_project_id: projectId });
  const names = new Map<string, string>();
  if (!Array.isArray(data)) return names;
  for (const row of data as Array<Record<string, unknown>>)
    if (typeof row.user_id === "string" && typeof row.full_name === "string")
      names.set(row.user_id, row.full_name);
  return names;
}

async function resolvePeriod(
  db: Db,
  projectId: string,
  name: string | null,
  version: number | null,
): Promise<PeriodRow & { schema_snapshot?: unknown; schema_hash?: string; locked_at?: string | null } | null> {
  let query = db
    .from("monitoring_periods")
    .select("id, name, start_date, end_date, status, version, data_revision, locked_at, schema_snapshot, schema_hash")
    .eq("project_id", projectId)
    .order("start_date", { ascending: false })
    .order("version", { ascending: false })
    .limit(20);
  if (name) query = query.ilike("name", `%${safeFilterTerm(name)}%`);
  if (version !== null) query = query.eq("version", version);
  const { data, error } = await query;
  fail(error);
  return ((data ?? []) as unknown as Array<PeriodRow & {
    schema_snapshot?: unknown;
    schema_hash?: string;
    locked_at?: string | null;
  }>)[0] ?? null;
}

const periodStatus = (status: string): string => status === "locked" ? "đã khoá" : "đang mở";
const reportStatus = (status: string): string => status === "final" ? "final" : "preview";

function estimatedCredit(results: ReportRow["results"]): { value: string | null; unit: string | null } {
  const estimate = results?.estimated_credit;
  return {
    value: typeof estimate?.value === "string" ? estimate.value : null,
    unit: typeof estimate?.unit === "string" ? estimate.unit : null,
  };
}

/**
 * Điều kiện duyệt một bước, chép đúng theo `approve_project_stage`
 * (`0013_project_platform.sql:696-714`) — nguồn sự thật duy nhất.
 *
 * Cố ý KHÔNG mô tả quy trình chuẩn của Verra hay Gold Standard: hệ thống này không
 * cưỡng chế những thứ đó, và nói ra là bịa yêu cầu cho người làm hồ sơ thật.
 */
function stageConditions(
  ordinal: number,
  project: ProjectRow,
  stages: StageRow[],
  baseline: ReturnType<typeof checkBaseline>,
): Array<{ dieu_kien: string; dat: boolean; cach_lam: string }> {
  const chuaDuyetTruoc = stages
    .filter((s) => s.ordinal < ordinal && s.approved_at === null)
    .map((s) => `${s.ordinal}. ${s.title}`);

  const conditions = [
    {
      dieu_kien: "Các bước trước đã duyệt hết",
      dat: chuaDuyetTruoc.length === 0,
      cach_lam:
        chuaDuyetTruoc.length === 0
          ? "Đã đạt."
          : `Còn phải duyệt trước: ${chuaDuyetTruoc.join(", ")}.`,
    },
  ];

  if (ordinal >= 3)
    conditions.push({
      dieu_kien: "Đã KHOÁ Standard",
      dat: Boolean(project.standard_locked_at),
      cach_lam:
        "Chọn rồi bấm khoá Standard ở /du-an/[id]/quy-trinh. Khoá là một chiều, " +
        "không đổi lại được.",
    });

  if (ordinal >= 4)
    conditions.push({
      dieu_kien: "Đã KHOÁ Methodology",
      dat: Boolean(project.methodology_locked_at),
      cach_lam:
        "Chọn Methodology thuộc Standard đã khoá rồi bấm khoá, cũng ở " +
        "/du-an/[id]/quy-trinh. Khoá là một chiều.",
    });

  if (ordinal >= 5)
    conditions.push({
      dieu_kien: "Baseline hợp lệ theo metric_schema của Methodology đã chọn",
      dat: baseline?.ok === true,
      cach_lam:
        baseline === null
          ? "Chưa đọc được lược đồ của methodology nên chưa kiểm được baseline."
          : baseline.ok
            ? "Đã đạt."
            : `Còn ${baseline.loi.length} field chưa đạt — gọi kiem_tra_baseline để xem từng cái.`,
    });

  return conditions;
}

/* ------------------------------------------------------------------------- công cụ */

export const HANDLERS: Record<string, (ctx: ToolContext, args: Args) => Promise<unknown>> = {
  async liet_ke_du_an({ supabase, profile }) {
    const db = projectTables(supabase);

    const { data: projects, error } = await db
      .from("projects")
      .select(PROJECT_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(MAX_ROWS_PER_TOOL);
    fail(error);

    const rows = (projects ?? []) as unknown as ProjectRow[];
    if (rows.length === 0)
      return { du_an: [], ghi_chu: "Người hỏi chưa là thành viên của dự án carbon nào." };

    const [{ data: members }, { data: stages }, { data: standards }, { data: methodologies }] =
      await Promise.all([
        db.from("project_members").select("project_id, user_id, role"),
        db.from("project_stages").select("project_id, approved_at"),
        db.from("standards").select("id, code"),
        db.from("methodologies").select(METHODOLOGY_COLUMNS),
      ]);

    const memberCount = new Map<string, number>();
    for (const m of (members ?? []) as MemberRow[]) {
      if (m.project_id === undefined) continue;
      memberCount.set(m.project_id, (memberCount.get(m.project_id) ?? 0) + 1);
    }

    const approved = new Map<string, number>();
    for (const st of (stages ?? []) as StageRow[])
      if (st.approved_at && st.project_id)
        approved.set(st.project_id, (approved.get(st.project_id) ?? 0) + 1);

    const standardCode = new Map<string, string>(
      ((standards ?? []) as StandardRow[]).map((x) => [x.id, x.code]),
    );
    const methodology = new Map<string, MethodologyRow>(
      ((methodologies ?? []) as unknown as MethodologyRow[]).map((x) => [x.id, x]),
    );

    return {
      du_an: rows.map((p) => {
        const m = p.methodology_id ? methodology.get(p.methodology_id) : null;
        return {
          ten: p.name,
          mo_ta: p.description || null,
          buoc_da_duyet: `${approved.get(p.id) ?? 0}/7`,
          so_thanh_vien: memberCount.get(p.id) ?? null,
          standard: p.standard_id ? (standardCode.get(p.standard_id) ?? null) : null,
          standard_da_khoa: Boolean(p.standard_locked_at),
          methodology: m ? `${m.code} · ${m.version}` : null,
          methodology_da_khoa: Boolean(p.methodology_locked_at),
          loai_hinh: m?.project_type ?? null,
          methodology_la_du_lieu_mau: m ? m.is_sample : null,
          cap_nhat_gan_nhat: p.updated_at ?? null,
          da_xoa: p.deleted_at !== null,
        };
      }),
      ghi_chu:
        "'buoc_da_duyet' đếm trên bảy bước thiết kế cố định. " + CANH_BAO_MAU,
    };
  },

  async tien_do_du_an({ supabase, profile }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);

    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);

    const [
      { data: stageRows },
      { data: tasks },
      { data: periods },
      { data: reports },
    ] = await Promise.all([
      db
        .from("project_stages")
        .select("ordinal, title, approved_at, approved_by")
        .eq("project_id", project.id),
      db
        .from("project_tasks")
        .select("stage_id, status, assignee_id, due_at")
        .eq("project_id", project.id)
        .limit(MAX_ROWS_FOR_AGGREGATE),
      db
        .from("monitoring_periods")
        .select("id, name, start_date, end_date, status, version, data_revision, locked_at")
        .eq("project_id", project.id)
        .order("start_date", { ascending: false })
        .limit(MAX_ROWS_PER_TOOL),
      db
        .from("mrv_reports")
        .select("version, status, results, generated_at")
        .eq("project_id", project.id)
        .order("generated_at", { ascending: false })
        .limit(1),
    ]);

    const byStatus: Record<string, number> = {};
    for (const t of (tasks ?? []) as TaskRow[]) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

    const stages = ((stageRows ?? []) as StageRow[])
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal);

    const names = await memberNames(db, project.id);

    const methodology = await loadMethodology(db, project.methodology_id ?? null);
    const baseline = checkBaseline(parseSchema(methodology?.metric_schema), project.baseline);

    const next = stages.find((s) => s.approved_at === null) ?? null;

    const latest = ((reports ?? []) as ReportRow[])[0];
    const credit = latest?.results?.estimated_credit;

    return {
      du_an: project.name,
      da_xoa: project.deleted_at !== null,
      standard_da_khoa: Boolean(project.standard_locked_at),
      methodology_da_khoa: Boolean(project.methodology_locked_at),
      methodology: methodology ? `${methodology.code} · ${methodology.version}` : null,
      methodology_la_du_lieu_mau: methodology ? methodology.is_sample : null,
      bay_buoc: stages.map((st) => ({
        buoc: st.ordinal,
        ten: st.title,
        da_duyet: st.approved_at !== null,
        duyet_luc: st.approved_at,
        nguoi_duyet: st.approved_by ? (names.get(st.approved_by) ?? null) : null,
      })),
      buoc_ke_tiep: next
        ? {
            buoc: next.ordinal,
            ten: next.title,
            dieu_kien: stageConditions(next.ordinal, project, stages, baseline),
          }
        : null,
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
        "thẩm định độc lập và không phải tín chỉ đã được phát hành. " +
        CANH_BAO_MAU,
    };
  },

  async yeu_cau_cua_buoc({ supabase, profile }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);

    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);

    const { data: stageRows } = await db
      .from("project_stages")
      .select("ordinal, title, approved_at, approved_by")
      .eq("project_id", project.id);

    const stages = ((stageRows ?? []) as StageRow[]).slice().sort((a, b) => a.ordinal - b.ordinal);

    const raw = args.buoc;
    const wanted = raw === null || raw === undefined || raw === "" ? null : Math.trunc(num(raw));
    if (wanted !== null && (!Number.isFinite(wanted) || wanted < 1 || wanted > 7))
      return {
        tham_so_sai:
          "Dự án chỉ có bảy bước thiết kế cố định, đánh số 1 đến 7. Không có bước nào khác.",
      };

    const stage =
      wanted !== null
        ? (stages.find((s) => s.ordinal === wanted) ?? null)
        : (stages.find((s) => s.approved_at === null) ?? null);

    if (!stage)
      return wanted !== null
        ? { khong_tim_thay: `Dự án "${project.name}" không có bước ${wanted}.` }
        : {
            du_an: project.name,
            da_xong: true,
            ghi_chu:
              "Cả bảy bước thiết kế đã duyệt xong. Bước tiếp theo là giám sát và báo cáo MRV.",
          };

    const methodology = await loadMethodology(db, project.methodology_id ?? null);
    const baseline = checkBaseline(parseSchema(methodology?.metric_schema), project.baseline);

    const conditions = stageConditions(stage.ordinal, project, stages, baseline);

    return {
      du_an: project.name,
      buoc: stage.ordinal,
      ten_buoc: stage.title,
      da_duyet: stage.approved_at !== null,
      duyet_luc: stage.approved_at,
      dieu_kien: conditions,
      con_vuong: conditions.filter((c) => !c.dat).map((c) => c.dieu_kien),
      ai_duyet_duoc: "Mọi thành viên của dự án.",
      ghi_chu:
        "Danh sách điều kiện này là ĐÚNG luật mà cơ sở dữ liệu áp khi duyệt bước " +
        "(hàm approve_project_stage), không phải quy trình chung của ngành hay yêu cầu " +
        "của Verra/Gold Standard. Ngoài các điều kiện trên, hệ thống không cưỡng chế gì " +
        "thêm — đừng suy diễn thêm điều kiện nào không có ở đây.",
    };
  },

  async goi_y_methodology({ supabase }, args) {
    const db = projectTables(supabase);

    const [{ data: methodologies, error }, { data: standards }] = await Promise.all([
      db
        .from("methodologies")
        .select(`${METHODOLOGY_COLUMNS}, metric_schema`)
        .order("code")
        .limit(MAX_ROWS_PER_TOOL),
      db.from("standards").select("id, code, name"),
    ]);
    fail(error);

    const standard = new Map<string, StandardRow>(
      ((standards ?? []) as StandardRow[]).map((s) => [s.id, s]),
    );

    const rows = (methodologies ?? []) as unknown as MethodologyRow[];
    const keyword = str(args.mo_ta)?.toLowerCase() ?? null;

    // Khớp từng TỪ của mô tả, không khớp cả câu: người hỏi viết "dự án trồng rừng ngập
    // mặn", catalog ghi "afolu" và "MẪU VCS — thay đổi trữ lượng carbon rừng".
    const terms = keyword
      ? keyword.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3)
      : [];

    const matched = terms.length
      ? rows.filter((m) => {
          const haystack = [
            m.code,
            m.name,
            m.project_type,
            standard.get(m.standard_id)?.code ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return terms.some((t) => haystack.includes(t));
        })
      : rows;

    return {
      tim_theo: keyword,
      khop: matched.map((m) => ({
        methodology_id: m.id,
        standard: standard.get(m.standard_id)?.code ?? null,
        standard_ten: standard.get(m.standard_id)?.name ?? null,
        ma: m.code,
        version: m.version,
        ten: m.name,
        loai_hinh: m.project_type,
        la_du_lieu_mau: m.is_sample,
        da_tham_dinh_chuyen_mon: m.professionally_validated,
        canh_bao: m.disclaimer,
        fields: (parseSchema(m.metric_schema)?.fields ?? []).map((field) => ({
          id: field.id,
          ten: fieldLabel(field),
          scope: field.scope,
          don_vi: field.unit,
          bat_buoc: field.required,
        })),
      })),
      tong_so_trong_catalog: rows.length,
      ghi_chu:
        (matched.length === 0
          ? "Không có methodology nào trong catalog khớp mô tả. Nói thẳng là hệ thống " +
            "chưa có, KHÔNG được gợi ý methodology thật của Verra/Gold Standard từ trí nhớ. "
          : "") + CANH_BAO_MAU,
    };
  },

  async field_giam_sat_cua_methodology({ supabase }, args) {
    const db = projectTables(supabase);
    const code = str(args.ma_methodology);
    const projectName = str(args.ten_du_an);

    let methodology: MethodologyRow | null = null;
    let duAn: string | null = null;

    if (code) {
      const { data, error } = await db
        .from("methodologies")
        .select(`${METHODOLOGY_COLUMNS}, metric_schema`)
        .ilike("code", `%${safeFilterTerm(tenRieng(code))}%`)
        .limit(1);
      fail(error);
      methodology = ((data ?? []) as unknown as MethodologyRow[])[0] ?? null;
      if (!methodology)
        return {
          khong_tim_thay: `Catalog không có methodology nào mã khớp "${code}". ` + CANH_BAO_MAU,
        };
    } else {
      const project = await resolveProject(db, projectName);
      if (!project) return khongTimThayDuAn(projectName);
      duAn = project.name;
      if (!project.methodology_id)
        return {
          du_an: project.name,
          chua_chon_methodology: true,
          ghi_chu:
            "Dự án này chưa chọn Methodology nên chưa có bộ field nào. Chọn ở bước 4, " +
            "màn hình /du-an/[id]/quy-trinh.",
        };
      methodology = await loadMethodology(db, project.methodology_id);
      if (!methodology)
        return { khong_tim_thay: "Không đọc được methodology mà dự án đang chọn." };
    }

    const schema = parseSchema(methodology.metric_schema);
    if (!schema)
      return {
        methodology: `${methodology.code} · ${methodology.version}`,
        loi_luoc_do:
          "Không đọc được metric_schema của methodology này. Nói là chưa tra được, " +
          "không mô tả field theo trí nhớ.",
      };

    const baseline = schema.fields.filter((f) => f.scope === "baseline").map(describeField);
    const observation = schema.fields
      .filter((f) => f.scope === "observation")
      .map(describeField);

    return {
      du_an: duAn,
      methodology: `${methodology.code} · ${methodology.version}`,
      ten: methodology.name,
      standard_id: methodology.standard_id,
      loai_hinh: methodology.project_type,
      la_du_lieu_mau: methodology.is_sample,
      schema_hash: methodology.schema_hash ?? null,
      field_baseline: baseline,
      field_quan_sat: observation,
      dai_luong_tinh_ra: schema.calculations.map((c) => ({
        ma: c.id,
        don_vi: c.unit,
        gop_theo: c.aggregation,
      })),
      he_so_can_co: schema.factor_requirements.map((f) => ({ khoa: f.key, don_vi: f.unit })),
      ghi_chu:
        "'field_baseline' khai MỘT LẦN cho cả dự án ở bước 5; 'field_quan_sat' nhập theo " +
        "từng dòng dữ liệu trong mỗi kỳ giám sát, tay hoặc từ CSV. Tệp CSV cần hai cột " +
        "record_key và observed_on cùng các cột ở 'ten_cot_khi_nhap_csv'. " +
        CANH_BAO_MAU,
    };
  },

  async kiem_tra_baseline({ supabase }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);

    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);

    if (!project.methodology_id)
      return {
        du_an: project.name,
        chua_chon_methodology: true,
        ghi_chu:
          "Chưa chọn Methodology thì chưa có lược đồ để đối chiếu baseline. Chọn ở bước 4.",
      };

    const methodology = await loadMethodology(db, project.methodology_id);
    const schema = parseSchema(methodology?.metric_schema);
    if (!schema)
      return {
        du_an: project.name,
        loi_luoc_do:
          "Không đọc được metric_schema của methodology đang chọn, nên chưa kiểm được " +
          "baseline. Nói là chưa tra được.",
      };

    const result = checkBaseline(schema, project.baseline)!;
    const declared = new Set(
      project.baseline && typeof project.baseline === "object" && !Array.isArray(project.baseline)
        ? Object.keys(project.baseline as Record<string, unknown>)
        : [],
    );
    const fields = schema.fields.filter((f) => f.scope === "baseline");

    return {
      du_an: project.name,
      methodology: methodology ? `${methodology.code} · ${methodology.version}` : null,
      methodology_la_du_lieu_mau: methodology ? methodology.is_sample : null,
      dat: result.ok,
      so_field_baseline: fields.length,
      so_field_da_nhap: fields.filter((f) => declared.has(f.id)).length,
      ban_sua_baseline: project.baseline_revision ?? null,
      con_thieu_hoac_sai: result.loi,
      ghi_chu:
        (result.ok
          ? "Baseline hiện đủ và hợp lệ theo lược đồ, nên bước 5 duyệt được và tạo được " +
            "kỳ giám sát."
          : "Còn field chưa đạt, nên duyệt bước 5 và tạo kỳ giám sát đều sẽ bị từ chối.") +
        " Đây là kiểm tra KỸ THUẬT theo metric_schema, không phải đánh giá chuyên môn " +
        "xem kịch bản cơ sở có hợp lý hay không — việc đó thuộc về VVB, ngoài phạm vi " +
        "hệ thống. " +
        CANH_BAO_MAU,
    };
  },

  async cong_viec_theo_buoc({ supabase }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);

    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);

    const wanted = str(args.trang_thai);
    if (wanted && !Object.hasOwn(TASK_STATUS_VI, wanted))
      return {
        tham_so_sai:
          "Trạng thái công việc chỉ có todo, in_progress, done, blocked.",
      };

    const [{ data: stageRows }, { data: taskRows, error }] = await Promise.all([
      db.from("project_stages").select("id, ordinal, title").eq("project_id", project.id),
      db
        .from("project_tasks")
        .select("id, stage_id, title, status, assignee_id, due_at, position")
        .eq("project_id", project.id)
        .limit(MAX_ROWS_FOR_AGGREGATE),
    ]);
    fail(error);

    const names = await memberNames(db, project.id);
    const stages = ((stageRows ?? []) as Array<StageRow & { id: string }>)
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal);

    const all = (taskRows ?? []) as TaskRow[];
    const selected = all.filter((t) =>
      wanted ? t.status === wanted : OPEN_STATUSES.includes(t.status),
    );

    const today = new Date().toISOString().slice(0, 10);
    const shown = selected.slice(0, MAX_ROWS_PER_TOOL);

    return {
      du_an: project.name,
      loc_trang_thai: wanted ?? "chưa xong (todo, in_progress, blocked)",
      tong_cong_viec_cua_du_an: all.length,
      so_viec_khop_bo_loc: selected.length,
      theo_buoc: stages.map((st) => {
        const ofStage = shown.filter((t) => t.stage_id === st.id);
        return {
          buoc: st.ordinal,
          ten_buoc: st.title,
          so_viec: ofStage.length,
          viec: ofStage.map((t) => ({
            tieu_de: t.title ?? "—",
            trang_thai: TASK_STATUS_VI[t.status] ?? t.status,
            han: t.due_at,
            qua_han:
              t.due_at !== null && t.status !== "done" ? t.due_at.slice(0, 10) < today : false,
            giao_cho: t.assignee_id ? (names.get(t.assignee_id) ?? "—") : null,
          })),
        };
      }),
      ghi_chu:
        (selected.length > shown.length
          ? `Chỉ liệt kê ${shown.length} việc đầu trên tổng ${selected.length} việc khớp. `
          : "") +
        "Giao việc được cho bất kỳ thành viên nào của dự án; ràng buộc duy nhất của cơ " +
        "sở dữ liệu là người nhận phải đã ở trong dự án.",
    };
  },

  async liet_ke_ky_giam_sat({ supabase }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);
    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);

    const { data, error } = await db
      .from("monitoring_periods")
      .select("id, name, start_date, end_date, status, version, data_revision, locked_at")
      .eq("project_id", project.id)
      .order("start_date", { ascending: false })
      .order("version", { ascending: false })
      .limit(MAX_ROWS_PER_TOOL);
    fail(error);
    const periods = (data ?? []) as unknown as Array<PeriodRow & { locked_at?: string | null }>;
    const counts = await Promise.all(
      periods.map(async (period) => {
        const result = await db
          .from("monitoring_data")
          .select("id", { count: "exact", head: true })
          .eq("period_id", period.id);
        fail(result.error);
        return result.count ?? null;
      }),
    );

    return {
      du_an: project.name,
      tong_so_ky: periods.length,
      ky_giam_sat: periods.map((period, index) => ({
        ma_ky: period.id,
        ten: period.name,
        tu_ngay: period.start_date,
        den_ngay: period.end_date,
        phien_ban: period.version,
        trang_thai: periodStatus(period.status),
        data_revision: period.data_revision,
        so_ban_ghi: counts[index],
        khoa_luc: period.locked_at ?? null,
        co_the_sinh_bao_cao: period.status === "locked",
      })),
      ghi_chu:
        "Chỉ monitoring period đã khoá mới sinh được MRV report. Khoá kỳ đóng băng " +
        "snapshot; cần sửa dữ liệu thì tạo kỳ version mới, không sửa kỳ cũ.",
    };
  },

  async tom_tat_du_lieu_giam_sat({ supabase, profile }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);
    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);
    const rawVersion = args.phien_ban_ky;
    const version = rawVersion === undefined || rawVersion === null || rawVersion === ""
      ? null
      : Math.trunc(num(rawVersion));
    if (version !== null && (!Number.isFinite(version) || version < 1))
      return { tham_so_sai: "phien_ban_ky phải là số nguyên dương." };
    const period = await resolvePeriod(db, project.id, str(args.ten_ky), version);
    if (!period)
      return { khong_tim_thay: "Không có monitoring period nào khớp trong dự án này." };

    const { data: recordRows, error } = await db
      .from("monitoring_data")
      .select("period_id, record_key, observed_on, metric_values, revision, entered_by, updated_at")
      .eq("period_id", period.id)
      .order("updated_at", { ascending: false })
      .limit(MAX_ROWS_FOR_AGGREGATE + 1);
    fail(error);
    const allRows = (recordRows ?? []) as unknown as MonitoringDataRow[];
    const truncated = allRows.length > MAX_ROWS_FOR_AGGREGATE;
    const rows = allRows.slice(0, MAX_ROWS_FOR_AGGREGATE);
    const schema = parseSchema(period.schema_snapshot);
    const names = await memberNames(db, project.id);
    const errors: Array<{ record_key: string; field: string; van_de: string }> = [];
    if (schema)
      for (const row of rows)
        for (const issue of validateValues(schema, row.metric_values, "observation"))
          errors.push({
            record_key: row.record_key,
            field: issue.field,
            van_de: LOI_VI[issue.message] ?? issue.message,
          });
    const errorCounts = new Map<string, number>();
    for (const issue of errors)
      errorCounts.set(issue.field || "(toàn dòng)", (errorCounts.get(issue.field || "(toàn dòng)") ?? 0) + 1);
    const dbBlockers: string[] = [];
    if (project.deleted_at) dbBlockers.push("Dự án đã xoá mềm");
    if (period.status !== "open") dbBlockers.push("Kỳ không còn ở trạng thái open");
    if (rows.length === 0) dbBlockers.push("Kỳ chưa có dữ liệu");
    const qualityWarnings: string[] = [];
    if (!schema) qualityWarnings.push("Không parse được schema_snapshot nên chưa kiểm được field");
    if (errors.length > 0) qualityWarnings.push(`${errors.length} lỗi field trên các record đã đọc`);
    if (truncated) qualityWarnings.push(`Chỉ kiểm ${MAX_ROWS_FOR_AGGREGATE} record đầu; chưa thể kết luận phần còn lại`);

    return {
      du_an: project.name,
      ky: {
        ma_ky: period.id,
        ten: period.name,
        phien_ban: period.version,
        tu_ngay: period.start_date,
        den_ngay: period.end_date,
        trang_thai: periodStatus(period.status),
        data_revision: period.data_revision,
        schema_hash: period.schema_hash ?? null,
      },
      so_ban_ghi_da_doc: rows.length,
      da_doc_het: !truncated,
      loi_theo_field: [...errorCounts].map(([field, count]) => ({ field, so_record: count })),
      chi_tiet_loi: errors.slice(0, MAX_ROWS_PER_TOOL),
      du_lieu_gan_nhat: rows.slice(0, 5).map((row) => ({
        record_key: row.record_key,
        observed_on: row.observed_on ?? null,
        revision: row.revision ?? null,
        nguoi_nhap: row.entered_by ? (names.get(row.entered_by) ?? row.entered_by) : null,
        cap_nhat_luc: row.updated_at ?? null,
      })),
      blocker_do_db_thuc_su_cuong_che: dbBlockers,
      co_the_goi_rpc_khoa_ky: dbBlockers.length === 0,
      canh_bao_chat_luong_du_lieu: qualityWarnings,
      ghi_chu:
        "RPC lock_monitoring_period hiện cưỡng chế: project còn hoạt động, người gọi là " +
        "owner, kỳ open, expected data_revision khớp và có ít nhất một record. Lỗi field " +
        "là cảnh báo chất lượng trước khi khoá, KHÔNG được nói sai rằng DB đang chặn nếu " +
        "RPC chưa có rule đó. Dùng data_revision hiện tại làm expected revision.",
    };
  },

  async liet_ke_bao_cao_mrv({ supabase }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);
    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);
    const [reportResult, periodResult, methodologyResult, standardResult] =
      await Promise.all([
        db
          .from("mrv_reports")
          .select("id, period_id, methodology_id, standard_id, version, status, schema_hash, data_revision, baseline_revision, engine_version, generated_at, results")
          .eq("project_id", project.id)
          .order("generated_at", { ascending: false })
          .limit(MAX_ROWS_PER_TOOL),
        db.from("monitoring_periods").select("id, name, start_date, end_date").eq("project_id", project.id),
        db.from("methodologies").select(METHODOLOGY_COLUMNS),
        db.from("standards").select("id, code, name"),
      ]);
    fail(reportResult.error);
    fail(periodResult.error);
    fail(methodologyResult.error);
    fail(standardResult.error);
    const reports = reportResult.data;
    const periods = periodResult.data;
    const methodologies = methodologyResult.data;
    const standards = standardResult.data;
    const periodById = new Map(
      ((periods ?? []) as Array<{ id: string; name: string; start_date: string; end_date: string }>).map((p) => [p.id, p]),
    );
    const methodologyById = new Map(
      ((methodologies ?? []) as unknown as MethodologyRow[]).map((methodology) => [methodology.id, methodology]),
    );
    const standardById = new Map(((standards ?? []) as StandardRow[]).map((standard) => [standard.id, standard]));
    const rows = (reports ?? []) as unknown as ReportRow[];

    return {
      du_an: project.name,
      tong_so_bao_cao: rows.length,
      bao_cao: rows.map((report) => {
        const period = report.period_id ? periodById.get(report.period_id) : null;
        const methodology = report.methodology_id ? methodologyById.get(report.methodology_id) : null;
        const estimate = estimatedCredit(report.results);
        return {
          ma_bao_cao: report.id ?? null,
          ky: period?.name ?? null,
          khoang_ngay: period ? `${period.start_date} → ${period.end_date}` : null,
          phien_ban: report.version,
          trang_thai: reportStatus(report.status),
          uoc_tinh: estimate.value,
          don_vi: estimate.unit,
          standard: report.standard_id ? (standardById.get(report.standard_id)?.code ?? null) : null,
          methodology: methodology ? `${methodology.code} · ${methodology.version}` : null,
          methodology_la_du_lieu_mau: methodology?.is_sample ?? null,
          schema_hash: report.schema_hash ?? null,
          data_revision: report.data_revision ?? null,
          baseline_revision: report.baseline_revision ?? null,
          engine_version: report.engine_version ?? null,
          sinh_luc: report.generated_at,
        };
      }),
      ghi_chu:
        "Mọi giá trị là ƯỚC TÍNH MRV lưu trong report snapshot, chưa qua verification và " +
        "KHÔNG phải tín chỉ đã phát hành. " +
        (rows.some((report) => report.methodology_id && methodologyById.get(report.methodology_id)?.is_sample)
          ? CANH_BAO_MAU
          : "Không suy diễn trạng thái verification/issuance vì DB không lưu các bước đó."),
    };
  },

  async doc_vet_tinh_bao_cao({ supabase }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);
    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);
    const rawVersion = args.phien_ban_bao_cao;
    const version = rawVersion === undefined || rawVersion === null || rawVersion === ""
      ? null
      : Math.trunc(num(rawVersion));
    if (version !== null && (!Number.isFinite(version) || version < 1))
      return { tham_so_sai: "phien_ban_bao_cao phải là số nguyên dương." };
    const wantedPeriod = str(args.ten_ky);
    const period = wantedPeriod ? await resolvePeriod(db, project.id, wantedPeriod, null) : null;
    if (wantedPeriod && !period) return { khong_tim_thay: `Không có kỳ nào khớp "${wantedPeriod}".` };

    let query = db
      .from("mrv_reports")
      .select("id, period_id, methodology_id, standard_id, version, status, schema_hash, data_revision, baseline_revision, engine_version, generated_at, results, calculation_trace")
      .eq("project_id", project.id)
      .order("generated_at", { ascending: false })
      .limit(10);
    if (version !== null) query = query.eq("version", version);
    if (period) query = query.eq("period_id", period.id);
    const { data, error } = await query;
    fail(error);
    const report = ((data ?? []) as unknown as ReportRow[])[0];
    if (!report) return { khong_tim_thay: "Không có MRV report nào khớp." };
    const [methodology, standard, sourcePeriod] = await Promise.all([
      loadMethodology(db, report.methodology_id ?? null),
      report.standard_id
        ? db.from("standards").select("id, code, name").eq("id", report.standard_id).limit(1)
        : Promise.resolve({ data: [], error: null }),
      report.period_id ? (async () => {
        const result = await db
          .from("monitoring_periods")
          .select("id, name, start_date, end_date, status, version, data_revision")
          .eq("id", report.period_id)
          .limit(1);
        fail(result.error);
        return ((result.data ?? []) as unknown as PeriodRow[])[0] ?? null;
      })() : Promise.resolve(null),
    ]);
    fail(standard.error);
    const standardRow = ((standard.data ?? []) as StandardRow[])[0] ?? null;
    const trace = isRecord(report.calculation_trace) ? report.calculation_trace : {};
    const traceRecords = Array.isArray(trace.records) ? trace.records : [];
    const estimate = estimatedCredit(report.results);

    return {
      du_an: project.name,
      bao_cao: {
        ma_bao_cao: report.id ?? null,
        ky: sourcePeriod?.name ?? null,
        phien_ban: report.version,
        trang_thai: reportStatus(report.status),
        uoc_tinh: estimate.value,
        don_vi: estimate.unit,
        standard: standardRow?.code ?? null,
        methodology: methodology ? `${methodology.code} · ${methodology.version}` : null,
        methodology_la_du_lieu_mau: methodology?.is_sample ?? null,
        schema_hash: report.schema_hash ?? null,
        data_revision: report.data_revision ?? null,
        baseline_revision: report.baseline_revision ?? null,
        engine_version: report.engine_version ?? null,
        sinh_luc: report.generated_at,
      },
      lap_luan_tinh_toan: {
        thu_tu: Array.isArray(trace.order) ? trace.order : [],
        precision_digits: trace.precision_digits ?? null,
        rounding: trace.rounding ?? null,
        output_scale: trace.output_scale ?? null,
        operations: trace.operations ?? null,
        tung_quan_sat: traceRecords.slice(0, MAX_ROWS_PER_TOOL),
        aggregation: Array.isArray(trace.aggregation) ? trace.aggregation : [],
        tong_so_quan_sat_trong_trace: traceRecords.length,
        trace_bi_cat: traceRecords.length > MAX_ROWS_PER_TOOL,
      },
      cach_dien_giai:
        "Đọc theo thứ tự: factors và source → calculation nodes của từng observation → " +
        "aggregation toàn kỳ. Giữ nguyên chuỗi số engine trả về; không tự tính lại hoặc " +
        "làm tròn thêm.",
      ghi_chu:
        "Đây là vết của ƯỚC TÍNH MRV, không phải bằng chứng verification hay tín chỉ đã " +
        "phát hành. " + (methodology?.is_sample ? CANH_BAO_MAU : ""),
    };
  },

  async thanh_vien_va_phan_cong({ supabase }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);
    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);
    const [{ data: directory, error: directoryError }, { data: tasks, error }] = await Promise.all([
      db.rpc("project_member_directory", { p_project_id: project.id }),
      db
        .from("project_tasks")
        .select("id, stage_id, title, status, assignee_id, due_at, position")
        .eq("project_id", project.id)
        .limit(MAX_ROWS_FOR_AGGREGATE + 1),
    ]);
    fail(directoryError);
    fail(error);
    const members = Array.isArray(directory) ? directory as Array<Record<string, unknown>> : [];
    const allTasks = (tasks ?? []) as TaskRow[];
    const truncated = allTasks.length > MAX_ROWS_FOR_AGGREGATE;
    const rows = allTasks.slice(0, MAX_ROWS_FOR_AGGREGATE);
    const open = rows.filter((task) => OPEN_STATUSES.includes(task.status));

    return {
      du_an: project.name,
      thanh_vien: members.map((member) => {
        const userId = typeof member.user_id === "string" ? member.user_id : "";
        const assigned = open.filter((task) => task.assignee_id === userId);
        return {
          user_id: userId,
          ho_ten: typeof member.full_name === "string" ? member.full_name : "—",
          email: typeof member.email === "string" ? member.email : null,
          so_viec_dang_mo: assigned.length,
          viec_dang_mo: assigned.slice(0, MAX_ROWS_PER_TOOL).map((task) => ({
            tieu_de: task.title ?? "—",
            trang_thai: TASK_STATUS_VI[task.status] ?? task.status,
            han: task.due_at,
          })),
        };
      }),
      viec_chua_giao: open.filter((task) => !task.assignee_id).map((task) => task.title ?? "—").slice(0, MAX_ROWS_PER_TOOL),
      da_doc_het_cong_viec: !truncated,
      ghi_chu:
        "Danh tính lấy qua project_member_directory. Email chỉ được RPC trả cho owner; " +
        "null không có nghĩa là thành viên không có email. Chỉ developer được nhận việc.",
    };
  },

  async tai_lieu_theo_buoc({ supabase }, args) {
    const db = projectTables(supabase);
    const name = str(args.ten_du_an);
    const project = await resolveProject(db, name);
    if (!project) return khongTimThayDuAn(name);
    const rawOrdinal = args.buoc;
    const ordinal = rawOrdinal === undefined || rawOrdinal === null || rawOrdinal === ""
      ? null
      : Math.trunc(num(rawOrdinal));
    if (ordinal !== null && (!Number.isFinite(ordinal) || ordinal < 1 || ordinal > 7))
      return { tham_so_sai: "buoc phải là số nguyên từ 1 đến 7." };
    const [stageResult, documentResult, fileResult] = await Promise.all([
      db.from("project_stages").select("id, ordinal, title, approved_at").eq("project_id", project.id),
      db
        .from("project_documents")
        .select("id, stage_id, file_id, kind, version, created_at")
        .eq("project_id", project.id)
        .limit(MAX_ROWS_FOR_AGGREGATE),
      db
        .from("project_files")
        .select("id, original_name, uploaded_by, created_at")
        .eq("project_id", project.id)
        .limit(MAX_ROWS_FOR_AGGREGATE),
    ]);
    fail(stageResult.error);
    fail(documentResult.error);
    fail(fileResult.error);
    const stages = stageResult.data;
    const documents = documentResult.data;
    const files = fileResult.data;
    const fileById = new Map(((files ?? []) as FileRow[]).map((file) => [file.id, file]));
    const docs = (documents ?? []) as DocumentRow[];
    const selectedStages = ((stages ?? []) as Array<StageRow & { id: string }>).filter(
      (stage) => ordinal === null || stage.ordinal === ordinal,
    ).sort((a, b) => a.ordinal - b.ordinal);
    return {
      du_an: project.name,
      theo_buoc: selectedStages.map((stage) => ({
        buoc: stage.ordinal,
        ten_buoc: stage.title,
        da_duyet: stage.approved_at !== null,
        tai_lieu: docs.filter((doc) => doc.stage_id === stage.id).map((doc) => ({
          kind: doc.kind,
          phien_ban: doc.version,
          ten_tep: fileById.get(doc.file_id)?.original_name ?? null,
          nop_luc: doc.created_at,
          file_id: doc.file_id,
        })),
      })),
      checklist_bat_buoc_theo_db: [],
      ket_luan_ve_tai_lieu_thieu:
        "DB hiện không có checklist loại tài liệu bắt buộc theo từng bước và " +
        "approve_project_stage cũng không kiểm project_documents. Vì vậy công cụ chỉ " +
        "liệt kê cái đã nộp, không được suy diễn cái còn thiếu theo Standard.",
    };
  },

  async liet_ke_standard({ supabase }) {
    const db = projectTables(supabase);
    const [standardResult, methodologyResult] = await Promise.all([
      db.from("standards").select("id, code, name").order("code").limit(MAX_ROWS_PER_TOOL),
      db.from("methodologies").select(METHODOLOGY_COLUMNS).limit(MAX_ROWS_FOR_AGGREGATE),
    ]);
    fail(standardResult.error);
    fail(methodologyResult.error);
    const standards = standardResult.data;
    const methodologies = methodologyResult.data;
    const methods = (methodologies ?? []) as unknown as MethodologyRow[];
    const rows = (standards ?? []) as StandardRow[];
    return {
      standard: rows.map((standard) => {
        const matching = methods.filter((methodology) => methodology.standard_id === standard.id);
        return {
          ma: standard.code,
          ten: standard.name ?? null,
          so_methodology_nhin_thay: matching.length,
          so_methodology_mau: matching.filter((methodology) => methodology.is_sample).length,
        };
      }),
      ghi_chu:
        "Đây chỉ là catalog record mà tài khoản hiện nhìn thấy trong DB, không phải danh " +
        "sách đầy đủ ngoài đời và không mô tả yêu cầu của Standard. " +
        (methods.some((methodology) => methodology.is_sample) ? CANH_BAO_MAU : ""),
    };
  },
};
