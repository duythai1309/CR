import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav, PageHeader } from "@/components/app-nav";
import { Alert, Badge, Card, Empty, LinkButton, Table } from "@/components/ui";
import { listStandards } from "@/app/du-an/data";
import { CreateMethodologyForm, FactorForm, PublishButton, ValidateForm } from "./forms";

export const metadata: Metadata = { title: "Catalog Methodology" };

/**
 * Quản trị catalog Standard và Methodology.
 *
 * Trước màn hình này, cách duy nhất đưa methodology vào hệ thống là viết migration SQL —
 * bốn methodology hiện có đều được seed bằng `0014`. Nghĩa là kể cả khi có tài liệu gốc
 * thật trong tay, vẫn phải nhờ người viết SQL mới nhập được. Đó là cái cửa còn thiếu.
 *
 * Ba trạng thái của một methodology, và chúng độc lập nhau:
 *
 *   `status`                    draft → published. Published là bất biến kỹ thuật.
 *   `is_sample`                 dữ liệu tự soạn để thử luồng, hay methodology có thật.
 *   `professionally_validated`  đã có người đối chiếu với tài liệu gốc và chịu trách nhiệm.
 *
 * Người ta hay nhầm ba cái làm một. Một methodology bóc tách từ PDF gốc của Verra là
 * `is_sample = false` nhưng vẫn `professionally_validated = false` cho tới khi có người
 * đọc lại từng công thức. `create_mrv_report` chỉ cho xuất bản `final` khi cờ thứ ba bật.
 */
export default async function CatalogPage() {
  const profile = await requireProfile();
  if (profile.role !== "platform_admin") redirect("/");

  const supabase = await createClient();
  const [standards, { data: methodologies }, { data: factors }] = await Promise.all([
    listStandards(),
    supabase.from("methodologies").select("*").order("code"),
    supabase.from("methodology_factors").select("methodology_id, key, unit, value"),
  ]);

  const rows = (methodologies ?? []) as Array<Record<string, unknown>>;
  const factorRows = (factors ?? []) as Array<{ methodology_id: string; key: string }>;
  const factorCount = new Map<string, number>();
  for (const f of factorRows) {
    factorCount.set(f.methodology_id, (factorCount.get(f.methodology_id) ?? 0) + 1);
  }

  const drafts = rows.filter((m) => m.status === "draft");

  return (
    <>
      <AppNav profile={profile} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageHeader
          title="Catalog Methodology"
          description="Standard và Methodology dùng chung cho mọi dự án trên nền tảng."
        />

        <div className="mt-6 grid gap-6">
          <Alert tone="warn" title="Ba trạng thái độc lập nhau">
            <span className="font-medium">status</span> là draft hay published —
            published thì bất biến, sửa phải tạo version mới.{" "}
            <span className="font-medium">is_sample</span> nói dữ liệu tự soạn hay
            methodology có thật.{" "}
            <span className="font-medium">professionally_validated</span> nói đã có người
            đối chiếu với tài liệu gốc và chịu trách nhiệm. Một methodology bóc tách từ PDF
            của Verra là có thật nhưng <em>chưa</em> được thẩm định — chỉ khi cờ thứ ba bật
            thì hệ thống mới cho xuất báo cáo bản <code>final</code>.
          </Alert>

          <Card title="Methodology trong catalog">
            {rows.length === 0 ? (
              <Empty
                title="Catalog trống"
                hint="Thêm methodology đầu tiên ở trạng thái draft, rồi bổ sung hệ số và kiểm tra trước khi publish."
                action={<LinkButton href="#them-methodology">Thêm methodology đầu tiên</LinkButton>}
              />
            ) : (
              <Table head={["Mã", "Tên", "Loại", "Trạng thái", "Hệ số", "Thẩm định"]}>
                <tbody>
                  {rows.map((m) => {
                    const id = String(m.id);
                    return (
                      <tr key={id}>
                        <td className="font-mono text-sm">
                          {String(m.code)}{" "}
                          <span className="text-soil-500">v{String(m.version)}</span>
                        </td>
                        <td>{String(m.name)}</td>
                        <td className="text-sm text-soil-600">{String(m.project_type)}</td>
                        <td>
                          <Badge tone={m.status === "published" ? "leaf" : "soil"}>
                            {String(m.status)}
                          </Badge>
                          {m.is_sample ? <Badge tone="carbon">MẪU</Badge> : null}
                        </td>
                        <td className="text-right tabular-nums">{factorCount.get(id) ?? 0}</td>
                        <td>
                          {m.professionally_validated ? (
                            <Badge tone="leaf">đã đối chiếu</Badge>
                          ) : (
                            <span className="text-sm text-soil-600">chưa</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          {drafts.length > 0 && (
            <Card
              title="Bản draft đang chờ"
              description="Thêm đủ hệ số theo factor_requirements rồi mới publish được."
            >
              <div className="grid gap-5">
                {drafts.map((m) => (
                  <div key={String(m.id)} className="rounded-lg border border-soil-200 p-4">
                    <p className="font-mono text-sm text-soil-900">
                      {String(m.code)} v{String(m.version)}
                    </p>
                    <p className="text-sm text-soil-600">{String(m.name)}</p>
                    <div className="mt-3 grid gap-4 lg:grid-cols-2">
                      <FactorForm methodologyId={String(m.id)} />
                      <PublishButton methodologyId={String(m.id)} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card
            title="Ghi nhận đối chiếu chuyên môn"
            description="Bật professionally_validated cho methodology có thật đã được đọc lại."
          >
            <ValidateForm
              methodologies={rows
                .filter((m) => !m.is_sample && !m.professionally_validated)
                .map((m) => ({
                  id: String(m.id),
                  label: `${String(m.code)} v${String(m.version)} — ${String(m.name)}`,
                }))}
            />
          </Card>

          <div id="them-methodology" className="scroll-mt-6">
            <Card
              title="Thêm methodology mới"
              description="Dán metric_schema đã bóc tách từ tài liệu gốc. Tạo ở trạng thái draft."
            >
              <CreateMethodologyForm
                standards={standards.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }))}
              />
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
