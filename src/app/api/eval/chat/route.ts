import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/auth";
import { loadChatConfig, missingKeyMessage } from "@/lib/chat/settings";
import { checkQuestion } from "@/lib/chat/guards";
import { buildSystemPrompt } from "@/lib/chat/prompt";
import type { ProviderTurn, ToolCall } from "@/lib/chat/provider";
import { runTurn } from "@/lib/chat/run";
import { toolsForRole } from "@/lib/chat/tools";
import { createFixtureExecute, FIXTURE_COOP, FIXTURE_USER } from "@/lib/chat/eval/fixture";
import {
  buildContexts,
  buildTrajectory,
  type TrajectoryStep,
} from "@/lib/chat/eval/trajectory";

/**
 * Điểm nối cho eval platform.
 *
 * Khác `/api/chat` ở ba điểm, và cả ba đều cố ý:
 *  1. Xác thực bằng token dùng riêng cho máy chạy eval, không phải phiên đăng nhập —
 *     platform gọi từ máy chủ khác, không có cookie.
 *  2. Trả JSON một lần thay vì luồng SSE, kèm `trajectory` để bốn evaluator agentic
 *     chấm được hành vi gọi công cụ chứ không chỉ chấm câu chữ.
 *  3. Chạy trên dữ liệu mẫu cố định, không chạm cơ sở dữ liệu thật — eval phải tất
 *     định, và dữ liệu nông hộ thật không nên rời hệ thống.
 *
 * Prompt, bộ công cụ và vòng lặp thì dùng đúng bản production, nếu không thì eval
 * đang chấm một agent khác với agent người dùng thật đang gặp.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: UserRole[] = ["coop_manager", "coop_staff", "buyer", "platform_admin"];

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // So sánh hằng thời gian chỉ có nghĩa khi hai bên cùng độ dài; khác độ dài thì
  // timingSafeEqual ném lỗi, nên chặn trước và vẫn trả về false.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.EVAL_API_TOKEN?.trim();
  if (!expected)
    return NextResponse.json(
      { error: "Endpoint eval chưa bật. Đặt EVAL_API_TOKEN để dùng." },
      { status: 503 },
    );

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!provided || !tokenMatches(provided, expected))
    return NextResponse.json({ error: "Token không hợp lệ." }, { status: 401 });

  const config = await loadChatConfig();
  if (!config) return NextResponse.json({ error: missingKeyMessage() }, { status: 503 });


  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Nội dung gửi lên không hợp lệ." }, { status: 400 });
  }

  // Platform gửi `input`; nhận thêm `message` cho tiện gọi tay bằng curl.
  const checked = checkQuestion(body.input ?? body.message);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const question = checked.question;

  const role = ROLES.includes(body.role as UserRole)
    ? (body.role as UserRole)
    : "coop_manager";
  // Cho phép ghi đè model cho từng lượt gọi, để quét nhiều model trên cùng bộ ca mà
  // không phải sửa cấu hình rồi khởi động lại giữa chừng. Chỉ đổi TÊN model, vẫn
  // dùng đúng nhà cung cấp và khoá đã cấu hình — endpoint này đã sau lớp
  // EVAL_API_TOKEN nên không mở thêm bề mặt nào ra ngoài.
  const model =
    typeof body.model === "string" && body.model.trim() ? body.model.trim() : config.model;

  // Hội thoại nhiều lượt: platform gửi cả đoạn qua `messages`, lượt cuối là câu hỏi.
  const priorTurns = Array.isArray(body.messages)
    ? (body.messages as Array<{ role?: unknown; content?: unknown }>)
        .filter((m) => typeof m?.content === "string" && (m.content as string).trim())
        .slice(0, -1)
        .map(
          (m): ProviderTurn => ({
            role: m.role === "assistant" || m.role === "model" ? "model" : "user",
            parts: [{ text: String(m.content) }],
          }),
        )
    : [];

  const steps: TrajectoryStep[] = [];
  const fixtureExecute = createFixtureExecute(role);
  const execute = async (call: ToolCall): Promise<Record<string, unknown>> => {
    const result = await fixtureExecute(call);
    steps.push({ call, result });
    return result;
  };

  let answer = "";
  let toolCalls: ToolCall[] = [];

  try {
    for await (const event of runTurn({
      provider: config.provider.create({ apiKey: config.apiKey, model }),
      system: buildSystemPrompt({
        role,
        fullName: FIXTURE_USER,
        coopName: role === "buyer" ? null : FIXTURE_COOP,
        path: typeof body.path === "string" ? body.path : null,
        // Ngày cố định: prompt có nhắc "hôm nay là ngày nào", để nguyên ngày thật thì
        // cùng một prompt lại khác nhau giữa hai lần chạy.
        today: "2026-09-01",
      }),
      contents: [...priorTurns, { role: "user", parts: [{ text: question }] }],
      tools: toolsForRole(role),
      execute,
    })) {
      if (event.type === "done") {
        answer = event.text;
        toolCalls = event.toolCalls;
      }
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Trợ lý gặp lỗi khi trả lời." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    answer,
    trajectory: buildTrajectory(question, steps, answer),
    tool_calls: toolCalls.map((c) => ({ name: c.name, arguments: c.args })),
    contexts: buildContexts(
      steps,
      `${FIXTURE_USER}, vai trò ${role}` +
        (role === "buyer" ? "" : `, thuộc ${FIXTURE_COOP}`),
    ),
    meta: {
      role,
      model,
      tool_rounds: steps.length,
      thread_id: typeof body.threadId === "string" ? body.threadId : null,
    },
  });
}
