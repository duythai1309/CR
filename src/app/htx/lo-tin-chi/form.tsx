"use client";

import { useActionState, useEffect, useRef } from "react";
import { createBatch } from "./actions";
import { Alert, Button, Card, Empty, Field, Input, Select, Textarea } from "@/components/ui";

export function NewBatchForm({ seasons }: { seasons: Array<{ id: string; name: string }> }) {
  const [error, action, pending] = useActionState(createBatch, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !error) ref.current?.reset();
  }, [pending, error]);

  if (seasons.length === 0) {
    return (
      <Card title="Tạo lô tín chỉ">
        <Empty title="Cần có mùa vụ trước" hint="Mỗi lô gom kết quả của một mùa vụ." />
      </Card>
    );
  }

  return (
    <Card title="Tạo lô tín chỉ">
      <form ref={ref} action={action} className="space-y-4">
        <Field label="Mùa vụ">
          <Select name="season_id" required defaultValue="">
            <option value="" disabled>— Chọn vụ —</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tên lô">
          <Input name="name" required placeholder="Lúa AWD Vụ Xuân 2026" />
        </Field>
        <Field
          label="Đệm rủi ro (%)"
          hint="Phần giữ lại không bán, theo thông lệ Verra thường 10–20%."
        >
          <Input name="buffer_pct" type="number" step="0.1" min="0" max="100" defaultValue="15" />
        </Field>
        <Field label="Mô tả">
          <Textarea name="description" rows={3} placeholder="Vùng canh tác, kỹ thuật áp dụng…" />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Đang tạo…" : "Tạo lô"}
        </Button>
      </form>
    </Card>
  );
}
