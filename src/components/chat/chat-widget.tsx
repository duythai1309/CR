"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChatPanel } from "./chat-panel";

export interface ChatSize {
  width: number;
  height: number;
}

const DEFAULT_CHAT_SIZE: ChatSize = { width: 416, height: 512 };
const MIN_CHAT_SIZE: ChatSize = { width: 320, height: 360 };
const CHAT_SIZE_KEY = "c-route:chat-size";
const RESIZE_STEP = 16;

/** Kẹp cả hai chiều để khung không thành vô dụng hoặc tràn khỏi viewport. */
export function clampChatSize(size: ChatSize, maximum: ChatSize): ChatSize {
  const maxWidth = Math.max(MIN_CHAT_SIZE.width, maximum.width);
  const maxHeight = Math.max(MIN_CHAT_SIZE.height, maximum.height);
  return {
    width: Math.min(maxWidth, Math.max(MIN_CHAT_SIZE.width, Math.round(size.width))),
    height: Math.min(maxHeight, Math.max(MIN_CHAT_SIZE.height, Math.round(size.height))),
  };
}

function viewportMaximum(): ChatSize {
  return {
    width: window.innerWidth - 32,
    height: window.innerHeight - 96,
  };
}

function sameSize(left: ChatSize, right: ChatSize): boolean {
  return left.width === right.width && left.height === right.height;
}

/**
 * Pill nằm trong hàng công cụ; panel là overlay neo góc trên phải và không đẩy nội dung.
 * Panel chỉ được dựng sau lần mở đầu tiên, nên trang không tải phần chat trước khi cần.
 */
export function ChatWidget({
  audience = "coop",
  anchorSelector = "[data-chat-widget-anchor]",
}: {
  /** Giữ tương thích với các điểm gắn cũ. */
  audience?: "coop" | "buyer" | "admin";
  /** Điểm cuối hàng công cụ nhận pill qua portal. */
  anchorSelector?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<Element | null>(null);
  const [size, setSize] = useState<ChatSize>(DEFAULT_CHAT_SIZE);
  const [storageReady, setStorageReady] = useState(false);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    size: ChatSize;
  } | null>(null);

  useEffect(() => {
    setAnchor(document.querySelector(anchorSelector));
  }, [anchorSelector]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAT_SIZE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<ChatSize>;
        if (typeof saved.width === "number" && typeof saved.height === "number")
          setSize(clampChatSize({ width: saved.width, height: saved.height }, viewportMaximum()));
      }
    } catch {
      // Trình duyệt có thể chặn localStorage; kích thước mặc định vẫn dùng được.
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(CHAT_SIZE_KEY, JSON.stringify(size));
    } catch {
      // Không cho lỗi lưu sở thích làm hỏng khung chat.
    }
  }, [size, storageReady]);

  useEffect(() => {
    const fitToViewport = () => {
      if (window.innerWidth < 640) return;
      setSize((current) => {
        const next = clampChatSize(current, viewportMaximum());
        return sameSize(current, next) ? current : next;
      });
    };
    window.addEventListener("resize", fitToViewport);
    return () => window.removeEventListener("resize", fitToViewport);
  }, []);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function resizeFromKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? RESIZE_STEP * 2 : RESIZE_STEP;
    const delta =
      event.key === "ArrowLeft"
        ? { width: step, height: 0 }
        : event.key === "ArrowRight"
          ? { width: -step, height: 0 }
          : event.key === "ArrowUp"
            ? { width: 0, height: -step }
            : event.key === "ArrowDown"
              ? { width: 0, height: step }
              : null;
    if (!delta) return;
    event.preventDefault();
    setSize((current) =>
      clampChatSize(
        { width: current.width + delta.width, height: current.height + delta.height },
        viewportMaximum(),
      ),
    );
  }

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      size,
    };
  }

  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    setSize(
      clampChatSize(
        {
          // Panel neo bên phải: kéo cạnh trái sang trái làm tăng chiều rộng.
          width: current.size.width - (event.clientX - current.x),
          height: current.size.height + (event.clientY - current.y),
        },
        viewportMaximum(),
      ),
    );
  }

  function stopResize(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-label={open ? "Đóng trợ lý" : "Mở trợ lý"}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 rounded-full border border-soil-200 bg-soil-50 px-3 py-1.5 text-sm font-medium text-soil-700 transition hover:border-leaf-300 hover:bg-leaf-50 hover:text-leaf-800"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-4 w-4 fill-none stroke-current"
        strokeWidth="1.7"
      >
        <path d="M4.25 4.5h11.5v8H9l-3.5 3v-3H4.25z" strokeLinejoin="round" />
      </svg>
      <span>Chat</span>
    </button>
  );

  const panelStyle = {
    "--chat-width": `${size.width}px`,
    "--chat-height": `${size.height}px`,
  } as CSSProperties;

  return (
    <>
      {anchor ? (
        createPortal(trigger, anchor)
      ) : (
        <div className="fixed right-4 top-20 z-40">{trigger}</div>
      )}

      {mounted && (
        <section
          hidden={!open}
          aria-label="Trợ lý C-route"
          style={panelStyle}
          className="fixed inset-x-3 bottom-3 top-20 z-50 flex h-auto w-auto flex-col overflow-hidden rounded-2xl border border-soil-200 bg-soil-50 shadow-xl sm:inset-auto sm:right-4 sm:top-20 sm:h-[var(--chat-height)] sm:max-h-[calc(100dvh-6rem)] sm:w-[var(--chat-width)] sm:max-w-[calc(100vw-2rem)]"
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
          <ChatPanel audience={audience} resizeHandleInset className="min-h-0 flex-1" />
          <button
            type="button"
            aria-label="Đổi kích thước khung chat"
            aria-describedby="chat-resize-help"
            onKeyDown={resizeFromKeyboard}
            onPointerDown={startResize}
            onPointerMove={moveResize}
            onPointerUp={stopResize}
            onPointerCancel={stopResize}
            className="absolute bottom-1 left-1 hidden h-7 w-7 touch-none cursor-sw-resize items-center justify-center rounded-md text-soil-500 transition hover:bg-soil-100 hover:text-soil-900 focus:outline-none focus:ring-2 focus:ring-leaf-500 sm:flex"
          >
            <span aria-hidden="true">↙</span>
          </button>
          <span id="chat-resize-help" className="sr-only">
            Dùng phím mũi tên trái hoặc phải để đổi chiều rộng; lên hoặc xuống để đổi chiều cao.
          </span>
        </section>
      )}
    </>
  );
}
