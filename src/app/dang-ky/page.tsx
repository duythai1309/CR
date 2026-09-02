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
      caption="Một vụ lúa được ghi lại đầy đủ là một hồ sơ giảm phát thải kiểm chứng được."
      title="Tạo tài khoản"
      subtitle="Nông hộ không cần tài khoản riêng — cán bộ hợp tác xã nhập liệu hộ."
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
