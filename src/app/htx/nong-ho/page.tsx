import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Card, Empty, Table } from "@/components/ui";
import { fmtHa } from "@/lib/format";
import { AddFarmerForm } from "./form";

export const metadata: Metadata = { title: "Nông hộ" };

export default async function FarmersPage() {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const { data: farmers } = await supabase
    .from("farmers")
    .select("id, full_name, phone, village, member_code, fields ( id, area_ha )")
    .eq("cooperative_id", profile.cooperative_id)
    .order("full_name");

  return (
    <>
      <PageHeader
        title="Nông hộ"
        description="Danh sách hộ tham gia dự án. Nông hộ không cần tài khoản đăng nhập — cán bộ hợp tác xã nhập liệu hộ."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title={`Danh sách (${farmers?.length ?? 0} hộ)`}>
          {farmers?.length ? (
            <Table head={["Họ tên", "Mã xã viên", "Thôn / xóm", "Điện thoại", "Số thửa", "Diện tích"]}>
              {farmers.map((f) => {
                const area = (f.fields ?? []).reduce((s, x) => s + Number(x.area_ha ?? 0), 0);
                return (
                  <tr key={f.id}>
                    <td className="px-3 py-2 font-medium text-soil-900">{f.full_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{f.member_code ?? "—"}</td>
                    <td className="px-3 py-2">{f.village ?? "—"}</td>
                    <td className="px-3 py-2">{f.phone ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{f.fields?.length ?? 0}</td>
                    <td className="px-3 py-2 tabular-nums">{area > 0 ? fmtHa(area) : "—"}</td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty
              title="Chưa có nông hộ nào"
              hint={
                <>
                  Thêm hộ đầu tiên ở khung bên cạnh, sau đó sang{" "}
                  <Link href="/htx/thua-ruong" className="text-leaf-700 hover:underline">
                    Thửa ruộng
                  </Link>{" "}
                  để vẽ ranh thửa của họ.
                </>
              }
            />
          )}
        </Card>

        <AddFarmerForm />
      </div>
    </>
  );
}
