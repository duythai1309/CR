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
      caption="Khởi tạo workspace để tổ chức Project concept, Methodology, baseline, evidence và monitoring data theo một chuỗi phiên bản rõ ràng."
      title="Tạo workspace dự án"
      subtitle="Tài khoản dành cho đơn vị tư vấn hoặc doanh nghiệp phát triển dự án Carbon chuyên nghiệp."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link href="/dang-nhap" className="font-semibold text-leaf-700 underline underline-offset-2 hover:text-leaf-800">
            Đăng nhập
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthLayout>
  );
}
