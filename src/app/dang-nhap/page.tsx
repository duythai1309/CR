import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ "tiep-tuc"?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-sm font-medium text-leaf-700 hover:underline">
        ← Agri-Carbon Pass
      </Link>
      <h1 className="text-2xl font-semibold text-soil-900">Đăng nhập</h1>
      <p className="mt-1 text-sm text-soil-600">
        Dành cho cán bộ hợp tác xã và doanh nghiệp mua tín chỉ.
      </p>
      <LoginForm next={params["tiep-tuc"] ?? ""} />
      <p className="mt-6 text-sm text-soil-600">
        Chưa có tài khoản?{" "}
        <Link href="/dang-ky" className="font-medium text-leaf-700 hover:underline">
          Đăng ký
        </Link>
      </p>
    </main>
  );
}
