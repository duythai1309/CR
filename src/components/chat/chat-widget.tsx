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

export interface ChatPosition {
  x: number;
  y: number;
}

interface ChatFrame {
  size: ChatSize;
  position: ChatPosition;
}

const DEFAULT_CHAT_SIZE: ChatSize = { width: 416, height: 512 };
const MIN_CHAT_SIZE: ChatSize = { width: 320, height: 360 };
const CHAT_SIZE_KEY = "c-route:chat-size";
const CHAT_POSITION_KEY = "c-route:chat-position";
const RESIZE_STEP = 16;
const VIEWPORT_GAP = 16;
const DEFAULT_TOP = 80;

/** Kẹp cả hai chiều để khung không thành vô dụng hoặc tràn khỏi viewport. */
export function clampChatSize(size: ChatSize, maximum: ChatSize): ChatSize {
  const maxWidth = Math.max(MIN_CHAT_SIZE.width, maximum.width);
  const maxHeight = Math.max(MIN_CHAT_SIZE.height, maximum.height);
  return {
    width: Math.min(maxWidth, Math.max(MIN_CHAT_SIZE.width, Math.round(size.width))),
    height: Math.min(maxHeight, Math.max(MIN_CHAT_SIZE.height, Math.round(size.height))),
  };
}

/** Giữ toàn bộ cửa sổ trong viewport, kể cả sau khi viewport bị thu nhỏ. */
export function clampChatPosition(
  position: ChatPosition,
  size: ChatSize,
  viewport: ChatSize,
): ChatPosition {
  const maxX = Math.max(VIEWPORT_GAP, viewport.width - size.width - VIEWPORT_GAP);
  const maxY = Math.max(VIEWPORT_GAP, viewport.height - size.height - VIEWPORT_GAP);
  return {
    x: Math.min(maxX, Math.max(VIEWPORT_GAP, Math.round(position.x))),
    y: Math.min(maxY, Math.max(VIEWPORT_GAP, Math.round(position.y))),
  };
}

function viewportMaximum(): ChatSize {
  return {
    width: window.innerWidth - 32,
    height: window.innerHeight - 96,
  };
}

function viewportSize(): ChatSize {
  return { width: window.innerWidth, height: window.innerHeight };
}

function defaultPosition(size: ChatSize): ChatPosition {
  return clampChatPosition(
    { x: window.innerWidth - size.width - VIEWPORT_GAP, y: DEFAULT_TOP },
    size,
    viewportSize(),
  );
}

function sameFrame(left: ChatFrame, right: ChatFrame): boolean {
  return (
    left.size.width === right.size.width &&
    left.size.height === right.size.height &&
    left.position.x === right.position.x &&
    left.position.y === right.position.y
  );
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
  const [frame, setFrame] = useState<ChatFrame>({
    size: DEFAULT_CHAT_SIZE,
    position: { x: VIEWPORT_GAP, y: DEFAULT_TOP },
  });
  const [storageReady, setStorageReady] = useState(false);
  const resize = useRef<{
    pointerId: number;
    x: number;
    y: number;
    size: ChatSize;
    position: ChatPosition;
  } | null>(null);
  const move = useRef<{
    pointerId: number;
    x: number;
    y: number;
    position: ChatPosition;
  } | null>(null);

  useEffect(() => {
    setAnchor(document.querySelector(anchorSelector));
  }, [anchorSelector]);

  useEffect(() => {
    let loadedSize = DEFAULT_CHAT_SIZE;
    try {
      const raw = window.localStorage.getItem(CHAT_SIZE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<ChatSize>;
        if (typeof saved.width === "number" && typeof saved.height === "number")
          loadedSize = clampChatSize(
            { width: saved.width, height: saved.height },
            viewportMaximum(),
          );
      }
    } catch {
      // Trình duyệt có thể chặn localStorage; kích thước mặc định vẫn dùng được.
    }

    let loadedPosition = defaultPosition(loadedSize);
    try {
      const raw = window.localStorage.getItem(CHAT_POSITION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<ChatPosition>;
        if (typeof saved.x === "number" && typeof saved.y === "number")
          loadedPosition = clampChatPosition(
            { x: saved.x, y: saved.y },
            loadedSize,
            viewportSize(),
          );
      }
    } catch {
      // Vị trí mặc định vẫn dùng được khi localStorage bị chặn hoặc chứa dữ liệu hỏng.
    }

    setFrame({ size: loadedSize, position: loadedPosition });
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(CHAT_SIZE_KEY, JSON.stringify(frame.size));
      window.localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify(frame.position));
    } catch {
      // Không cho lỗi lưu sở thích làm hỏng khung chat.
    }
  }, [frame, storageReady]);

  useEffect(() => {
    const fitToViewport = () => {
      if (window.innerWidth < 640) return;
      setFrame((current) => {
        const nextSize = clampChatSize(current.size, viewportMaximum());
        const next = {
          size: nextSize,
          position: clampChatPosition(current.position, nextSize, viewportSize()),
        };
        return sameFrame(current, next) ? current : next;
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
    setFrame((current) => {
      const nextSize = clampChatSize(
        {
          width: current.size.width + delta.width,
          height: current.size.height + delta.height,
        },
        viewportMaximum(),
      );
      return {
        size: nextSize,
        position: clampChatPosition(
          {
            x: current.position.x + current.size.width - nextSize.width,
            y: current.position.y,
          },
          nextSize,
          viewportSize(),
        ),
      };
    });
  }

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resize.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      size: frame.size,
      position: frame.position,
    };
  }

  function moveResize(event: PointerEvent<HTMLButtonElement>) {
    const current = resize.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const nextSize = clampChatSize(
      {
        // Tay cầm ở cạnh trái: kéo sang trái làm tăng chiều rộng.
        width: current.size.width - (event.clientX - current.x),
        height: current.size.height + (event.clientY - current.y),
      },
      viewportMaximum(),
    );
    setFrame({
      size: nextSize,
      position: clampChatPosition(
        {
          x: current.position.x + current.size.width - nextSize.width,
          y: current.position.y,
        },
        nextSize,
        viewportSize(),
      ),
    });
  }

  function stopResize(event: PointerEvent<HTMLButtonElement>) {
    if (resize.current?.pointerId !== event.pointerId) return;
    resize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function moveFromKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? RESIZE_STEP * 2 : RESIZE_STEP;
    const delta =
      event.key === "ArrowLeft"
        ? { x: -step, y: 0 }
        : event.key === "ArrowRight"
          ? { x: step, y: 0 }
          : event.key === "ArrowUp"
            ? { x: 0, y: -step }
            : event.key === "ArrowDown"
              ? { x: 0, y: step }
              : null;
    if (!delta || window.innerWidth < 640) return;
    event.preventDefault();
    setFrame((current) => ({
      ...current,
      position: clampChatPosition(
        { x: current.position.x + delta.x, y: current.position.y + delta.y },
        current.size,
        viewportSize(),
      ),
    }));
  }

  function startMove(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || window.innerWidth < 640) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    move.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      position: frame.position,
    };
  }

  function movePanel(event: PointerEvent<HTMLButtonElement>) {
    const current = move.current;
    if (!current || current.pointerId !== event.pointerId) return;
    setFrame((active) => ({
      ...active,
      position: clampChatPosition(
        {
          x: current.position.x + event.clientX - current.x,
          y: current.position.y + event.clientY - current.y,
        },
        active.size,
        viewportSize(),
      ),
    }));
  }

  function stopMove(event: PointerEvent<HTMLButtonElement>) {
    if (move.current?.pointerId !== event.pointerId) return;
    move.current = null;
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
    "--chat-width": `${frame.size.width}px`,
    "--chat-height": `${frame.size.height}px`,
    "--chat-left": `${frame.position.x}px`,
    "--chat-top": `${frame.position.y}px`,
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
          className="fixed inset-x-3 bottom-3 top-20 z-50 flex h-auto w-auto flex-col overflow-hidden rounded-2xl border border-soil-200 bg-soil-50 shadow-xl sm:inset-auto sm:left-[var(--chat-left)] sm:top-[var(--chat-top)] sm:h-[var(--chat-height)] sm:max-h-[calc(100dvh-2rem)] sm:w-[var(--chat-width)] sm:max-w-[calc(100vw-2rem)]"
        >
          <header className="flex items-center justify-between border-b border-soil-200 bg-white px-4 py-3">
            <button
              type="button"
              aria-label="Di chuyển khung chat"
              aria-describedby="chat-move-help"
              onKeyDown={moveFromKeyboard}
              onPointerDown={startMove}
              onPointerMove={movePanel}
              onPointerUp={stopMove}
              onPointerCancel={stopMove}
              className="min-w-0 flex-1 cursor-default touch-auto select-none text-left focus:outline-none focus:ring-2 focus:ring-leaf-500 sm:cursor-move sm:touch-none"
            >
              <p className="text-sm font-semibold text-soil-900">Trợ lý</p>
              <p className="text-xs text-soil-600">Tra số liệu và hướng dẫn dùng hệ thống</p>
            </button>
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
          <span id="chat-move-help" className="sr-only">
            Kéo để di chuyển khung chat. Dùng các phím mũi tên để di chuyển bằng bàn phím.
          </span>
        </section>
      )}
    </>
  );
}
