"use client";

import { useActionState, useEffect, useRef } from "react";
import { addFarmer } from "./actions";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export function AddFarmerForm() {
  const [error, action, pending] = useActionState(addFarmer, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Xoá form sau khi thêm thành công để nhập liên tiếp nhiều hộ.
  useEffect(() => {
    if (!pending && !error) formRef.current?.reset();
  }, [pending, error]);

  return (
    <Card title="Thêm nông hộ">
      <form ref={formRef} action={action} className="space-y-4">
        <Field label="Họ và tên">
          <Input name="full_name" required placeholder="Nguyễn Văn A" />
        </Field>
        <Field label="Mã xã viên" hint="Không bắt buộc, nhưng giúp đối chiếu sổ sách hợp tác xã.">
          <Input name="member_code" placeholder="XV-001" />
        </Field>
        <Field label="Thôn / xóm">
          <Input name="village" />
        </Field>
        <Field label="Điện thoại">
          <Input name="phone" type="tel" />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Đang lưu…" : "Thêm nông hộ"}
        </Button>
      </form>
    </Card>
  );
}
