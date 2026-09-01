import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { loadChatConfig, missingKeyMessage } from "@/lib/chat/settings";
import {
  checkQuestion,
  MAX_HISTORY_TURNS,
  titleFromQuestion,
  trimHistory,
} from "@/lib/chat/guards";
import { HANDLERS } from "@/lib/chat/handlers";
import { buildSystemPrompt } from "@/lib/chat/prompt";
import type { ProviderTurn, ToolCall } from "@/lib/chat/provider";
import { runTurn } from "@/lib/chat/run";
import { findTool, toolsForRole } from "@/lib/chat/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) => NextResponse.json(body, { status });

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return json({ error: "Bạn cần đăng nhập để dùng trợ lý." }, 401);

  let body: { message?: unknown; conversationId?: unknown; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nội dung gửi lên không hợp lệ." }, 400);
  }

  const checked = checkQuestion(body.message);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const question = checked.question;

  const supabase = await createClient();

  const config = await loadChatConfig(supabase);
  if (!config) return json({ error: missingKeyMessage() }, 503);

  // Hội thoại: mở tiếp cái đang có, hoặc tạo mới. RLS đảm bảo không mở được của
  // người khác — truy vấn sẽ không trả về gì và ta tạo hội thoại mới thay vì lỗi.
  let conversationId =
    typeof body.conversationId === "string" && body.conversationId ? body.conversationId : null;

  if (conversationId) {
    const { data } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!data) conversationId = null;
  }

  if (!conversationId) {
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({
        user_id: profile.id,
        cooperative_id: profile.cooperative_id,
        title: titleFromQuestion(question),
      })
      .select("id")
      .single();
    if (error || !data) return json({ error: "Không mở được hội thoại mới." }, 500);
    conversationId = data.id;
  }

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_TURNS * 2);

  // Ghi câu hỏi ngay, trước khi gọi model. Model lỗi thì câu hỏi vẫn còn trong lịch sử
  // thay vì biến mất khỏi màn hình người dùng.
  await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    user_id: profile.id,
    role: "user",
    content: question,
  });

  const coopName = profile.cooperative_id
    ? ((
        await supabase
          .from("cooperatives")
          .select("name")
          .eq("id", profile.cooperative_id)
          .maybeSingle()
      ).data?.name ?? null)
    : null;

  const contents: ProviderTurn[] = [
    ...trimHistory(history ?? []).map(
      (m): ProviderTurn => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }),
    ),
    { role: "user", parts: [{ text: question }] },
  ];

  const tools = toolsForRole(profile.role);

  const execute = async (call: ToolCall): Promise<Record<string, unknown>> => {
    // Vai trò được kiểm lại ở đây chứ không tin vào việc model chỉ gọi hàm đã đưa.
    if (!findTool(call.name, profile.role))
      return { loi: `Vai trò của người dùng không được phép dùng công cụ ${call.name}.` };
    try {
      const result = await HANDLERS[call.name]({ supabase, profile }, call.args);
      return result && typeof result === "object" && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : { ket_qua: result };
    } catch (e) {
      return { loi: e instanceof Error ? e.message : "Không tra được dữ liệu." };
    }
  };

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, { type: "conversation", conversationId });
      let answer = "";
      let toolCalls: ToolCall[] = [];

      try {
        for await (const event of runTurn({
          provider: config.provider.create({ apiKey: config.apiKey, model: config.model }),
          system: buildSystemPrompt({
            role: profile.role,
            fullName: profile.full_name,
            coopName,
            path: typeof body.path === "string" ? body.path : null,
          }),
          contents,
          tools,
          execute,
        })) {
          if (event.type === "done") {
            answer = event.text;
            toolCalls = event.toolCalls;
          } else {
            send(controller, event);
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Lỗi không rõ";
        send(controller, { type: "error", message: `Trợ lý gặp lỗi khi trả lời: ${message}` });
        controller.close();
        return;
      }

      if (answer.trim()) {
        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          user_id: profile.id,
          role: "assistant",
          content: answer,
          // Chỉ lưu tên hàm và tham số, không lưu dữ liệu trả về: đủ để truy vì sao
          // trợ lý nói ra một con số, mà không nhân bản dữ liệu đã có ở bảng gốc.
          tool_calls: toolCalls.length > 0 ? (toolCalls as unknown as Json) : null,
        });
      }

      send(controller, { type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
