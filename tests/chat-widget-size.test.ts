import { describe, expect, it } from "vitest";
import { clampChatPosition, clampChatSize } from "@/components/chat/chat-widget";

describe("giới hạn kích thước khung chat", () => {
  it("giữ nguyên kích thước đã nằm trong khoảng dùng được", () => {
    expect(clampChatSize({ width: 480, height: 600 }, { width: 900, height: 700 })).toEqual({
      width: 480,
      height: 600,
    });
  });

  it("không cho kéo nhỏ hơn 320 × 360", () => {
    expect(clampChatSize({ width: 12, height: 40 }, { width: 900, height: 700 })).toEqual({
      width: 320,
      height: 360,
    });
  });

  it("không cho kéo vượt phần viewport dành cho panel", () => {
    expect(clampChatSize({ width: 1200, height: 900 }, { width: 768, height: 640 })).toEqual({
      width: 768,
      height: 640,
    });
  });

  it("làm tròn pixel lẻ trước khi lưu", () => {
    expect(
      clampChatSize({ width: 421.6, height: 503.2 }, { width: 768, height: 640 }),
    ).toEqual({ width: 422, height: 503 });
  });
});

describe("giới hạn vị trí khung chat", () => {
  const viewport = { width: 1200, height: 800 };
  const size = { width: 400, height: 500 };

  it("giữ nguyên vị trí nằm trọn trong viewport", () => {
    expect(clampChatPosition({ x: 320, y: 120 }, size, viewport)).toEqual({ x: 320, y: 120 });
  });

  it("không cho kéo khung vượt cạnh trên hoặc cạnh trái", () => {
    expect(clampChatPosition({ x: -100, y: -40 }, size, viewport)).toEqual({ x: 16, y: 16 });
  });

  it("không cho kéo khung vượt cạnh phải hoặc cạnh dưới", () => {
    expect(clampChatPosition({ x: 1100, y: 700 }, size, viewport)).toEqual({ x: 784, y: 284 });
  });

  it("làm tròn vị trí pixel lẻ trước khi lưu", () => {
    expect(clampChatPosition({ x: 121.7, y: 94.2 }, size, viewport)).toEqual({ x: 122, y: 94 });
  });
});
