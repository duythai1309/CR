"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { ProjectIdea, ProjectTypeHint } from "@/types/project-setup";
import {
  runFeasibilityAssist,
  runSelectionAdvice,
  saveDescription,
  saveFeasibilityNotes,
  saveIdea,
  type SetupActionResult,
} from "./actions";

/**
 * Biểu mẫu của bốn bước khởi tạo.
 *
 * Tất cả dùng chung một hình dạng kết quả `SetupActionResult`, nên chỉ cần một chỗ hiển
 * thị lỗi/thành công. Thông báo lỗi lấy nguyên văn từ server: `projectSetupDatabaseError`
 * đã dịch những lỗi Postgres khó hiểu (thiếu cột, permission denied) thành câu người đọc
 * hiểu được, nên đừng bọc thêm một lớp diễn giải nữa ở đây.
 */

const PROJECT_TYPES: Array<{ value: ProjectTypeHint; label: string }> = [
  { value: "afolu", label: "AFOLU — lâm nghiệp, nông nghiệp, sử dụng đất" },
  { value: "energy", label: "Energy — năng lượng tái tạo, hiệu suất" },
  { value: "biogas", label: "Biogas — thu hồi khí sinh học" },
  { value: "waste", label: "Waste — xử lý chất thải" },
  { value: "cookstove", label: "Cookstove — bếp đun cải tiến" },
  { value: "other", label: "Khác" },
];

type State = SetupActionResult | null;

function Result({ state }: { state: State }) {
  if (!state) return null;
  return (
    <div className="mt-3">
      <Alert tone={state.ok ? "ok" : "error"}>{state.message}</Alert>
    </div>
  );
}

/** Bước 1 — ý tưởng dự án. */
export function IdeaForm({
  projectId,
  idea,
  canEdit,
}: {
  projectId: string;
  idea: ProjectIdea;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<State, FormData>(async (_prev, form) => {
    const num = (name: string) => {
      const raw = String(form.get(name) ?? "").trim();
      return raw === "" ? undefined : Number(raw);
    };
    const text = (name: string) => {
      const raw = String(form.get(name) ?? "").trim();
      return raw === "" ? undefined : raw;
    };
    return saveIdea(projectId, {
      problem: text("problem"),
      activity: text("activity"),
      project_type: (text("project_type") as ProjectTypeHint | undefined) ?? undefined,
      location: text("location"),
      scale: text("scale"),
      start_year: num("start_year"),
      crediting_years: num("crediting_years"),
      proponent: text("proponent"),
    });
  }, null);

  return (
    <form action={action} className="grid gap-4">
      <Field label="Vấn đề hoặc cơ hội giảm phát thải">
        <Textarea
          id="problem"
          name="problem"
          rows={3}
          defaultValue={idea.problem ?? ""}
          disabled={!canEdit}
          placeholder="Hiện trạng phát thải và vì sao có cơ hội can thiệp."
        />
      </Field>
      <Field label="Hoạt động sẽ triển khai">
        <Textarea
          id="activity"
          name="activity"
          rows={3}
          defaultValue={idea.activity ?? ""}
          disabled={!canEdit}
          placeholder="Việc cụ thể dự án làm để tạo ra lượng giảm phát thải."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại hình dự án" hint="Dùng để lọc catalog Methodology ở bước 4.">
          <Select id="project_type" name="project_type" defaultValue={idea.project_type ?? ""} disabled={!canEdit}>
            <option value="">— chưa xác định —</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Địa điểm">
          <Input id="location" name="location" defaultValue={idea.location ?? ""} disabled={!canEdit} />
        </Field>
        <Field label="Quy mô" hint="Kèm đơn vị: ha, số hộ, MW…">
          <Input id="scale" name="scale" defaultValue={idea.scale ?? ""} disabled={!canEdit} />
        </Field>
        <Field label="Đơn vị đề xuất (project proponent)">
          <Input id="proponent" name="proponent" defaultValue={idea.proponent ?? ""} disabled={!canEdit} />
        </Field>
        <Field label="Năm bắt đầu">
          <Input
            id="start_year"
            name="start_year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={idea.start_year ?? ""}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Số năm kỳ tín chỉ" hint="Crediting period, tính bằng năm.">
          <Input
            id="crediting_years"
            name="crediting_years"
            type="number"
            min={1}
            max={100}
            defaultValue={idea.crediting_years ?? ""}
            disabled={!canEdit}
          />
        </Field>
      </div>

      {canEdit ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu ý tưởng"}
          </Button>
        </div>
      ) : null}
      <Result state={state} />
    </form>
  );
}

/** Bước 2 — mô tả dự án. */
export function DescriptionForm({
  projectId,
  description,
  canEdit,
}: {
  projectId: string;
  description: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, form) => saveDescription(projectId, String(form.get("description") ?? "")),
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field
        label="Mô tả dự án"
       
        hint="Phần này là đầu vào cho trợ lý ở bước 3 — viết càng cụ thể thì khoảng trống nó chỉ ra càng đúng."
      >
        <Textarea
          id="description"
          name="description"
          rows={12}
          defaultValue={description}
          disabled={!canEdit}
          placeholder={
            "Ranh giới dự án, hiện trạng trước can thiệp, các bên liên quan, quyền sử dụng đất, " +
            "nguồn dữ liệu dự kiến dùng cho baseline và giám sát."
          }
        />
      </Field>
      {canEdit ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu mô tả"}
          </Button>
        </div>
      ) : null}
      <Result state={state} />
    </form>
  );
}

/**
 * Bước 3 — chạy trợ lý và ghi nhận định của con người.
 *
 * Hai việc cố ý tách rời: nút chạy trợ lý chỉ sinh `known[]` và `gaps[]`; ô nhận định là
 * nơi DUY NHẤT có kết luận, và do người viết. Ràng buộc này được cưỡng chế ở tầng DB
 * (`project_validate_setup` trong `0017`), không chỉ ở giao diện.
 */
export function FeasibilityPanel({
  projectId,
  notes,
  canEdit,
  hasInput,
}: {
  projectId: string;
  notes: string;
  canEdit: boolean;
  hasInput: boolean;
}) {
  const [assist, setAssist] = useState<State>(null);
  const [running, setRunning] = useState(false);

  const [noteState, noteAction, notePending] = useActionState<State, FormData>(
    async (_prev, form) => saveFeasibilityNotes(projectId, String(form.get("notes") ?? "")),
    null,
  );

  return (
    <div className="grid gap-5">
      {canEdit ? (
        <div>
          <Button
            type="button"
            disabled={running || !hasInput}
            onClick={async () => {
              setRunning(true);
              setAssist(await runFeasibilityAssist(projectId));
              setRunning(false);
            }}
          >
            {running ? "Trợ lý đang đọc hồ sơ…" : "Nhờ trợ lý rà soát"}
          </Button>
          {!hasInput ? (
            <p className="mt-2 text-sm text-soil-600">
              Điền ý tưởng và mô tả ở hai bước trên trước — trợ lý chỉ rà soát trên chính những gì bạn
              đã nhập.
            </p>
          ) : null}
          <Result state={assist} />
        </div>
      ) : null}

      <form action={noteAction} className="grid gap-3">
        <Field
          label="Nhận định của chuyên gia"
         
          hint="Đây là chỗ duy nhất được viết kết luận, và người viết chịu trách nhiệm về nó."
        >
          <Textarea id="notes" name="notes" rows={6} defaultValue={notes} disabled={!canEdit} />
        </Field>
        {canEdit ? (
          <div>
            <Button type="submit" variant="secondary" disabled={notePending}>
              {notePending ? "Đang lưu…" : "Lưu nhận định"}
            </Button>
          </div>
        ) : null}
        <Result state={noteState} />
      </form>
    </div>
  );
}

/** Bước 4 — nhờ trợ lý gợi ý Standard/Methodology. Việc chốt và khoá vẫn ở tab Quy trình. */
export function SelectionAdviceButton({
  projectId,
  canEdit,
  hasType,
}: {
  projectId: string;
  canEdit: boolean;
  hasType: boolean;
}) {
  const [state, setState] = useState<State>(null);
  const [running, setRunning] = useState(false);

  if (!canEdit) return null;

  return (
    <div>
      <Button
        type="button"
        disabled={running}
        onClick={async () => {
          setRunning(true);
          setState(await runSelectionAdvice(projectId));
          setRunning(false);
        }}
      >
        {running ? "Đang đối chiếu catalog…" : "Nhờ trợ lý gợi ý"}
      </Button>
      {!hasType ? (
        <p className="mt-2 text-sm text-soil-600">
          Chưa chọn loại hình dự án ở bước 1 nên trợ lý sẽ duyệt toàn bộ catalog thay vì lọc.
        </p>
      ) : null}
      <Result state={state} />
    </div>
  );
}
