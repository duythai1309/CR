import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./form";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Đăng ký" };

export default function SignupPage() {
  return (
    <AuthLayout
      wide
      image={{
        src: "/anh/dong-lua-hoang-hon.jpg",
        alt: "Cánh đồng lúa chín trải rộng dưới trời hoàng hôn",
      }}
      caption="Tạo tài khoản một lần, rồi bắt đầu dự án đầu tiên với bảy stage thiết kế được dựng sẵn theo đúng thứ tự."
      title="Tạo tài khoản dự án"
      subtitle="Dành cho đơn vị tư vấn hoặc doanh nghiệp phát triển dự án carbon. Không cần khai báo dự án ở bước này."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link href="/dang-nhap" className="font-semibold text-leaf-700 underline underline-offset-2 hover:text-leaf-800">
            Đăng nhập để tiếp tục
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthLayout>
  );
}
