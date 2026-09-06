"use client";

import { useActionState, useState } from "react";
import { signUp } from "../auth-actions";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function SignupForm() {
  const [error, action, pending] = useActionState(signUp, null);
  // Gửi lên NGỮ CẢNH tài khoản, không phải giá trị enum `user_role`. Server ánh xạ sang
  // vai trò toàn cục (`src/app/auth-actions.ts`), nên trình duyệt không chọn được vai
  // trò tuỳ ý — dù `handle_new_user` cũng đã chặn ở tầng cơ sở dữ liệu.
  const [kind, setKind] = useState("du_an");

  return (
    <form action={action} className="mt-5 space-y-3.5">
      <Field label="Bạn là">
        <Select name="account_kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="du_an">Đơn vị phát triển dự án carbon</option>
          <option value="htx">Hợp tác xã nông nghiệp</option>
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
      {(kind === "buyer" || kind === "du_an") && (
        <Field label={kind === "buyer" ? "Tên doanh nghiệp" : "Tên tổ chức"}>
          <Input
            name="company_name"
            required={kind === "buyer"}
            autoComplete="organization"
          />
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
