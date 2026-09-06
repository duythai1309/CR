"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createPeriod } from "./actions";

export function CreatePeriodForm({ projectId }: { projectId: string }) {
  const [result, action, pending] = useActionState(createPeriod, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Tên kỳ">
          <Input name="name" required placeholder="Ví dụ: Kỳ 2026-1" />
        </Field>
        <Field label="Từ ngày">
          <Input name="start_date" type="date" required />
        </Field>
        <Field label="Đến ngày">
          <Input name="end_date" type="date" required />
        </Field>
        <Field label="Bản" hint="Tăng số này để hiệu chỉnh một kỳ đã khoá.">
          <Input name="version" type="number" min={1} defaultValue={1} required />
        </Field>
      </div>
      {result && <Alert tone={result.ok ? "ok" : "error"}>{result.message}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo kỳ giám sát"}
      </Button>
    </form>
  );
}
