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
export function AuthLayout({ image, caption, title, subtitle, children, footer, wide }: Props) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
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

      <div className={`relative w-full rounded-2xl bg-white p-7 shadow-2xl shadow-forest-950/50 sm:p-8 ${wide ? "max-w-lg" : "max-w-[26rem]"}`}>
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-forest-900 transition hover:text-forest-700"
        >
          <Sprout />
          <span className="text-base font-bold tracking-tight">Agri-Carbon Pass</span>
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-forest-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-forest-600">{subtitle}</p>

        {children}

        <p className="mt-5 border-t border-mint-200 pt-4 text-sm text-forest-600">{footer}</p>
      </div>

      <p className="relative mt-5 max-w-sm text-center text-sm leading-relaxed text-mint-100">
        {caption}
      </p>
    </main>
  );
}

/** Cùng dấu hiệu nhận diện với thanh điều hướng và favicon. */
function Sprout() {
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
      <path d="M12 21V9" />
      <path d="M12 12C12 8.5 9.5 6 6 6c0 3.5 2.5 6 6 6Z" />
      <path d="M12 10c0-3.3 2.4-5.6 5.6-5.6C17.6 7.7 15.3 10 12 10Z" />
      <path d="M6.5 21h11" />
    </svg>
  );
}
