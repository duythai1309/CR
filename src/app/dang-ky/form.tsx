"use client";

import { useActionState, useState } from "react";
import { signUp } from "../auth-actions";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function SignupForm() {
  const [error, action, pending] = useActionState(signUp, null);
  const [role, setRole] = useState("coop_manager");

  return (
    <form action={action} className="mt-5 space-y-3.5">
      <Field label="Bạn là">
        <Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="coop_manager">Hợp tác xã nông nghiệp</option>
          <option value="buyer">Doanh nghiệp mua tín chỉ carbon</option>
        </Select>
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Họ và tên">
          <Input name="full_name" required autoComplete="name" />
        </Field>
        <Field label="Số điện thoại">
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
      </div>
      {role === "buyer" && (
        <Field label="Tên doanh nghiệp">
          <Input name="company_name" required autoComplete="organization" />
        </Field>
      )}
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
