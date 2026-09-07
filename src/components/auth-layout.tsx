import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  image: { src: string; alt: string };
  /** Câu ngắn dưới thẻ, nối cảnh trong ảnh với việc người dùng sắp làm. */
  caption: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  /** Thẻ rộng hơn cho biểu mẫu nhiều trường, đủ chỗ xếp hai cột. */
  wide?: boolean;
  eyebrow?: string;
  highlights?: string[];
};

/**
 * Khung chung cho hai trang đăng nhập và đăng ký: ảnh trải kín nền, biểu mẫu nằm
 * trong một thẻ trắng đè lên giữa màn hình.
 *
 * Ảnh và hai lớp phủ đều định vị tuyệt đối, còn thẻ để `relative` nên nó vẽ đè
 * lên mà không cần z-index âm. Lớp phủ tối là bắt buộc chứ không phải trang trí:
 * hai ảnh nền đều là cảnh hoàng hôn rất sáng, thiếu nó thì mép thẻ trắng lẫn vào
 * nền và chữ chú thích bên dưới không đọc được.
 *
 * `min-h-dvh` chứ không phải `h-dvh` để biểu mẫu đăng ký — vốn nhiều trường hơn
 * — vẫn cuộn được trên màn hình thấp thay vì bị cắt mất nút bấm.
 */
export function AuthLayout({
  image,
  caption,
  title,
  subtitle,
  children,
  footer,
  wide,
  eyebrow = "Carbon project workspace",
  highlights = ["7-stage design workflow", "Versioned evidence", "MRV calculation trace"],
}: Props) {
  return (
    <main className="relative isolate flex min-h-dvh items-center overflow-hidden px-4 py-8 sm:px-6 lg:px-10">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-forest-950/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-forest-950/45 via-transparent to-forest-950/75" />

      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/20 bg-forest-950/40 shadow-2xl shadow-forest-950/50 backdrop-blur-sm lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.85fr)]">
        <section className="hidden flex-col justify-between p-10 text-white lg:flex">
          <Link href="/" className="inline-flex items-center gap-2.5 text-white transition hover:text-mint-100">
            <RouteMark />
            <span className="text-base font-bold tracking-tight">C-route</span>
          </Link>
          <div className="max-w-xl py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mint-100">{eyebrow}</p>
            <p className="mt-4 text-3xl font-semibold leading-tight">
              Một workspace xuyên suốt từ Project concept đến MRV estimate.
            </p>
            <ul className="mt-7 grid gap-3 text-sm text-mint-100 sm:grid-cols-3">
              {highlights.map((item) => (
                <li key={item} className="border-l-2 border-mint-200 pl-3">{item}</li>
              ))}
            </ul>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-mint-100">{caption}</p>
        </section>

        <section className={`bg-white p-7 sm:p-10 ${wide ? "" : "lg:px-14"}`}>
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-forest-900 transition hover:text-forest-700 lg:hidden"
          >
            <RouteMark />
            <span className="text-base font-bold tracking-tight">C-route</span>
          </Link>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-leaf-700 lg:mt-0">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-forest-900">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-forest-600">{subtitle}</p>

          {children}

          <p className="mt-5 border-t border-mint-200 pt-4 text-sm text-forest-600">{footer}</p>
          <p className="mt-5 text-xs leading-relaxed text-forest-500 lg:hidden">{caption}</p>
        </section>
      </div>
    </main>
  );
}

/** Cùng dấu hiệu nhận diện với thanh điều hướng: lộ trình đi lên qua ba mốc. */
function RouteMark() {
  return (
    <svg
      aria-hidden
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    >
      <path d="M4 19l5-5 4 3 7-9" strokeLinejoin="round" />
      <circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="13" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="8" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
