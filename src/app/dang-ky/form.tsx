"use client";

import { useActionState, useState } from "react";
import { signUp } from "../auth-actions";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function SignupForm() {
  const [error, action, pending] = useActionState(signUp, null);
  const [role, setRole] = useState("coop_manager");

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Bạn là">
        <Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="coop_manager">Hợp tác xã nông nghiệp</option>
          <option value="buyer">Doanh nghiệp mua tín chỉ carbon</option>
        </Select>
      </Field>
      <Field label="Họ và tên">
        <Input name="full_name" required autoComplete="name" />
      </Field>
      {role === "buyer" && (
        <Field label="Tên doanh nghiệp">
          <Input name="company_name" required autoComplete="organization" />
        </Field>
      )}
      <Field label="Số điện thoại">
        <Input name="phone" type="tel" autoComplete="tel" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Mật khẩu" hint="Ít nhất 8 ký tự.">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
      </Button>
    </form>
  );
}
