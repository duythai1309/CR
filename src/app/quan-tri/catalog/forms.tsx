"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  addFactor,
  createMethodologyDraft,
  markProfessionallyValidated,
  publishMethodology,
  type CatalogResult,
} from "./actions";

type State = CatalogResult | null;

function Result({ state }: { state: State }) {
  if (!state) return null;
  return (
    <div className="mt-3">
      <Alert tone={state.ok ? "ok" : "error"}>{state.message}</Alert>
    </div>
  );
}

export function CreateMethodologyForm({
  standards,
}: {
  standards: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, form) => createMethodologyDraft(form),
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Standard">
          <Select name="standard_id" required>
            {standards.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mã methodology" hint="Đúng mã trong tài liệu gốc, ví dụ VM0051.">
          <Input name="code" required placeholder="VM0051" />
        </Field>
        <Field label="Version" hint="Version của tài liệu gốc, không phải version nội bộ.">
          <Input name="version" required placeholder="1.1" />
        </Field>
        <Field label="Loại hình dự án">
          <Select name="project_type" required>
            {["afolu", "energy", "biogas", "waste", "cookstove", "other"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Tên">
        <Input name="name" required placeholder="Improved Management in Rice Production Systems" />
      </Field>

      <Field
        label="metric_schema (JSON)"
        hint="Envelope v1: schema_version, fields[], factor_requirements[], calculations[]. Kiểm trước khi gửi, lỗi sẽ báo cụ thể."
      >
        <Textarea name="metric_schema" rows={12} required className="font-mono text-xs" />
      </Field>

      <Field
        label="Disclaimer"
        hint="Dữ liệu này đến từ đâu và đã được đối chiếu tới mức nào. Bắt buộc — đây là thứ người dùng đọc khi hệ thống hiện methodology."
      >
        <Textarea
          name="disclaimer"
          rows={3}
          required
          placeholder="Bóc tách từ tài liệu gốc VM0051 v1.1 của Verra. Chưa được chuyên gia đối chiếu. Phần ... chưa bóc tách được."
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-soil-700">
        <input type="checkbox" name="is_sample" className="h-4 w-4" />
        Đây là dữ liệu MẪU tự soạn để thử luồng, không phải methodology có thật
      </label>

      <p className="text-sm text-soil-600">
        Không có ô nào để bật <span className="font-medium">professionally_validated</span>{" "}
        ở đây. Cờ đó ghi nhận có người đối chiếu và chịu trách nhiệm, nên nó nằm ở biểu mẫu
        riêng và đòi tên người đối chiếu.
      </p>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang tạo…" : "Tạo bản draft"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function FactorForm({ methodologyId }: { methodologyId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, form) => {
      form.set("methodology_id", methodologyId);
      return addFactor(form);
    },
    null,
  );

  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm font-medium text-soil-800">Thêm hệ số</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Khoá">
          <Input name="key" required placeholder="ef_ch4_baseline" />
        </Field>
        <Field label="Giá trị">
          <Input name="value" required placeholder="1.30" />
        </Field>
        <Field label="Đơn vị">
          <Input name="unit" required placeholder="kgCH4/ha/d" />
        </Field>
      </div>
      <Field label="Nguồn" hint="Mục và trang trong tài liệu gốc. Số không nguồn thì không đối chiếu lại được.">
        <Input name="source" required placeholder="VM0051 v1.1, Bảng 3, tr. 42" />
      </Field>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Đang thêm…" : "Thêm hệ số"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function PublishButton({ methodologyId }: { methodologyId: string }) {
  const [state, setState] = useState<State>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid content-start gap-2">
      <p className="text-sm font-medium text-soil-800">Publish</p>
      <p className="text-sm text-soil-600">
        Sau khi publish, methodology bất biến — sửa là phải tạo version mới. Nhờ vậy báo cáo
        MRV đã sinh không bao giờ đổi số khi catalog được cập nhật.
      </p>
      <div>
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setState(await publishMethodology(methodologyId));
            setBusy(false);
          }}
        >
          {busy ? "Đang publish…" : "Publish"}
        </Button>
      </div>
      <Result state={state} />
    </div>
  );
}

export function ValidateForm({
  methodologies,
}: {
  methodologies: Array<{ id: string; label: string }>;
}) {
  const [id, setId] = useState(methodologies[0]?.id ?? "");
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, form) => markProfessionallyValidated(id, form),
    null,
  );

  if (methodologies.length === 0) {
    return (
      <p className="text-sm text-soil-600">
        Không có methodology nào đang chờ đối chiếu. Dữ liệu MẪU không xuất hiện ở đây — dữ
        liệu tự soạn thì không có gì để đối chiếu với tài liệu gốc.
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <Field label="Methodology">
        <Select value={id} onChange={(e) => setId(e.target.value)}>
          {methodologies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Người đối chiếu" hint="Tên thật của người đọc lại và chịu trách nhiệm.">
        <Input name="reviewer" required minLength={3} />
      </Field>
      <Field
        label="Đã đối chiếu những gì"
        hint="Mục nào của tài liệu gốc, công thức nào, hệ số nào. Ít nhất 20 ký tự."
      >
        <Textarea name="note" rows={4} required minLength={20} />
      </Field>
      <Alert tone="warn">
        Bật cờ này là mở đường cho báo cáo bản <code>final</code>. Con số trong báo cáo đó đi
        vào hồ sơ tín chỉ carbon, nên đừng bật cho đủ thủ tục. Tên và ghi chú sẽ được ghi vào
        disclaimer của methodology, không xoá được bằng giao diện.
      </Alert>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang ghi nhận…" : "Ghi nhận đã đối chiếu"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}
