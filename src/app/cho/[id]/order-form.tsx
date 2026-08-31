"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeOrder } from "../actions";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { fmtTonnes, fmtVnd } from "@/lib/format";

export function OrderForm({
  batchId,
  available,
  unitPrice,
}: {
  batchId: string;
  available: number;
  unitPrice: number;
}) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const qty = Number(quantity);
  const valid = qty > 0 && qty <= available;
  const total = valid ? qty * unitPrice : 0;

  if (available <= 0) {
    return (
      <Card title="Đặt mua">
        <Alert>Lô này đã bán hết hoặc đang có đơn giữ chỗ toàn bộ lượng còn lại.</Alert>
      </Card>
    );
  }

  return (
    <Card title="Đặt mua" description={`Còn ${fmtTonnes(available)} khả dụng.`}>
      <div className="space-y-4">
        <Field label="Khối lượng (tCO₂e)">
          <Input
            type="number"
            step="0.0001"
            min="0"
            max={available}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>

        {quantity && !valid && (
          <Alert tone="error">
            Khối lượng phải lớn hơn 0 và không vượt quá {fmtTonnes(available)}.
          </Alert>
        )}

        <div className="rounded-lg bg-soil-100 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-soil-600">Đơn giá</span>
            <span className="tabular-nums">{fmtVnd(unitPrice)}/tCO₂e</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold text-soil-900">
            <span>Thành tiền</span>
            <span className="tabular-nums">{fmtVnd(total)}</span>
          </div>
        </div>

        <Field label="Ghi chú cho hợp tác xã">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {message && <Alert tone={message.ok ? "ok" : "error"}>{message.text}</Alert>}

        <Button
          className="w-full"
          disabled={!valid || pending}
          onClick={() =>
            start(async () => {
              const r = await placeOrder(batchId, qty, note);
              setMessage({ ok: r.ok, text: r.message });
              if (r.ok) {
                setQuantity("");
                setNote("");
                router.push("/don-hang");
              }
            })
          }
        >
          {pending ? "Đang tạo đơn…" : "Đặt mua"}
        </Button>

        <p className="text-xs text-soil-600">
          Đơn hàng chuyển sang bước thanh toán thử — chưa phát sinh giao dịch tiền thật.
        </p>
      </div>
    </Card>
  );
}
