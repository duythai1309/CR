"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type HeroSlide = {
  /** Video nền; bỏ trống thì chỉ dùng `poster` làm ảnh tĩnh. */
  video?: string;
  poster: string;
  /** Mô tả cảnh quay/ảnh cho trình đọc màn hình. */
  media: string;
  /** Tiêu đề hai màu: phần đầu trắng, phần sau xanh bạc hà. */
  headline: string;
  accent: string;
  body: string;
};

const SLIDE_MS = 8000;
const TICK_MS = 50;

/**
 * Hero toàn khung xoay vòng giữa nhiều cảnh, kèm thanh tiến trình, chấm chỉ vị
 * trí và nút tạm dừng — dựng theo trang tham chiếu grassrootscarbon.com.
 *
 * Cả ba lớp media đều nằm sẵn trong DOM và chuyển bằng độ mờ, nhưng chỉ video
 * đang hiện mới được gắn `src`: nếu tải cả ba ngay thì mỗi lượt xem phải kéo về
 * gần 6 MB trước khi thấy được gì.
 */
export function HeroCarousel({
  slides,
  primary,
  secondary,
}: {
  slides: HeroSlide[];
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  /** Slide đã từng hiện: giữ `src` để quay vòng lần hai không tải lại. */
  const [seen, setSeen] = useState<number[]>([0]);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  const go = useCallback(
    (next: number) => {
      setIndex(((next % slides.length) + slides.length) % slides.length);
      setProgress(0);
    },
    [slides.length],
  );

  useEffect(() => {
    setSeen((s) => (s.includes(index) ? s : [...s, index]));
  }, [index]);

  // Chỉ video đang hiện được chạy; các video khác dừng để không tốn giải mã.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === index && !paused) void v.play().catch(() => {});
      else v.pause();
    });
  }, [index, paused, seen]);

  useEffect(() => {
    if (paused) return;
    // Người dùng bật giảm chuyển động: đứng yên ở cảnh đầu.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + TICK_MS / SLIDE_MS;
        if (next >= 1) {
          setIndex((i) => (i + 1) % slides.length);
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  const slide = slides[index];

  return (
    <section className="relative isolate flex min-h-[88vh] flex-col overflow-hidden bg-forest-900">
      {slides.map((s, i) => (
        <div
          key={s.poster}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          {s.video ? (
            <video
              ref={(el) => {
                videos.current[i] = el;
              }}
              src={seen.includes(i) ? s.video : undefined}
              poster={s.poster}
              muted
              loop
              playsInline
              preload="none"
              aria-label={s.media}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={s.poster}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover"
            />
          )}
        </div>
      ))}

      {/* Cảnh quay ngoài trời rất sáng; không có lớp phủ này thì chữ trắng biến mất. */}
      <div className="absolute inset-0 bg-gradient-to-b from-forest-950/70 via-forest-950/45 to-forest-950/85" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 py-28 sm:py-36">
        <h1 className="max-w-5xl text-[2.5rem] font-bold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
          {slide.headline}{" "}
          <span className="text-mint-400">{slide.accent}</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-mint-100 sm:text-xl">
          {slide.body}
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={primary.href}
            className="rounded-full bg-mint-500 px-8 py-4 text-base font-semibold text-forest-950 transition hover:bg-mint-400"
          >
            {primary.label}
          </Link>
          <Link
            href={secondary.href}
            className="rounded-full border border-white/70 px-8 py-4 text-base font-semibold text-white transition hover:bg-white hover:text-forest-900"
          >
            {secondary.label}
          </Link>
        </div>
      </div>

      {/* Thanh điều khiển: tiến trình bên trái, chấm và nút dừng bên phải. */}
      <div className="relative mx-auto flex w-full max-w-7xl items-center gap-6 px-6 pb-8">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-mint-400 transition-[width] duration-100 ease-linear"
            style={{ width: `${((index + progress) / slides.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center gap-2.5">
          {slides.map((s, i) => (
            <button
              key={s.poster}
              type="button"
              onClick={() => go(i)}
              aria-label={`Chuyển tới cảnh ${i + 1}`}
              aria-current={i === index}
              className={`h-2.5 w-2.5 rounded-full transition ${
                i === index ? "bg-mint-400" : "bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Tiếp tục" : "Tạm dừng"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 text-white transition hover:bg-white hover:text-forest-900"
        >
          {paused ? (
            <svg width="14" height="14" viewBox="0 0 12 14" fill="currentColor">
              <path d="M0 0v14l12-7z" />
            </svg>
          ) : (
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
              <rect x="0" y="0" width="4" height="14" rx="1" />
              <rect x="8" y="0" width="4" height="14" rx="1" />
            </svg>
          )}
        </button>
      </div>
    </section>
  );
}
