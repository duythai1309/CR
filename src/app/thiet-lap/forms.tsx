"use client";

import { useActionState, useState } from "react";
import { createCooperative, joinCooperative } from "./actions";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { REGION_LABEL } from "@/lib/labels";
import { ACTIVE_REGION } from "@/lib/region";

export function SetupForms() {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [createError, createAction, creating] = useActionState(createCooperative, null);
  const [joinError, joinAction, joining] = useActionState(joinCooperative, null);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex gap-2">
        <Button variant={mode === "create" ? "primary" : "secondary"} onClick={() => setMode("create")}>
          Tạo hợp tác xã mới
        </Button>
        <Button variant={mode === "join" ? "primary" : "secondary"} onClick={() => setMode("join")}>
          Gia nhập bằng mã
        </Button>
      </div>

      {mode === "create" ? (
        <Card title="Hồ sơ hợp tác xã">
          <form action={createAction} className="space-y-4">
            <Field label="Tên hợp tác xã">
              <Input name="name" required placeholder="HTX Nông nghiệp Đông Hưng" />
            </Field>
            <Field
              label="Mã hợp tác xã"
              hint="Mã ngắn, không dấu. Cán bộ khác dùng mã này để gia nhập."
            >
              <Input name="code" required placeholder="DONGHUNG" pattern="[A-Za-z0-9\-]{3,20}" />
            </Field>
            {/* Từ 01/7/2025 Việt Nam bỏ cấp huyện: địa chỉ hành chính chỉ còn
                tỉnh/thành phố và xã/phường. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tỉnh / Thành phố">
                <Input name="province" required placeholder="Hưng Yên" />
              </Field>
              <Field label="Xã / Phường">
                <Input name="commune" placeholder="Phường Thái Bình" />
              </Field>
            </div>
            {/* Nền tảng đang triển khai riêng cho miền Bắc nên không hỏi vùng;
                hệ số phát thải nền lấy theo ACTIVE_REGION. */}
            <div className="rounded-lg border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm">
              <span className="font-medium text-leaf-900">
                Vùng triển khai: {REGION_LABEL[ACTIVE_REGION]}
              </span>
              <p className="mt-1 text-leaf-800">
                Hệ số phát thải nền sẽ lấy theo số đo tại Đồng bằng sông Hồng.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Người liên hệ">
                <Input name="contact_name" />
              </Field>
              <Field label="Điện thoại liên hệ">
                <Input name="contact_phone" type="tel" />
              </Field>
            </div>
            {createError && <Alert tone="error">{createError}</Alert>}
            <Button type="submit" disabled={creating}>
              {creating ? "Đang tạo…" : "Tạo hợp tác xã"}
            </Button>
          </form>
        </Card>
      ) : (
        <Card
          title="Gia nhập hợp tác xã đã có"
          description="Bạn sẽ vào với quyền cán bộ nhập liệu."
        >
          <form action={joinAction} className="space-y-4">
            <Field label="Mã hợp tác xã">
              <Input name="code" required placeholder="DONGHUNG" />
            </Field>
            {joinError && <Alert tone="error">{joinError}</Alert>}
            <Button type="submit" disabled={joining}>
              {joining ? "Đang gia nhập…" : "Gia nhập"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
