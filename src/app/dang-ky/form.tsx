"use client";

import { useActionState } from "react";
import { signUp } from "../auth-actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function SignupForm() {
  const [error, action, pending] = useActionState(signUp, null);
  return (
    <form action={action} className="mt-5 space-y-3.5">
      <input type="hidden" name="account_kind" value="du_an" />
      <Alert tone="warn" title="Tài khoản tổ chức phát triển dự án">
        Sau khi đăng ký, quyền owner/developer/viewer được cấp riêng trên từng dự án.
      </Alert>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Họ và tên">
          <Input name="full_name" required autoComplete="name" />
        </Field>
        <Field label="Số điện thoại">
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
      </div>
      <Field label="Tên tổ chức">
        <Input name="company_name" required autoComplete="organization" />
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Mật khẩu">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Ít nhất 8 ký tự"
          />
        </Field>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
      </Button>
    </form>
  );
}
