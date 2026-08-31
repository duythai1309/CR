import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./form";

export const metadata: Metadata = { title: "Đăng ký" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-sm font-medium text-leaf-700 hover:underline">
        ← Agri-Carbon Pass
      </Link>
      <h1 className="text-2xl font-semibold text-soil-900">Tạo tài khoản</h1>
      <p className="mt-1 text-sm text-soil-600">
        Nông hộ không cần tài khoản riêng — cán bộ hợp tác xã nhập liệu hộ.
      </p>
      <SignupForm />
      <p className="mt-6 text-sm text-soil-600">
        Đã có tài khoản?{" "}
        <Link href="/dang-nhap" className="font-medium text-leaf-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </main>
  );
}
