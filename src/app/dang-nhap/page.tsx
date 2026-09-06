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
      caption="Quản lý cấu trúc hồ sơ, bằng chứng và phiên bản dữ liệu trong một không gian làm việc có thể truy xuất."
      title="Đăng nhập workspace"
      subtitle="Dành cho đội ngũ phát triển dự án Carbon theo Verra, Gold Standard và các Standard tương tự."
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link href="/dang-ky" className="font-semibold text-leaf-700 underline underline-offset-2 hover:text-leaf-800">
            Đăng ký
          </Link>
        </>
      }
    >
      <LoginForm next={params["tiep-tuc"] ?? ""} />
    </AuthLayout>
  );
}
