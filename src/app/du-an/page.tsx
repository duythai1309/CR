import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-nav";
import { Badge, Card, Empty, LinkButton } from "@/components/ui";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
import { listMyProjects } from "./data";

export const metadata: Metadata = { title: "Dự án của tôi" };

export default async function ProjectListPage() {
  const projects = await listMyProjects();
  const active = projects.filter((p) => !p.deletedAt);
  const archived = projects.filter((p) => p.deletedAt);

  return (
    <>
      <PageHeader
        title="Dự án của tôi"
        description="Mỗi dự án đi qua bảy bước thiết kế theo quy trình chuẩn. Bạn chỉ thấy dự án mình là thành viên."
        action={<LinkButton href="/du-an/moi">Tạo dự án</LinkButton>}
      />

      {active.length === 0 && archived.length === 0 ? (
        <Empty
          title="Chưa có dự án nào"
          hint={
            <>
              Tạo dự án đầu tiên để bắt đầu. Người tạo tự động là chủ dự án, và bảy bước
              thiết kế được dựng sẵn.
            </>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...active, ...archived].map((p) => (
            <Link key={p.id} href={`/du-an/${p.id}`} className="group block">
              <article
                className={`h-full rounded-xl border border-soil-200 bg-white p-5 shadow-sm transition group-hover:border-leaf-500 ${
                  p.deletedAt ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-soil-900 group-hover:text-leaf-800">
                    {p.name}
                  </h2>
                  <Badge tone={p.role === "owner" ? "leaf" : "soil"}>
                    {PROJECT_ROLE_LABEL[p.role]}
                  </Badge>
                </div>

                {p.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-soil-600">{p.description}</p>
                )}

                <dl className="mt-4 space-y-1 text-xs text-soil-600">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0">Tiến độ</dt>
                    <dd className="font-medium text-soil-900">{p.approvedStages}/7 bước đã duyệt</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0">Standard</dt>
                    <dd>{p.standardCode ?? "chưa chọn"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0">Methodology</dt>
                    <dd>
                      {p.methodologyCode ?? "chưa chọn"}
                      {p.methodologySchemaHash && (
                        <span className="mt-0.5 block break-all font-mono text-[10px] text-soil-500">schema_hash: {p.methodologySchemaHash}</span>
                      )}
                    </dd>
                  </div>
                </dl>

                <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-soil-100"
                  role="img"
                  aria-label={`Đã duyệt ${p.approvedStages} trên 7 bước`}
                >
                  <div
                    className="h-full rounded-full bg-leaf-600"
                    style={{ width: `${(p.approvedStages / 7) * 100}%` }}
                  />
                </div>

                {p.deletedAt && (
                  <p className="mt-3 text-xs font-medium text-soil-500">
                    Đã xoá — chỉ xem lại lịch sử.
                  </p>
                )}
              </article>
            </Link>
          ))}
        </div>
      )}

      <Card title="Quy trình hồ sơ dự án — bảy stage">
        <ol className="grid gap-2 text-sm text-soil-700 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Project concept",
            "Feasibility assessment",
            "Standard selection",
            "Methodology selection",
            "Baseline scenario",
            "Additionality",
            "PDD — Project Design Document",
          ].map((title, i) => (
            <li key={title} className="rounded-lg border border-soil-200 px-3 py-2">
              <span className="mr-2 font-semibold text-leaf-800">{i + 1}</span>
              {title}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-soil-600">Luồng này dừng ở khâu chuẩn bị hồ sơ. Consultation, validation/registration và các bước verification bởi VVB, standard review, issuance nằm ngoài phạm vi phiên bản hiện tại.</p>
      </Card>
    </>
  );
}
