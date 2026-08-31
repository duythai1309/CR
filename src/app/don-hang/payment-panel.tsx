"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { settlePayment } from "../cho/actions";
import { Alert, Button } from "@/components/ui";
import { fmtVnd } from "@/lib/format";
import type { Database } from "@/types/database";

type Status = Database["public"]["Enums"]["order_status"];

export function PaymentPanel({
  orderId,
  status,
  amount,
}: {
  orderId: string;
  status: Status;
  amount: number;
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (status !== "awaiting_payment") {
    return (
      <div className="rounded-lg border border-soil-200 bg-soil-50 px-4 py-3 text-sm text-soil-600">
        {status === "paid" || status === "fulfilled"
          ? "Đơn đã thanh toán. Doanh thu đã chia cho nông hộ theo tỷ trọng đóng góp."
          : "Không có thao tác thanh toán nào cần làm."}
      </div>
    );
  }

  const settle = (succeed: boolean) =>
    start(async () => {
      const r = await settlePayment(orderId, succeed);
      setMessage({ ok: r.ok, text: r.message });
      router.refresh();
    });

  return (
    <div className="rounded-lg border border-carbon-100 bg-carbon-100/40 p-4">
      <p className="text-sm font-medium text-carbon-700">Thanh toán thử</p>
      <p className="mt-1 text-xs text-carbon-700">
        Cổng giả lập, không trừ tiền thật. Số tiền: {fmtVnd(amount)}.
      </p>

      {message && (
        <div className="mt-3">
          <Alert tone={message.ok ? "ok" : "error"}>{message.text}</Alert>
        </div>
      )}

      <div className="mt-3 space-y-2">
        <Button className="w-full" disabled={pending} onClick={() => settle(true)}>
          {pending ? "Đang xử lý…" : "Giả lập thanh toán thành công"}
        </Button>
        <Button variant="secondary" className="w-full" disabled={pending} onClick={() => settle(false)}>
          Giả lập thất bại
        </Button>
      </div>
    </div>
  );
}
