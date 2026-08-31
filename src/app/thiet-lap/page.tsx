import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { SetupForms } from "./forms";

export const metadata: Metadata = { title: "Thiết lập hợp tác xã" };

export default async function SetupPage() {
  const profile = await getProfile();
  if (!profile) redirect("/dang-nhap");
  if (profile.role === "buyer") redirect("/cho");
  if (profile.cooperative_id) redirect("/htx");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-soil-900">Thiết lập hợp tác xã</h1>
      <p className="mt-2 text-soil-600">
        Chào {profile.full_name}. Trước khi nhập nhật ký canh tác, hãy tạo hồ sơ hợp tác
        xã của bạn — hoặc gia nhập một đơn vị đã có nếu đồng nghiệp đã tạo trước.
      </p>
      <SetupForms />
    </main>
  );
}
