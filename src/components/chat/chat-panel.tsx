"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Tên công cụ hiện cho người dùng thấy trong lúc chờ, thay cho tên hàm kỹ thuật. */
const TOOL_LABEL: Record<string, string> = {
  tra_cuu_he_so: "Đang tra hệ số phát thải…",
  liet_ke_mua_vu: "Đang xem danh sách mùa vụ…",
  tong_ket_mua_vu: "Đang tổng kết mùa vụ…",
  thua_thieu_nhat_ky: "Đang rà các thửa còn thiếu dữ liệu…",
  chi_tiet_thua_vu: "Đang mở nhật ký của thửa…",
  liet_ke_nong_ho: "Đang xem danh sách nông hộ…",
  liet_ke_lo_tin_chi: "Đang xem các lô tín chỉ…",
  chia_doanh_thu: "Đang tra bảng chia doanh thu…",
  lo_dang_chao_ban: "Đang xem chợ tín chỉ…",
  don_hang_cua_toi: "Đang tra đơn hàng của anh/chị…",
};

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  coop: [
    "Vụ này còn thửa nào chưa tính được MRV?",
    "Muốn được hệ số nước tốt hơn thì phải làm gì?",
    "Hệ số phát thải nền của vụ Mùa là bao nhiêu, lấy từ đâu?",
  ],
  buyer: [
    "Đang có lô nào chào bán?",
    "Đơn hàng của tôi tới đâu rồi?",
    "Đệm rủi ro 15% nghĩa là gì?",
  ],
  admin: [
    "Các lô tín chỉ đang ở trạng thái nào?",
    "Tổng doanh thu đã chia ra sao?",
    "Quy trình xác minh lô diễn ra thế nào?",
  ],
};

export function ChatPanel({
  audience = "coop",
  initialConversationId = null,
  initialMessages = [],
  className = "",
}: {
  audience?: "coop" | "buyer" | "admin";
  initialConversationId?: string | null;
  initialMessages?: ChatMessage[];
  className?: string;
}) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | null>(initialConversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    setError(null);
    setInput("");
    setBusy(true);
    setStatus("Đang suy nghĩ…");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);

    /** Ghi thẳng vào tin nhắn cuối, là bong bóng rỗng vừa thêm ở trên. */
    const appendToAnswer = (chunk: string) =>
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: "assistant",
          content: next[next.length - 1].content + chunk,
        };
        return next;
      });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId.current,
          path: pathname,
        }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Không kết nối được tới trợ lý.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE ngăn cách các sự kiện bằng dòng trống; phần đuôi chưa trọn vẹn giữ lại.
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "conversation") conversationId.current = event.conversationId;
          else if (event.type === "status")
            setStatus(TOOL_LABEL[event.tool] ?? "Đang tra cứu dữ liệu…");
          else if (event.type === "delta") {
            setStatus(null);
            appendToAnswer(event.text);
          } else if (event.type === "error") throw new Error(event.message);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trợ lý đang gặp sự cố.");
      // Bỏ bong bóng rỗng đi, để lỗi không nằm cạnh một câu trả lời trống trơn.
      setMessages((m) =>
        m.length > 0 && m[m.length - 1].role === "assistant" && !m[m.length - 1].content
          ? m.slice(0, -1)
          : m,
      );
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const suggestions = SUGGESTIONS_BY_ROLE[audience] ?? SUGGESTIONS_BY_ROLE.coop;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-soil-600">
              Mình tra được số liệu của hợp tác xã anh/chị và giải thích cách hệ thống tính
              tín chỉ. Mọi con số mình nói đều lấy từ dữ liệu thật, không tự ước lượng.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-soil-200 bg-white px-3 py-1.5 text-left text-xs text-soil-700 transition hover:border-leaf-300 hover:bg-leaf-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-leaf-700 px-3.5 py-2 text-sm text-white"
                  : "max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-soil-200 bg-white px-3.5 py-2 text-sm text-soil-900"
              }
            >
              {m.content || <span className="text-soil-400">…</span>}
            </div>
          </div>
        ))}

        {status && (
          <p className="flex items-center gap-2 text-xs text-soil-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-leaf-500" />
            {status}
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-soil-200 bg-soil-50 px-3 py-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Hỏi về số liệu hoặc cách dùng hệ thống…"
          aria-label="Câu hỏi cho trợ lý"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-y rounded-lg border border-soil-200 bg-white px-3 py-2 text-sm text-soil-900 outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Gửi
        </Button>
      </form>
    </div>
  );
}
