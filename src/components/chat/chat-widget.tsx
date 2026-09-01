"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "./chat-panel";

/**
 * Nút trợ lý nổi ở góc phải. Hỏi nhanh ngay tại màn hình đang làm việc; hội thoại
 * dài thì mở trang /htx/tro-ly.
 *
 * Panel chỉ được dựng khi mở lần đầu, nên trang không tốn gì cho tới lúc người dùng
 * thực sự cần tới trợ lý.
 */
export function ChatWidget({ audience = "coop" }: { audience?: "coop" | "buyer" | "admin" }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-3 px-4 pb-4 sm:px-6">
      {mounted && (
        <section
          hidden={!open}
          aria-label="Trợ lý Agri-Carbon Pass"
          className="pointer-events-auto flex h-[min(32rem,70dvh)] w-full max-w-[26rem] flex-col overflow-hidden rounded-2xl border border-soil-200 bg-soil-50 shadow-xl"
        >
          <header className="flex items-center justify-between border-b border-soil-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-soil-900">Trợ lý</p>
              <p className="text-xs text-soil-600">Tra số liệu và hướng dẫn dùng hệ thống</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng trợ lý"
              className="rounded-lg px-2 py-1 text-soil-500 transition hover:bg-soil-100 hover:text-soil-900"
            >
              ✕
            </button>
          </header>
          <ChatPanel audience={audience} className="min-h-0 flex-1" />
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-leaf-700 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-leaf-800"
      >
        {open ? "Thu gọn" : "Hỏi trợ lý"}
      </button>
    </div>
  );
}
