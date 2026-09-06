"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProject } from "../actions";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

export function NewProjectForm() {
  const [error, action, pending] = useActionState(createProject, null);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Tên dự án"
        hint="Tối đa 200 ký tự. Tên này đi vào mọi màn hình và mọi báo cáo — đặt như bạn sẽ trích dẫn nó trong hồ sơ."
      >
        <Input
          name="name"
          required
          maxLength={200}
          autoFocus
          placeholder="Ví dụ: Mangrove restoration — Cà Mau"
        />
      </Field>

      <Field
        label="Project concept"
        hint="Nội dung của stage 1: phạm vi, địa điểm, ranh giới dự án và quy mô dự kiến. Sửa lại lúc nào cũng được."
      >
        <Textarea
          name="description"
          rows={5}
          placeholder="Loại hình dự án, ranh giới địa lý, quy mô dự kiến, crediting period nhắm tới…"
        />
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
