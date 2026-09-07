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
    default: "C-route",
    template: "%s · C-route",
  },
  description:
    "Nền tảng quản lý vòng đời dự án Carbon cho đơn vị phát triển dự án: bảy bước thiết kế, " +
    "giám sát MRV và báo cáo ước tính theo Verra và Gold Standard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      {/*
        Tiện ích trình duyệt (Grammarly và tương tự) chèn thuộc tính vào <body>
        trước khi React hydrate, làm React báo lệch server/client. Đây là khác
        biệt do môi trường người dùng chứ không phải do mã, nên bỏ qua cảnh báo
        cho riêng thẻ này. suppressHydrationWarning chỉ có tác dụng một tầng, các
        lệch thật bên trong cây vẫn được báo bình thường.
      */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
