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
  liet_ke_du_an: "Đang xem danh sách dự án…",
  tien_do_du_an: "Đang xem tiến độ dự án…",
  goi_y_methodology: "Đang tra catalog methodology…",
  field_giam_sat_cua_methodology: "Đang mở lược đồ chỉ số của methodology…",
  kiem_tra_baseline: "Đang đối chiếu baseline với lược đồ…",
  cong_viec_theo_buoc: "Đang rà công việc theo từng bước…",
};

/**
 * Gợi ý câu hỏi. Một bộ duy nhất: sản phẩm chỉ còn nền tảng dự án Carbon, nên gợi ý
 * không còn phải rẽ theo vai trò toàn cục nữa.
 */
const SUGGESTIONS = [
  "Tôi đang có những dự án nào?",
  "Mục hồ sơ nào còn chưa có nội dung?",
  "Methodology đang chọn đòi những field nào?",
  "Baseline của dự án còn thiếu field nào?",
];

export function ChatPanel({
  initialConversationId = null,
  initialMessages = [],
  className = "",
  resizeHandleInset = false,
}: {
  /**
   * Không còn dùng tới. Giữ trong kiểu prop vì bốn điểm gắn của module cũ
   * (`src/app/htx/layout.tsx:19`, `cho/layout.tsx:17`, `don-hang/layout.tsx:11`,
   * `quan-tri/page.tsx:94`, `htx/tro-ly/page.tsx:55`) vẫn truyền vào, mà chúng không
   * nằm trong phạm vi sửa của đợt này — bỏ prop bây giờ là `npm run types` đỏ ở đó.
   * Xoá cùng lúc với đợt gỡ route cũ.
   */
  audience?: "coop" | "buyer" | "admin";
  initialConversationId?: string | null;
  initialMessages?: ChatMessage[];
  className?: string;
  /** Chừa chỗ cho tay cầm co giãn của widget; trang chat toàn màn hình không cần. */
  resizeHandleInset?: boolean;
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

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-soil-600">
              Mình tra được dữ liệu của các dự án anh/chị tham gia và giải thích cách hệ
              thống vận hành. Mọi con số mình nói đều lấy từ cơ sở dữ liệu, không tự ước
              lượng — và bốn methodology trong hệ thống là dữ liệu mẫu chưa thẩm định.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
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
        className={`flex items-end gap-2 border-t border-soil-200 bg-soil-50 py-3 pr-3 ${resizeHandleInset ? "pl-3 sm:pl-10" : "pl-3"}`}
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
          placeholder="Hỏi về dự án, methodology hoặc cách dùng hệ thống…"
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
