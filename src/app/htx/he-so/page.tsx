import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { PageHeader } from "@/components/app-nav";
import { Alert, Badge, Card, Table } from "@/components/ui";
import { CURRENT_METHODOLOGY } from "@/lib/mrv/factors";
import { REGION_LABEL, SEASON_TYPE_LABEL } from "@/lib/labels";
import {
  ACTIVE_REGION,
  ACTIVE_SEASON_TYPES,
  IPCC_GLOBAL_DEFAULT,
} from "@/lib/region";

export const metadata: Metadata = { title: "Hệ số phát thải" };

export default async function FactorsPage() {
  const profile = await requireCoopProfile();
  const supabase = await createClient();

  const [{ data: factors }, { data: coop }] = await Promise.all([
    supabase
      .from("emission_factors")
      .select("key, value, unit, description, source")
      .eq("version", CURRENT_METHODOLOGY)
      .order("key"),
    supabase.from("cooperatives").select("region").eq("id", profile.cooperative_id).single(),
  ]);

  const region = coop?.region ?? ACTIVE_REGION;
  // Chỉ trình bày hệ số của vùng đang triển khai. Cơ sở dữ liệu vẫn giữ đủ hệ số
  // của các vùng khác, sẵn sàng cho khi mở rộng.
  const prefix = `ef_c_${region}_`;
  const baseline = (factors ?? []).filter((f) => f.key.startsWith(prefix));
  const scaling = (factors ?? []).filter((f) => !f.key.startsWith("ef_c_"));

  return (
    <>
      <PageHeader
        title="Hệ số phát thải"
        description={`Phiên bản ${CURRENT_METHODOLOGY}. Mỗi kết quả tính lưu lại nguyên bộ hệ số đã dùng, nên con số cũ vẫn tra ngược được sau khi hệ số được cập nhật.`}
        action={<Badge tone="leaf">{REGION_LABEL[region]}</Badge>}
      />

      <Card title="Công thức">
        <pre className="overflow-x-auto rounded-lg bg-soil-900 px-4 py-3 text-sm text-leaf-200">
{`CH₄ = EFc × SFw × SFp × SFo × t × A
SFo = (1 + Σ ROAᵢ × CFOAᵢ)^0.59
N₂O = N × EF1 × 44/28`}
        </pre>
        <p className="mt-3 text-sm text-soil-600">
          EFc là hệ số nền, SFw theo chế độ nước trong vụ, SFp theo chế độ nước trước vụ,
          SFo theo chất hữu cơ bón vào, t là số ngày canh tác và A là diện tích.
        </p>
      </Card>

      <div className="mt-6">
        <Card
          title={`Hệ số phát thải nền EFc — ${REGION_LABEL[region]}`}
          description="Đây là đại lượng nhân trực tiếp vào toàn bộ kết quả. Hệ thống chọn dòng ứng với loại vụ đã khai, không dùng một giá trị chung cho cả năm."
        >
          <Alert tone="ok" title="Vì sao không dùng mặc định của IPCC">
            Mặc định toàn cầu của IPCC là {IPCC_GLOBAL_DEFAULT} kg CH₄/ha/ngày. Số đo
            thực địa ở Đồng bằng sông Hồng cho thấy cao hơn nhiều, và hai vụ trong năm
            chênh nhau rõ rệt — Vụ Mùa phát thải nền gần gấp đôi Vụ Xuân. Dùng một con
            số chung sẽ tính thiếu lượng giảm phát thải mà nông dân đáng được ghi nhận.
          </Alert>

          <div className="mt-4">
            <Table head={["Khoá", "Giá trị", "So với mặc định IPCC", "Diễn giải", "Nguồn"]}>
              {baseline.map((f) => (
                <tr key={f.key} className="bg-leaf-50">
                  <td className="px-3 py-2 font-mono text-xs text-soil-800">{f.key}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{f.value}</td>
                  <td className="px-3 py-2 tabular-nums text-carbon-700">
                    cao hơn{" "}
                    {Math.round((Number(f.value) / IPCC_GLOBAL_DEFAULT - 1) * 100)}%
                  </td>
                  <td className="px-3 py-2 text-soil-600">{f.description ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-soil-600">{f.source ?? "—"}</td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card
          title={`Hệ số quy đổi và hệ số điều chỉnh (${scaling.length} giá trị)`}
          description="Các hệ số này lấy theo giá trị toàn cầu của IPCC vì chúng không phụ thuộc vùng miền."
        >
          <Table head={["Khoá", "Giá trị", "Đơn vị", "Diễn giải", "Nguồn"]}>
            {scaling.map((f) => (
              <tr key={f.key}>
                <td className="px-3 py-2 font-mono text-xs text-soil-800">{f.key}</td>
                <td className="px-3 py-2 font-medium tabular-nums">{f.value}</td>
                <td className="px-3 py-2 text-soil-600">{f.unit ?? "—"}</td>
                <td className="px-3 py-2 text-soil-600">{f.description ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-soil-600">{f.source ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <p className="mt-6 text-sm text-soil-600">
        Hai vụ lúa nước trong năm ở {REGION_LABEL[region]}:{" "}
        {ACTIVE_SEASON_TYPES.map((t) => SEASON_TYPE_LABEL[t]).join(" · ")}.
      </p>
    </>
  );
}
