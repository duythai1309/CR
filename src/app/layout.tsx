import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
});

export const metadata: Metadata = {
  title: {
    default: "Agri-Carbon Pass",
    template: "%s · Agri-Carbon Pass",
  },
  description:
    "Nền tảng số hoá MRV và kết nối tín chỉ carbon cho nông hộ nhỏ và hợp tác xã nông nghiệp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
