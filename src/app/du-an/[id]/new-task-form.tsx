"use client";

import { useActionState, useRef } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { createTask } from "./actions";

/**
 * Ô chọn người nhận việc liệt kê MỌI thành viên dự án — sau 0025 đó là
 * ràng buộc cơ sở dữ liệu (khoá ngoại ba cột ở `0013:131-132`), không phải lựa chọn giao
 * diện. Danh sách rỗng thì nói rõ vì sao thay vì hiện một ô chọn trống.
 */
export function NewTaskForm({
  projectId,
  stages,
  members,
}: {
  projectId: string;
  stages: Array<{ id: string; label: string; nextPosition: number }>;
  members: Array<{ userId: string; fullName: string }>;
}) {
  const [error, action, pending] = useActionState(createTask, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="position" value={(stages[0]?.nextPosition ?? 0) * 1000 + 1000} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tên công việc">
          <Input name="title" required maxLength={300} placeholder="Ví dụ: Thu thập dữ liệu trữ lượng" />
        </Field>
        <Field label="Thuộc bước">
          <Select name="stage_id" required defaultValue={stages[0]?.id ?? ""}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Giao cho"
          hint={
            members.length === 0
              ? "Dự án chưa có thành viên nào — mời thêm ở tab Thành viên."
              : "Giao được cho bất kỳ thành viên nào của dự án này."
          }
        >
          <Select name="assignee_id" defaultValue="">
            <option value="">Chưa giao</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hạn hoàn thành">
          <Input name="due_at" type="date" />
        </Field>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <Button type="submit" disabled={pending}>
        {pending ? "Đang thêm…" : "Thêm công việc"}
      </Button>
    </form>
  );
}
