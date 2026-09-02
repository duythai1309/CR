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
      caption="Mỗi bậc ruộng là một thửa riêng, có ranh giới riêng trong hồ sơ tín chỉ."
      title="Đăng nhập"
      subtitle="Dành cho cán bộ hợp tác xã và doanh nghiệp mua tín chỉ."
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
