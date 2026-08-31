import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Card, Empty, Table } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { SEASON_TYPE_LABEL } from "@/lib/labels";
import { NewSeasonForm } from "./form";

export const metadata: Metadata = { title: "Mùa vụ" };

export default async function SeasonsPage() {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const [{ data: seasons }, { data: coop }] = await Promise.all([
    supabase
      .from("seasons")
      .select("id, name, season_type, start_date, end_date, field_seasons ( id )")
      .eq("cooperative_id", profile.cooperative_id)
      .order("start_date", { ascending: false }),
    supabase.from("cooperatives").select("region").eq("id", profile.cooperative_id).single(),
  ]);

  return (
    <>
      <PageHeader
        title="Mùa vụ"
        description="Mỗi vụ là một chu kỳ tính phát thải riêng. Đăng ký các thửa tham gia rồi ghi nhật ký cho từng thửa trong vụ đó."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card title={`Các vụ đã tạo (${seasons?.length ?? 0})`}>
          {seasons?.length ? (
            <Table head={["Tên vụ", "Loại vụ", "Bắt đầu", "Kết thúc", "Số thửa đăng ký"]}>
              {seasons.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">
                    <Link href={`/htx/mua-vu/${s.id}`} className="font-medium text-leaf-700 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-soil-600">
                    {s.season_type ? SEASON_TYPE_LABEL[s.season_type] : "—"}
                  </td>
                  <td className="px-3 py-2">{fmtDate(s.start_date)}</td>
                  <td className="px-3 py-2">{fmtDate(s.end_date)}</td>
                  <td className="px-3 py-2 tabular-nums">{s.field_seasons?.length ?? 0}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title="Chưa có mùa vụ nào"
              hint="Tạo vụ đầu tiên ở khung bên cạnh, ví dụ “Đông Xuân 2025–2026”."
            />
          )}
        </Card>

        <NewSeasonForm region={coop?.region ?? "north"} />
      </div>
    </>
  );
}
