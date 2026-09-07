import { describe, expect, it } from "vitest";
import { FOCUSABLE_SELECTOR, nextFocusIndex } from "@/components/project/board/focus-trap";

describe("bẫy focus của panel sửa nhanh", () => {
  it("Tab ở phần tử cuối vòng về đầu", () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  it("Shift+Tab ở phần tử đầu vòng xuống cuối", () => {
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  it("ở giữa thì để trình duyệt tự đi, không dời focus", () => {
    expect(nextFocusIndex(3, 1, false)).toBeNull();
    expect(nextFocusIndex(3, 1, true)).toBeNull();
  });

  it("Tab ở đầu và Shift+Tab ở cuối cũng để trình duyệt tự đi", () => {
    expect(nextFocusIndex(3, 0, false)).toBeNull();
    expect(nextFocusIndex(3, 2, true)).toBeNull();
  });

  it("focus đang ở NGOÀI panel thì kéo về đầu, Shift+Tab thì về cuối", () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });

  it("panel chỉ có một phần tử thì Tab lẫn Shift+Tab đều ở nguyên nó", () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });

  it("panel không có gì focus được thì không can thiệp — không tạo bẫy bàn phím", () => {
    expect(nextFocusIndex(0, -1, false)).toBeNull();
    expect(nextFocusIndex(0, 0, true)).toBeNull();
  });

  it("bộ chọn bỏ qua phần tử disabled và tabindex -1", () => {
    expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
    expect(FOCUSABLE_SELECTOR).not.toContain("button,");
  });
});
