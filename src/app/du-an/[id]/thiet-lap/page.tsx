import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProjectMember } from "@/lib/auth";
import { Alert, Badge, Card, Empty, LinkButton, Meta, ProgressBar } from "@/components/ui";
import { abilitiesFor, approvedCount, groupTasksByStage, toStageView, toTaskCard } from "@/components/project/rules";
import { getProject, getStages, getTasks } from "../../data";
import { getProjectSetup } from "./data";
import { DescriptionForm, FeasibilityPanel, IdeaForm, SelectionAdviceButton } from "./forms";

export const metadata: Metadata = { title: "Khởi tạo dự án" };

/**
 * Luồng khởi tạo dự án Carbon — bốn bước dẫn dắt, có kanban tiến độ bên cạnh.
 *
 * Bốn bước (ý tưởng → mô tả → đánh giá khả thi → chọn Standard/Methodology) **không phải
 * bốn stage mới**. Chúng là cách dẫn dắt người dùng đi qua stage 1–4 vốn đã cố định trong
 * `0013_project_platform.sql`. Việc chốt và khoá lựa chọn, cũng như bấm duyệt từng bước,
 * vẫn nằm ở tab Quy trình và vẫn đi qua `approve_project_stage` — trang này không có
 * đường tắt nào vòng qua đó.
 *
 * Kanban ở cột phải cố ý chỉ đọc: giai đoạn khởi tạo là lúc người dùng cần *thấy* việc
 * đang tồn đọng ở bước nào, không phải lúc kéo-thả. Thao tác đầy đủ ở tab Bảng công việc.
 */
export default async function SetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await requireProjectMember(id);

  const [project, stages, tasks, setup] = await Promise.all([
    getProject(id),
    getStages(id),
    getTasks(id),
    getProjectSetup(id),
  ]);
  if (!project) notFound();

  const abilities = abilitiesFor(role, Boolean(project.deleted_at));
  const canEdit = abilities.canWriteTasks;

  const stageViews = stages.map(toStageView);
  const done = approvedCount(stageViews);
  const cards = tasks.map(toTaskCard);
  const grouped = groupTasksByStage(stageViews, cards);

  const idea = setup.idea ?? {};
  const description = setup.description ?? "";
  const feasibility = setup.feasibility ?? {};
  const advice = setup.selection_advice ?? {};

  const hasIdea = Object.values(idea).some((v) => v !== undefined && v !== "");
  const hasInput = hasIdea || description.trim().length > 0;
  const sampleCandidates = (advice.candidates ?? []).filter((c) => c.is_sample);

  const steps = [
    { n: 1, label: "Ý tưởng dự án", en: "Project idea", done: hasIdea },
    { n: 2, label: "Mô tả dự án", en: "Project description", done: description.trim().length > 0 },
    { n: 3, label: "Đánh giá khả thi", en: "Feasibility assessment", done: (feasibility.gaps ?? []).length > 0 || Boolean(feasibility.notes) },
    { n: 4, label: "Standard & Methodology", en: "Standard & methodology", done: Boolean(project.methodology_locked_at) },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid gap-6">
        <header>
          <h1 className="text-xl font-semibold text-soil-900">Khởi tạo dự án</h1>
          <p className="mt-1 max-w-2xl text-sm text-soil-600">
            Bốn bước dưới đây dẫn bạn qua bốn bước đầu của quy trình bảy bước. Việc chốt và
            khoá lựa chọn, cùng thao tác duyệt từng bước, vẫn nằm ở tab{" "}
            <a className="underline" href={`/du-an/${id}/quy-trinh`}>
              Quy trình
            </a>
            .
          </p>
        </header>

        <ol className="grid gap-2 sm:grid-cols-4">
          {steps.map((s) => (
            <li
              key={s.n}
              className={`rounded-lg border px-3 py-2 text-sm ${
                s.done ? "border-leaf-200 bg-leaf-50 text-leaf-800" : "border-soil-200 bg-white text-soil-600"
              }`}
            >
              <span className="block text-xs uppercase tracking-wide opacity-70">Bước {s.n}</span>
              <span className="block font-medium">{s.label}</span>
              <span className="block text-xs opacity-70">{s.en}</span>
            </li>
          ))}
        </ol>

        <Card title="Bước 1 — Ý tưởng dự án" description="Project idea">
          <IdeaForm projectId={id} idea={idea} canEdit={canEdit} />
        </Card>

        <Card title="Bước 2 — Mô tả dự án" description="Project description">
          <DescriptionForm projectId={id} description={description} canEdit={canEdit} />
        </Card>

        <Card title="Bước 3 — Đánh giá khả thi" description="Feasibility assessment · có trợ lý hỗ trợ">
          <Alert tone="warn" title="Trợ lý không kết luận dự án có khả thi hay không">
            Nó rà soát chính những gì bạn đã nhập, liệt kê điều đã biết và chỉ ra điều còn
            thiếu kèm bằng chứng cần thu thập. Kết luận là việc của chuyên gia và được ghi
            trong ô nhận định bên dưới — ràng buộc này được cưỡng chế ở tầng cơ sở dữ liệu,
            không chỉ ở giao diện.
          </Alert>

          <div className="mt-4 grid gap-5">
            {(feasibility.known ?? []).length > 0 ? (
              <section>
                <h3 className="text-sm font-semibold text-soil-800">Điều đã biết</h3>
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-soil-700">
                  {(feasibility.known ?? []).map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h3 className="text-sm font-semibold text-soil-800">
                Điều còn thiếu{" "}
                {(feasibility.gaps ?? []).length > 0 ? <Badge tone="carbon">{(feasibility.gaps ?? []).length}</Badge> : null}
              </h3>
              {(feasibility.gaps ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-soil-600">
                  Chưa có khoảng trống nào được ghi nhận. Bấm “Nhờ trợ lý rà soát” để bắt đầu.
                </p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {(feasibility.gaps ?? []).map((g, i) => (
                    <li key={i} className="rounded-lg border border-soil-200 bg-white px-3 py-2 text-sm">
                      <p className="font-medium text-soil-900">{g.topic}</p>
                      <p className="text-soil-700">{g.missing}</p>
                      {g.evidence_needed ? (
                        <p className="mt-1 text-soil-600">
                          <span className="font-medium">Bằng chứng cần có:</span> {g.evidence_needed}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {feasibility.assessed_at ? (
              <Meta label="Trợ lý rà soát lần cuối">{new Date(feasibility.assessed_at).toLocaleString("vi-VN")}</Meta>
            ) : null}

            <FeasibilityPanel
              projectId={id}
              notes={feasibility.notes ?? ""}
              canEdit={canEdit}
              hasInput={hasInput}
            />
          </div>
        </Card>

        <Card title="Bước 4 — Chọn Standard & Methodology" description="Standard & methodology · có trợ lý hỗ trợ">
          {sampleCandidates.length > 0 ? (
            <Alert tone="warn" title="Toàn bộ catalog hiện là dữ liệu MẪU">
              {advice.disclaimer ??
                "Các methodology dưới đây do nhóm tự soạn, chưa được thẩm định chuyên môn, và không phải methodology được Verra hay Gold Standard công nhận."}
            </Alert>
          ) : null}

          <div className="mt-4 grid gap-4">
            {(advice.candidates ?? []).length === 0 ? (
              <Empty
                title="Chưa có gợi ý nào"
                hint="Trợ lý đối chiếu loại hình dự án ở bước 1 với catalog Methodology trong hệ thống."
              />
            ) : (
              <ul className="grid gap-2">
                {(advice.candidates ?? []).map((c) => (
                  <li key={c.methodology_id} className="rounded-lg border border-soil-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="carbon">{c.standard_code}</Badge>
                      <span className="font-mono text-sm text-soil-900">{c.code}</span>
                      <span className="text-xs text-soil-600">v{c.version}</span>
                      <span className="text-xs text-soil-600">· {c.project_type}</span>
                      {c.is_sample ? <Badge tone="red">MẪU — chưa thẩm định</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-soil-700">{c.why}</p>
                  </li>
                ))}
              </ul>
            )}

            <SelectionAdviceButton projectId={id} canEdit={canEdit} hasType={Boolean(idea.project_type)} />

            <p className="text-sm text-soil-600">
              Gợi ý không tự chốt gì. Sang tab{" "}
              <a className="underline" href={`/du-an/${id}/quy-trinh`}>
                Quy trình
              </a>{" "}
              để chọn và khoá Standard rồi Methodology.
            </p>
          </div>
        </Card>
      </div>

      <aside className="grid content-start gap-4">
        <Card title="Tiến độ bảy bước">
          <ProgressBar value={done} max={7} label={`${done}/7 bước đã duyệt`} />
          <ul className="mt-3 grid gap-1 text-sm">
            {stageViews.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className={s.approvedAt ? "text-soil-500 line-through" : "text-soil-800"}>
                  {s.ordinal}. {s.title}
                </span>
                {s.approvedAt ? <Badge tone="leaf">đã duyệt</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Công việc theo bước" description="Chỉ đọc — thao tác ở tab Bảng công việc">
          {cards.length === 0 ? (
            <Empty title="Chưa có công việc nào" />
          ) : (
            <ul className="grid gap-3">
              {grouped.map(({ stage, tasks: list }) => {
                if (list.length === 0) return null;
                return (
                  <li key={stage.id}>
                    <p className="text-xs font-medium uppercase tracking-wide text-soil-500">
                      {stage.ordinal}. {stage.title}
                    </p>
                    <ul className="mt-1 grid gap-1">
                      {list.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate text-soil-800">{t.title}</span>
                          <Badge tone={t.status === "done" ? "leaf" : t.status === "blocked" ? "red" : "soil"}>
                            {t.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3">
            <LinkButton href={`/du-an/${id}`} variant="secondary">
              Mở bảng công việc
            </LinkButton>
          </div>
        </Card>
      </aside>
    </div>
  );
}
