"use client";

import { useActionState } from "react";
import { signUp } from "../auth-actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function SignupForm() {
  const [error, action, pending] = useActionState(signUp, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="account_kind" value="du_an" />
      <Alert tone="warn" title="Sau khi tạo tài khoản">
        Bạn tiếp tục tới Danh mục dự án để tạo dự án đầu tiên. Quyền chủ dự án, đơn vị
        phát triển và người xem được cấp riêng trên từng dự án.
      </Alert>

      <Field label="Họ và tên" hint="Tên người phụ trách tài khoản.">
        <Input name="full_name" required autoComplete="name" />
      </Field>
      <Field label="Tên tổ chức" hint="Đơn vị tư vấn hoặc doanh nghiệp phát triển dự án.">
        <Input name="company_name" required autoComplete="organization" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Số điện thoại (không bắt buộc)">
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
      </div>

      <Field label="Mật khẩu" hint="Dùng ít nhất 8 ký tự.">
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Ít nhất 8 ký tự"
        />
      </Field>

      {error && (
        <div role="alert" aria-live="polite">
          <Alert tone="error" title="Chưa thể tạo tài khoản">
            {error}
          </Alert>
        </div>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
      </Button>
    </form>
  );
}
