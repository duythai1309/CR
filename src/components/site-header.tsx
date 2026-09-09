"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LEFT = [
  { href: "#cach-lam", label: "Vòng đời dự án" },
  { href: "#doanh-thu", label: "Không gian làm việc" },
];

const RIGHT = [
  { href: "#phuong-phap", label: "Methodology" },
  { href: "#cau-chuyen", label: "Truy xuất" },
];

type Props = {
  /** Đích của nút bấm chính: vào hệ thống nếu đã đăng nhập, không thì đăng ký. */
  ctaHref: string;
  ctaLabel: string;
};

/**
 * Thanh điều hướng dính, đổi màu theo vị trí cuộn.
 *
 * Ở đỉnh trang thanh này màu trắng, đặt trên dải thông báo xanh đậm. Khi cuộn
 * xuống, dải thông báo trôi đi và thanh chuyển sang nền xanh rừng — đúng cách
 * trang tham chiếu xử lý, và cũng là cách duy nhất giữ chữ đọc được khi nền phía
 * sau lúc sáng lúc tối.
 */
export function SiteHeader({ ctaHref, ctaLabel }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const link = scrolled
    ? "text-mint-100 hover:text-white"
    : "text-forest-800 hover:text-forest-950";

  return (
    <>
      {/* Dải thông báo — cuộn theo trang chứ không dính, giống trang tham chiếu. */}
      <div className="bg-forest-900 text-center">
        <a
          href="#phuong-phap"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-mint-100 transition hover:text-white"
        >
          Quản lý trọn vòng đời dự án carbon trên một nguồn dữ liệu có vết tính
          <span aria-hidden className="text-mint-400">→</span>
        </a>
      </div>

      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled ? "bg-forest-800" : "bg-white"
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center px-6 py-4">
          <div className="hidden flex-1 items-center gap-8 text-[15px] font-medium lg:flex">
            {LEFT.map((l) => (
              <a key={l.href} href={l.href} className={`transition ${link}`}>
                {l.label}
              </a>
            ))}
          </div>

          <Link
            href="/"
            className={`flex items-center gap-2.5 text-lg font-bold leading-tight tracking-tight transition ${
              scrolled ? "text-white" : "text-forest-900"
            }`}
          >
            <RouteMark className={scrolled ? "text-mint-400" : "text-forest-800"} />
            <span>C-ROUTE</span>
          </Link>

          <div className="hidden flex-1 items-center justify-end gap-8 text-[15px] font-medium lg:flex">
            {RIGHT.map((l) => (
              <a key={l.href} href={l.href} className={`transition ${link}`}>
                {l.label}
              </a>
            ))}
            <Link
              href={ctaHref}
              className={`rounded-full px-7 py-3 text-[15px] font-semibold transition ${
                scrolled
                  ? "bg-white text-forest-900 hover:bg-mint-100"
                  : "bg-forest-800 text-white hover:bg-forest-700"
              }`}
            >
              {ctaLabel}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Mở menu"
            className={`ml-auto lg:hidden ${scrolled ? "text-white" : "text-forest-900"}`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </nav>

        {open && (
          <div className={`lg:hidden ${scrolled ? "bg-forest-800" : "bg-white"} border-t border-white/10`}>
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
              {[...LEFT, ...RIGHT].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`py-2 text-base font-medium transition ${link}`}
                >
                  {l.label}
                </a>
              ))}
              <Link
                href={ctaHref}
                className="mt-3 rounded-full bg-mint-500 px-6 py-3 text-center font-semibold text-forest-950"
              >
                {ctaLabel}
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

/**
 * Dấu hiệu nhận diện của C-route: một lộ trình đi lên qua các mốc.
 *
 * Trước đây là mầm lúa vươn lên từ hai lá mạ — đúng với sản phẩm MRV lúa nước cũ, nhưng
 * lệch hẳn với nền tảng quản lý vòng đời dự án Carbon và với cái tên mới. Hình mới đọc
 * thẳng ra tên sản phẩm: một tuyến đường gấp khúc đi lên, ba mốc là các bước phải qua.
 */
function RouteMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Tuyến đi lên qua ba mốc */}
      <path d="M4 19l5-5 4 3 7-9" />
      {/* Ba mốc trên tuyến */}
      <circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="13" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="8" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
