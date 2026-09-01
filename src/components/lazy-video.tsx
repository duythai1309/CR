"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  /** Khung hình đứng thay trong lúc video chưa tải, và đứng vĩnh viễn nếu video không chạy được. */
  poster: string;
  /** Mô tả cảnh quay cho trình đọc màn hình. */
  label: string;
  className?: string;
  /** Video nằm trong khung hình đầu: tải ngay thay vì chờ cuộn tới. */
  eager?: boolean;
};

/**
 * Video nền tự chạy, chỉ tải khi sắp lọt vào tầm nhìn và dừng khi cuộn qua.
 *
 * Trang này có ba video; để cả ba tự tải cùng lúc là ép mỗi lượt xem tải về gần
 * 9 MB dù người dùng có cuộn xuống hay không. Mỗi video vì thế bắt đầu với
 * `preload="none"` và chỉ được gắn `src` khi IntersectionObserver báo sắp tới.
 *
 * `muted` + `playsInline` là bắt buộc, thiếu một trong hai thì Safari/iOS từ chối
 * tự phát. Trình duyệt vẫn có quyền chặn — khi đó `play()` reject và ảnh poster ở lại.
 */
export function LazyVideo({ src, poster, label, className, eager = false }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Người dùng bật chế độ giảm chuyển động của hệ điều hành: giữ nguyên ảnh tĩnh.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (eager) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  // Đã tải một lần thì giữ `src`, cuộn qua cuộn lại không tải thêm lần nữa.
  useEffect(() => {
    if (visible) setLoaded(true);
  }, [visible]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible && loaded) void el.play().catch(() => {});
    else if (!visible) el.pause();
  }, [visible, loaded]);

  return (
    <video
      ref={ref}
      src={loaded ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      className={className}
    />
  );
}
