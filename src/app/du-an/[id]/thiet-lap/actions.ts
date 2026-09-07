"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { projectClient, requireProjectMember } from "@/lib/auth";
import { loadChatConfig, missingKeyMessage } from "@/lib/chat/settings";
import { HANDLERS } from "@/lib/chat/handlers";
import {
  FEASIBILITY_ASSIST_SYSTEM,
  SELECTION_ASSIST_SYSTEM,
  assertNoForbiddenFeasibilityKeys,
  buildSelectionAdvice,
  catalogFromMethodologyHandler,
  deriveIdeaGaps,
  deriveKnownFacts,
  parseFeasibilityAssist,
  runSetupJsonTurn,
} from "@/lib/chat/setup-assist";
import {
  type ProjectIdea,
  type ProjectSetup,
  type ProjectTypeHint,
} from "@/types/project-setup";
import { getProjectSetupRecord, projectSetupDatabaseError } from "./data";

export type SetupActionResult =
  | { ok: true; message: string; setup: ProjectSetup }
  | { ok: false; message: string };

const PROJECT_TYPES = new Set<ProjectTypeHint>([
  "afolu",
  "energy",
  "biogas",
  "waste",
  "cookstove",
  "other",
]);

const fail = (message: string): SetupActionResult => ({ ok: false, message });

function optionalText(value: unknown, label: string, max = 20_000): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${label} phải là nội dung chữ.`);
  const text = value.trim();
  if (!text) return undefined;
  if (text.length > max) throw new Error(`${label} vượt giới hạn ${max} ký tự.`);
  return text;
}

function normaliseProjectIdea(input: ProjectIdea): ProjectIdea {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Ý tưởng dự án phải là object.");
  const projectType = input.project_type;
  if (projectType !== undefined && !PROJECT_TYPES.has(projectType))
    throw new Error("Loại hình dự án không nằm trong danh sách hỗ trợ.");
  const integer = (value: unknown, label: string, min: number, max: number): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    if (!Number.isInteger(value) || Number(value) < min || Number(value) > max)
      throw new Error(`${label} phải là số nguyên từ ${min} đến ${max}.`);
    return Number(value);
  };
  return {
    ...(optionalText(input.problem, "Vấn đề/cơ hội") ? { problem: optionalText(input.problem, "Vấn đề/cơ hội") } : {}),
    ...(optionalText(input.activity, "Hoạt động") ? { activity: optionalText(input.activity, "Hoạt động") } : {}),
    ...(projectType ? { project_type: projectType } : {}),
    ...(optionalText(input.location, "Địa điểm", 2000) ? { location: optionalText(input.location, "Địa điểm", 2000) } : {}),
    ...(optionalText(input.scale, "Quy mô", 2000) ? { scale: optionalText(input.scale, "Quy mô", 2000) } : {}),
    ...(integer(input.start_year, "Năm bắt đầu", 1900, 2200) !== undefined
      ? { start_year: integer(input.start_year, "Năm bắt đầu", 1900, 2200) }
      : {}),
    ...(integer(input.crediting_years, "Kỳ tín chỉ", 1, 100) !== undefined
      ? { crediting_years: integer(input.crediting_years, "Kỳ tín chỉ", 1, 100) }
      : {}),
    ...(optionalText(input.proponent, "Project proponent", 2000) ? { proponent: optionalText(input.proponent, "Project proponent", 2000) } : {}),
  };
}

function refresh(projectId: string) {
  revalidatePath(`/du-an/${projectId}`);
  revalidatePath(`/du-an/${projectId}/thiet-lap`);
  revalidatePath(`/du-an/${projectId}/quy-trinh`);
}

async function writeSetup(
  projectId: string,
  transform: (current: ProjectSetup) => ProjectSetup,
  message: string,
  expectedUpdatedAt?: string,
): Promise<SetupActionResult> {
  const record = await getProjectSetupRecord(projectId);
  if (!record) return fail("Không tìm thấy dự án.");
  if (record.deletedAt) return fail("Dự án đã được đưa vào thùng rác, không thể cập nhật setup.");
  if (expectedUpdatedAt && record.updatedAt !== expectedUpdatedAt)
    return fail("Ý tưởng hoặc mô tả vừa thay đổi trong lúc trợ lý đang chạy. Chạy trợ lý lại trên dữ liệu mới.");

  const setup = transform(record.setup);
  assertNoForbiddenFeasibilityKeys(setup.feasibility ?? {});
  if (JSON.stringify(setup).length > 190_000) return fail("Dữ liệu setup vượt giới hạn an toàn 190KB.");

  const db = await projectClient();
  const { data, error } = await db
    .from("projects")
    .update({ setup })
    .eq("id", projectId)
    .eq("updated_at", record.updatedAt)
    .select("id")
    .maybeSingle();
  if (error) return fail(projectSetupDatabaseError(error.message));
  if (!data) return fail("Setup vừa được người khác cập nhật. Tải lại trang rồi thử lại để tránh ghi đè.");
  refresh(projectId);
  return { ok: true, message, setup };
}

/** Bước 1 — lưu ý tưởng có cấu trúc. */
export async function saveIdea(projectId: string, idea: ProjectIdea): Promise<SetupActionResult> {
  await requireProjectMember(projectId);
  try {
    const clean = normaliseProjectIdea(idea);
    return await writeSetup(projectId, (setup) => ({ ...setup, idea: clean }), "Đã lưu ý tưởng dự án.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Không lưu được ý tưởng dự án.");
  }
}

/** Bước 2 — lưu mô tả do người dùng viết. */
export async function saveDescription(projectId: string, text: string): Promise<SetupActionResult> {
  await requireProjectMember(projectId);
  try {
    if (typeof text !== "string") return fail("Mô tả dự án phải là nội dung chữ.");
    const description = text.trim();
    if (description.length > 50_000) return fail("Mô tả dự án vượt giới hạn 50.000 ký tự.");
    return await writeSetup(
      projectId,
      (setup) => ({ ...setup, description }),
      "Đã lưu mô tả dự án.",
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Không lưu được mô tả dự án.");
  }
}

/** Nhận định ở trường này là lời của con người; AI không được ghi vào đây. */
export async function saveFeasibilityNotes(
  projectId: string,
  notes: string,
): Promise<SetupActionResult> {
  await requireProjectMember(projectId);
  try {
    if (typeof notes !== "string") return fail("Nhận định chuyên gia phải là nội dung chữ.");
    const clean = notes.trim();
    if (clean.length > 50_000) return fail("Nhận định chuyên gia vượt giới hạn 50.000 ký tự.");
    return await writeSetup(
      projectId,
      (setup) => ({
        ...setup,
        feasibility: { ...setup.feasibility, notes: clean },
      }),
      "Đã lưu nhận định của chuyên gia.",
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Không lưu được nhận định.");
  }
}

/** Bước 3 — AI chỉ cấu trúc known/gaps, tuyệt đối không tạo verdict. */
export async function runFeasibilityAssist(projectId: string): Promise<SetupActionResult> {
  const { profile } = await requireProjectMember(projectId);
  try {
    const record = await getProjectSetupRecord(projectId);
    if (!record) return fail("Không tìm thấy dự án.");
    const supabase = await createClient();
    const config = await loadChatConfig(supabase);
    if (!config) return fail(missingKeyMessage());

    const catalogResult = await HANDLERS.goi_y_methodology({ supabase, profile }, {});
    const catalog = catalogFromMethodologyHandler(catalogResult);
    const requiredGaps = deriveIdeaGaps(record.setup.idea ?? {}, record.setup.description, catalog);
    const answer = await runSetupJsonTurn(
      config.provider.create({ apiKey: config.apiKey, model: config.model }),
      FEASIBILITY_ASSIST_SYSTEM,
      {
        project: {
          name: record.projectName,
          idea: record.setup.idea ?? {},
          description: record.setup.description ?? "",
        },
        catalog,
      },
    );
    const assessment = parseFeasibilityAssist(
      answer,
      requiredGaps,
      deriveKnownFacts(record.setup.idea ?? {}, record.setup.description),
    );
    const now = new Date().toISOString();
    return await writeSetup(
      projectId,
      (setup) => ({
        ...setup,
        feasibility: {
          ...setup.feasibility,
          ...assessment,
          assessed_at: now,
          assessed_by: profile.id,
        },
      }),
      "Trợ lý đã cấu trúc điều đã biết và các khoảng trống. Đây không phải kết luận khả thi.",
      record.updatedAt,
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Trợ lý chưa thể hỗ trợ đánh giá.");
  }
}

/** Bước 4 — lấy catalog qua handler hiện hữu, model chỉ giải thích trên allowlist đó. */
export async function runSelectionAdvice(projectId: string): Promise<SetupActionResult> {
  const { profile } = await requireProjectMember(projectId);
  try {
    const record = await getProjectSetupRecord(projectId);
    if (!record) return fail("Không tìm thấy dự án.");
    const supabase = await createClient();
    const config = await loadChatConfig(supabase);
    if (!config) return fail(missingKeyMessage());
    const idea = record.setup.idea ?? {};
    const query = [idea.project_type, idea.activity, idea.problem, record.setup.description]
      .filter(Boolean)
      .join(" ");
    const catalogResult = await HANDLERS.goi_y_methodology(
      { supabase, profile },
      { mo_ta: query },
    );
    const catalog = catalogFromMethodologyHandler(catalogResult);
    if (catalog.length === 0)
      return fail("Catalog nội bộ không có Methodology khớp dữ liệu dự án; trợ lý không gợi ý từ trí nhớ.");
    const answer = await runSetupJsonTurn(
      config.provider.create({ apiKey: config.apiKey, model: config.model }),
      SELECTION_ASSIST_SYSTEM,
      {
        project: { name: record.projectName, idea, description: record.setup.description ?? "" },
        allowed_catalog: catalog,
      },
    );
    const advice = buildSelectionAdvice(answer, catalog);
    return await writeSetup(
      projectId,
      (setup) => ({ ...setup, selection_advice: advice }),
      "Đã tạo gợi ý từ catalog nội bộ. Người dùng vẫn phải tự chọn và khoá Methodology.",
      record.updatedAt,
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Trợ lý chưa thể gợi ý Methodology.");
  }
}
