import type { Metadata } from "next";
import { requireCoopProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app-nav";
import { Alert } from "@/components/ui";
import { ChatPanel, type ChatMessage } from "@/components/chat/chat-panel";
import { readChatConfig, missingChatConfigMessage } from "@/lib/chat/config";
import { MAX_HISTORY_TURNS } from "@/lib/chat/guards";

export const metadata: Metadata = { title: "Trợ lý" };

export default async function AssistantPage() {
  const profile = await requireCoopProfile();
  const configured = readChatConfig() !== null;
  const supabase = await createClient();

  // Mở lại hội thoại gần nhất thay vì bắt đầu trắng: người dùng thường quay lại để
  // hỏi tiếp chuyện đang dở.
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: messages } = conversation
    ? await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(MAX_HISTORY_TURNS * 2)
    : { data: null };

  return (
    <>
      <PageHeader
        title="Trợ lý"
        description={
          "Hỏi bằng tiếng Việt về số liệu của hợp tác xã hoặc về cách hệ thống tính tín chỉ. " +
          "Trợ lý chỉ đọc dữ liệu anh/chị có quyền xem, và mọi con số đều lấy từ cơ sở dữ liệu."
        }
      />

      {!configured && (
        <div className="mb-4">
          <Alert tone="warn" title="Trợ lý chưa hoạt động">
            {missingChatConfigMessage()}
          </Alert>
        </div>
      )}

      <div className="flex h-[min(40rem,72dvh)] flex-col overflow-hidden rounded-xl border border-soil-200 bg-white shadow-sm">
        <ChatPanel
          audience="coop"
          initialConversationId={conversation?.id ?? null}
          initialMessages={(messages ?? []) as ChatMessage[]}
          className="min-h-0 flex-1"
        />
      </div>
    </>
  );
}
