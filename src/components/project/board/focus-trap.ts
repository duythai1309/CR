/**
 * Quản lý focus cho panel dạng dialog.
 *
 * Tách phần QUYẾT ĐỊNH ra khỏi phần chạm DOM: `nextFocusIndex` là hàm thuần, kiểm được
 * bằng `npm run test` mà không cần trình duyệt, còn phần đọc/ghi `document` nằm ở
 * `task-panel.tsx`. Chỗ dễ sai của bẫy focus là biên — phần tử đầu, phần tử cuối, và lúc
 * focus đang ở NGOÀI panel — nên đúng phần đó phải có test.
 */

/** Những thứ nhận được focus theo thứ tự tab tự nhiên; bỏ thứ đã bị gỡ khỏi vòng tab. */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Ô cần nhận focus khi bấm Tab, hoặc `null` để mặc trình duyệt tự đi tiếp.
 *
 * `activeIndex` là vị trí của phần tử đang focus trong danh sách, hoặc -1 khi focus đang ở
 * ngoài panel. Chỉ can thiệp ở đúng ba tình huống cần vòng lại; mọi bước Tab ở giữa để
 * nguyên cho trình duyệt, vì tự dời focus từng bước sẽ phá thứ tự tab tự nhiên.
 */
export function nextFocusIndex(
  count: number,
  activeIndex: number,
  shiftKey: boolean,
): number | null {
  if (count <= 0) return null;

  // Focus đang ở ngoài panel: kéo nó về đầu (Tab) hoặc cuối (Shift+Tab).
  if (activeIndex < 0) return shiftKey ? count - 1 : 0;

  if (shiftKey) return activeIndex === 0 ? count - 1 : null;
  return activeIndex === count - 1 ? 0 : null;
}
