import { describe, expect, it } from "vitest";
import { clampChatSize } from "@/components/chat/chat-widget";

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
