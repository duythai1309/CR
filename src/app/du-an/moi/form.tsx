"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProject } from "../actions";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export function NewProjectForm() {
  const [error, action, pending] = useActionState(createProject, null);

  return (
    <form action={action} className="space-y-4">
      <Field label="Tên dự án" hint="Tối đa 200 ký tự.">
        <Input name="name" required maxLength={200} autoFocus placeholder="Ví dụ: Rừng ngập mặn Cà Mau" />
      </Field>

      <Field label="Mô tả sơ bộ" hint="Bước 1 của quy trình. Sửa lại sau lúc nào cũng được.">
        <Textarea name="description" rows={4} placeholder="Ý tưởng dự án, địa bàn, quy mô dự kiến…" />
      </Field>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Đang tạo…" : "Tạo dự án"}
        </Button>
        <Link href="/du-an" className="text-sm text-soil-600 hover:text-soil-900">
          Huỷ
        </Link>
      </div>
    </form>
  );
}
