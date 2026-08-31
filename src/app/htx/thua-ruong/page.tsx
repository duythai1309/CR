import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Card, Empty, Table } from "@/components/ui";
import { fmtHa } from "@/lib/format";
import { FieldEditor } from "./editor";

export const metadata: Metadata = { title: "Thửa ruộng" };

export default async function FieldsPage() {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const [{ data: farmers }, { data: fields }] = await Promise.all([
    supabase
      .from("farmers")
      .select("id, full_name, village")
      .eq("cooperative_id", profile.cooperative_id)
      .order("full_name"),
    supabase
      .from("fields_view")
      .select("id, name, farmer_name, area_ha, declared_area_ha, soil_type, geojson")
      .eq("cooperative_id", profile.cooperative_id)
      .order("created_at", { ascending: false }),
  ]);

  const totalArea = (fields ?? []).reduce((s, f) => s + Number(f.area_ha ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Thửa ruộng"
        description="Vẽ ranh từng thửa trên bản đồ. Diện tích tính từ hình học, không lấy số khai — và hệ thống báo ngay nếu ranh thửa chồng lên thửa đã có."
      />

      {farmers?.length ? (
        <FieldEditor
          farmers={farmers}
          existing={(fields ?? []).map((f) => ({
            name: f.name!,
            farmer: f.farmer_name!,
            geojson: f.geojson,
          }))}
        />
      ) : (
        <Empty
          title="Cần có nông hộ trước"
          hint={
            <>
              Mỗi thửa ruộng phải thuộc về một hộ. Hãy{" "}
              <Link href="/htx/nong-ho" className="text-leaf-700 hover:underline">
                thêm nông hộ
              </Link>{" "}
              trước đã.
            </>
          }
        />
      )}

      <div className="mt-6">
        <Card title={`Đã số hoá ${fields?.length ?? 0} thửa — tổng ${fmtHa(totalArea)}`}>
          {fields?.length ? (
            <Table head={["Thửa", "Nông hộ", "Diện tích đo", "Diện tích khai", "Chênh lệch", "Loại đất"]}>
              {fields.map((f) => {
                const measured = Number(f.area_ha ?? 0);
                const declared = f.declared_area_ha ? Number(f.declared_area_ha) : null;
                const diff = declared ? ((measured - declared) / declared) * 100 : null;
                return (
                  <tr key={f.id}>
                    <td className="px-3 py-2 font-medium text-soil-900">{f.name}</td>
                    <td className="px-3 py-2">{f.farmer_name}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtHa(measured)}</td>
                    <td className="px-3 py-2 tabular-nums">{declared ? fmtHa(declared) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {diff === null ? (
                        "—"
                      ) : (
                        <span className={Math.abs(diff) > 15 ? "text-carbon-700" : "text-soil-600"}>
                          {diff > 0 ? "+" : ""}
                          {diff.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{f.soil_type ?? "—"}</td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <Empty title="Chưa vẽ thửa nào" />
          )}
        </Card>
      </div>
    </>
  );
}
