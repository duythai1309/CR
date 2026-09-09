"use client";

import { useActionState } from "react";
import { signIn } from "../auth-actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="tiep-tuc" value={next} />
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Mật khẩu">
        <Input name="password" type="password" required autoComplete="current-password" />
      </Field>
      {error && (
        <div role="alert" aria-live="polite">
          <Alert tone="error" title="Chưa thể đăng nhập">
            {error}
          </Alert>
        </div>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
