import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./form";
import { AuthLayout } from "@/components/auth-layout";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ "tiep-tuc"?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthLayout
      image={{
        src: "/anh/ruong-bac-thang-ha-giang.jpg",
        alt: "Ruộng bậc thang Hà Giang mùa lúa chín",
      }}
      caption="Quay lại danh mục để tiếp tục hồ sơ, bằng chứng và dữ liệu giám sát của các dự án bạn tham gia."
      title="Đăng nhập"
      subtitle="Dùng email và mật khẩu của bạn để tiếp tục tới Danh mục dự án."
      footer={
        <>
          Chưa có tài khoản dự án?{" "}
          <Link href="/dang-ky" className="font-semibold text-leaf-700 underline underline-offset-2 hover:text-leaf-800">
            Tạo tài khoản
          </Link>
        </>
      }
    >
      <LoginForm next={params["tiep-tuc"] ?? ""} />
    </AuthLayout>
  );
}
