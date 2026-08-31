"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildBatch, listBatch } from "../actions";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import type { Database } from "@/types/database";

type Status = Database["public"]["Enums"]["batch_status"];

export function BatchControls({
  batchId,
  status,
  itemCount,
  currentPrice,
  description,
}: {
  batchId: string;
  status: Status;
  itemCount: number;
  currentPrice: number | null;
  description: string | null;
}) {
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [price, setPrice] = useState(currentPrice ? String(currentPrice) : "");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      {description && (
        <Card title="Mô tả lô">
          <p className="text-sm text-soil-600">{description}</p>
        </Card>
      )}

      <Card title="Thao tác">
        {message && (
          <div className="mb-3">
            <Alert tone={message.tone === "ok" ? "ok" : "error"}>{message.text}</Alert>
          </div>
        )}

        {status === "draft" && (
          <>
            <p className="text-sm text-soil-600">
              Gộp sẽ thu tất cả thửa trong vụ đã có kết quả MRV dương, rồi khoá nhật ký của
              chúng lại để con số không đổi sau lưng hồ sơ.
            </p>
            <Button
              className="mt-3 w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await buildBatch(batchId);
                  setMessage({ tone: r.ok ? "ok" : "error", text: r.message });
                  if (r.ok) router.refresh();
                })
              }
            >
              {pending ? "Đang gộp…" : "Gộp kết quả của vụ"}
            </Button>
          </>
        )}

        {status === "draft" && itemCount > 0 && (
          <div className="mt-6 border-t border-soil-200 pt-4">
            <Field label="Giá chào bán (VND / tCO₂e)">
              <Input
                type="number"
                min="0"
                step="1000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="450000"
              />
            </Field>
            <Button
              className="mt-3 w-full"
              disabled={pending || !price}
              onClick={() =>
                start(async () => {
                  const err = await listBatch(batchId, Number(price));
                  setMessage(
                    err ? { tone: "error", text: err } : { tone: "ok", text: "Lô đã lên sàn." },
                  );
                  if (!err) router.refresh();
                })
              }
            >
              {pending ? "Đang đăng…" : "Đưa lên chợ tín chỉ"}
            </Button>
          </div>
        )}

        {status !== "draft" && (
          <p className="text-sm text-soil-600">
            Lô đã rời trạng thái nháp nên không gộp lại được. Muốn thay đổi, hãy tạo lô mới
            cho vụ này.
          </p>
        )}
      </Card>
    </div>
  );
}
