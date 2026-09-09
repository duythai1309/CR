import { Alert, Badge, Empty, LinkButton, Meta, SectionHeader } from "@/components/ui";
import type { FeasibilityAssessment, ProjectIdea, SelectionAdvice } from "@/types/project-setup";
import {
  DescriptionForm,
  FeasibilityPanel,
  IdeaForm,
  SelectionAdviceButton,
} from "../thiet-lap/forms";

/**
 * Phần nội dung của bốn hồ sơ đầu, gộp từ màn "Khởi tạo" cũ vào đúng mục của màn
 * Thiết kế.
 *
 * Trước đây hai màn tách rời: người dùng điền ý tưởng, mô tả và đánh giá khả thi ở
 * `thiet-lap`, rồi phải tự chuyển sang `quy-trinh` mới khoá được. Chính trang cũ
 * viết ra câu đó — "Sang tab Quy trình để chọn và khoá Standard rồi Methodology" — nên nó
 * là một điểm gãy có chứng cứ, không phải suy đoán.
 *
 * Bốn khối dưới đây gắn với record stage cố định trong DB để giữ tương thích với tài liệu
 * cũ. Trên giao diện chúng là hồ sơ có thể xây dựng song song, không phải đầu việc.
 */

/** Hồ sơ Project Idea: ý tưởng và mô tả dự án. */
export function StageIdeaBlock({
  projectId,
  idea,
  description,
  canEdit,
}: {
  projectId: string;
  idea: ProjectIdea;
  description: string;
  canEdit: boolean;
}) {
  return (
    <div className="grid gap-5">
      <div>
        <SectionHeader title="Ý tưởng dự án" description="Project idea" />
        <IdeaForm projectId={projectId} idea={idea} canEdit={canEdit} />
      </div>

      <div className="border-t border-soil-100 pt-5">
        <SectionHeader title="Mô tả dự án" description="Project description" />
        <DescriptionForm projectId={projectId} description={description} canEdit={canEdit} />
      </div>
    </div>
  );
}

/** Hồ sơ Feasibility Assessment. */
export function StageFeasibilityBlock({
  projectId,
  feasibility,
  canEdit,
  hasInput,
}: {
  projectId: string;
  feasibility: FeasibilityAssessment;
  canEdit: boolean;
  hasInput: boolean;
}) {
  const known = feasibility.known ?? [];
  const gaps = feasibility.gaps ?? [];

  return (
    <div className="grid gap-4">
      <Alert tone="warn" title="Trợ lý không kết luận dự án có khả thi hay không">
        Nó rà soát chính những gì bạn đã nhập, liệt kê điều đã biết và chỉ ra điều còn
        thiếu kèm bằng chứng cần thu thập. Kết luận là việc của chuyên gia và được ghi
        trong ô nhận định bên dưới — ràng buộc này được cưỡng chế ở tầng cơ sở dữ liệu,
        không chỉ ở giao diện.
      </Alert>

      {known.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-soil-800">Điều đã biết</h3>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-soil-700">
            {known.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-soil-800">
          Điều còn thiếu {gaps.length > 0 && <Badge tone="carbon">{gaps.length}</Badge>}
        </h3>
        {gaps.length === 0 ? (
          <div className="mt-2">
            <Empty
              title="Chưa ghi nhận khoảng trống"
              hint="Nhờ trợ lý rà nội dung đã nhập và đề xuất bằng chứng cần thu thập."
              action={
                canEdit ? (
                  <LinkButton href="#ra-soat-kha-thi">Nhờ trợ lý rà soát</LinkButton>
                ) : (
                  <LinkButton href={`/du-an/${projectId}/thanh-vien`} variant="secondary">
                    Xem người phụ trách dự án
                  </LinkButton>
                )
              }
            />
          </div>
        ) : (
          <ul className="mt-2 grid gap-2">
            {gaps.map((g, i) => (
              <li key={i} className="rounded-lg border border-soil-200 bg-white px-3 py-2 text-sm">
                <p className="font-medium text-soil-900">{g.topic}</p>
                <p className="text-soil-700">{g.missing}</p>
                {g.evidence_needed && (
                  <p className="mt-1 text-soil-600">
                    <span className="font-medium">Bằng chứng cần có:</span> {g.evidence_needed}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {feasibility.assessed_at && (
        <Meta label="Trợ lý rà soát lần cuối">
          {new Date(feasibility.assessed_at).toLocaleString("vi-VN")}
        </Meta>
      )}

      <div id="ra-soat-kha-thi" className="scroll-mt-6">
        <FeasibilityPanel
          projectId={projectId}
          notes={feasibility.notes ?? ""}
          canEdit={canEdit}
          hasInput={hasInput}
        />
      </div>
    </div>
  );
}

/**
 * Gợi ý của trợ lý cho hai hồ sơ Standard và Methodology.
 *
 * Gợi ý không tự chốt gì; nút khoá vẫn là `StandardPicker`/`MethodologyPicker` bên dưới,
 * vẫn đi qua RPC cũ. Thay đổi duy nhất là người dùng không còn phải đổi tab giữa lúc đọc
 * gợi ý và lúc chốt.
 */
export function StageSelectionAdviceBlock({
  projectId,
  advice,
  canEdit,
  hasProjectType,
}: {
  projectId: string;
  advice: SelectionAdvice;
  canEdit: boolean;
  hasProjectType: boolean;
}) {
  const candidates = advice.candidates ?? [];
  const hasSample = candidates.some((c) => c.is_sample);

  return (
    <div className="grid gap-4 rounded-lg border border-soil-200 bg-soil-50 p-4">
      <SectionHeader
        title="Gợi ý của trợ lý"
        description="Đối chiếu loại hình trong hồ sơ Project Idea với catalog Methodology của hệ thống. Gợi ý không chốt thay bạn."
      />

      {hasSample && (
        <Alert tone="warn" title="Có methodology MẪU trong danh sách gợi ý">
          {advice.disclaimer ??
            "Các methodology gắn nhãn MẪU do nhóm tự soạn, chưa được thẩm định chuyên môn, và không phải methodology được Verra hay Gold Standard công nhận."}
        </Alert>
      )}

      {candidates.length === 0 ? (
        <Empty
          title="Chưa có gợi ý nào"
          hint="Trợ lý cần loại hình trong hồ sơ Project Idea để đối chiếu với catalog."
          action={
            <SelectionAdviceButton
              projectId={projectId}
              canEdit={canEdit}
              hasType={hasProjectType}
            />
          }
        />
      ) : (
        <>
          <ul className="grid gap-2">
            {candidates.map((c) => (
              <li
                key={c.methodology_id}
                className="rounded-lg border border-soil-200 bg-white px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="carbon">{c.standard_code}</Badge>
                  <span className="font-mono text-sm text-soil-900">{c.code}</span>
                  <span className="text-xs text-soil-600">v{c.version}</span>
                  <span className="text-xs text-soil-600">· {c.project_type}</span>
                  {c.is_sample && <Badge tone="red">MẪU — chưa thẩm định</Badge>}
                </div>
                <p className="mt-1 text-sm text-soil-700">{c.why}</p>
              </li>
            ))}
          </ul>
          <SelectionAdviceButton
            projectId={projectId}
            canEdit={canEdit}
            hasType={hasProjectType}
          />
        </>
      )}
    </div>
  );
}
