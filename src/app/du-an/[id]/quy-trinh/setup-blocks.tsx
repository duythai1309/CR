import { Alert, Badge, Empty, Meta, SectionHeader } from "@/components/ui";
import type { FeasibilityAssessment, ProjectIdea, SelectionAdvice } from "@/types/project-setup";
import {
  DescriptionForm,
  FeasibilityPanel,
  IdeaForm,
  SelectionAdviceButton,
} from "../thiet-lap/forms";

/**
 * Phần nội dung của bốn bước đầu, gộp từ màn "Khởi tạo" cũ vào đúng khối bước của màn
 * Thiết kế.
 *
 * Trước đây hai màn tách rời: người dùng điền ý tưởng, mô tả và đánh giá khả thi ở
 * `thiet-lap`, rồi phải tự chuyển sang `quy-trinh` mới khoá và duyệt được. Chính trang cũ
 * viết ra câu đó — "Sang tab Quy trình để chọn và khoá Standard rồi Methodology" — nên nó
 * là một điểm gãy có chứng cứ, không phải suy đoán.
 *
 * Bốn khối dưới đây KHÔNG phải bốn stage mới. Chúng gắn vào stage 1–4 vốn cố định trong
 * `0013_project_platform.sql`, theo đúng `STAGE_HINT`:
 * stage 1 Project concept · stage 2 Feasibility · stage 3 Standard · stage 4 Methodology.
 */

/** Stage 1 — Project concept: ý tưởng và mô tả nằm cùng một chỗ với nút duyệt bước 1. */
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

/** Stage 2 — Feasibility assessment. */
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
          <h4 className="text-sm font-semibold text-soil-800">Điều đã biết</h4>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-soil-700">
            {known.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="text-sm font-semibold text-soil-800">
          Điều còn thiếu {gaps.length > 0 && <Badge tone="carbon">{gaps.length}</Badge>}
        </h4>
        {gaps.length === 0 ? (
          <p className="mt-2 text-sm text-soil-600">
            Chưa có khoảng trống nào được ghi nhận. Bấm “Nhờ trợ lý rà soát” để bắt đầu.
          </p>
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

      <FeasibilityPanel
        projectId={projectId}
        notes={feasibility.notes ?? ""}
        canEdit={canEdit}
        hasInput={hasInput}
      />
    </div>
  );
}

/**
 * Stage 3 và 4 — gợi ý của trợ lý, đặt NGAY TRÊN picker của chính bước đó.
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
        description="Đối chiếu loại hình dự án ở bước 1 với catalog Methodology trong hệ thống. Gợi ý không chốt thay bạn."
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
          hint="Trợ lý cần loại hình dự án ở bước 1 để đối chiếu với catalog."
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
