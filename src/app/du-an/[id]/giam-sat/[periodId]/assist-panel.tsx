"use client";

import { useState } from "react";
import { Alert, Button, Card, Empty, Locked, SectionHeader } from "@/components/ui";
import { runMonitoringAssist, type MonitoringAssistResult } from "./assist-actions";

export function MonitoringAssistPanel({
  projectId,
  periodId,
  configured,
  canUse,
  missingMessage,
}: {
  projectId: string;
  periodId: string;
  configured: boolean;
  canUse: boolean;
  missingMessage: string;
}) {
  const [result, setResult] = useState<MonitoringAssistResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (running || !configured || !canUse) return;
    setRunning(true);
    try {
      setResult(await runMonitoringAssist(projectId, periodId));
    } catch {
      setResult({
        ok: false,
        message: "Không kết nối được với trợ lý. Hãy tải lại trang rồi thử lại.",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <SectionHeader
        title="Trợ lý rà soát kỳ"
        description="Đọc kết quả chẩn đoán đã dựng sẵn để ưu tiên lỗi field, cảnh báo chất lượng và điều kiện đang chặn khoá kỳ."
      />

      {!canUse ? (
        <Locked
          title="Không thể chạy trợ lý ở chế độ chỉ đọc"
          reason="Cần vai trò Chủ dự án hoặc Đơn vị phát triển trên một dự án đang hoạt động để rà soát kỳ."
        />
      ) : !configured ? (
        <Locked
          title="Trợ lý chưa hoạt động"
          reason={missingMessage}
          unlock={<Button disabled>Nhờ trợ lý rà soát kỳ này</Button>}
        />
      ) : !result ? (
        <Empty
          title="Chưa có kết quả rà soát trong phiên này"
          hint="Trợ lý chỉ diễn giải dữ liệu từ công cụ kiểm tra kỳ; không sinh hoặc đề xuất số liệu giám sát."
          action={
            <Button type="button" disabled={running} onClick={run}>
              {running ? "Trợ lý đang rà soát…" : "Nhờ trợ lý rà soát kỳ này"}
            </Button>
          }
        />
      ) : !result.ok ? (
        <div className="space-y-3">
          <Alert tone="error" title="Chưa rà soát được kỳ">
            {result.message}
          </Alert>
          <Button type="button" disabled={running} onClick={run}>
            {running ? "Trợ lý đang thử lại…" : "Thử rà soát lại"}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <Alert tone="warn" title="Nội dung do máy sinh, chưa được thẩm định">
            Trợ lý chỉ sắp xếp dữ liệu chẩn đoán từ hệ thống. Người phụ trách phải kiểm tra
            từng record trước khi khoá kỳ.
          </Alert>
          <Alert
            tone={result.review.canLock ? "ok" : "warn"}
            title={
              result.review.canLock
                ? "Không có điều kiện DB nào đang chặn khoá kỳ"
                : "Kỳ chưa đáp ứng điều kiện gọi thao tác khoá"
            }
          >
            {result.review.canLock
              ? "Kết luận này chỉ phản ánh các điều kiện mà RPC thực sự cưỡng chế tại thời điểm rà soát."
              : "Xem danh sách điều kiện khoá bên dưới; cảnh báo chất lượng dữ liệu được tách riêng."}
          </Alert>

          <div>
            <h3 className="text-sm font-semibold text-soil-900">
              Lỗi theo record ({result.review.issues.length})
            </h3>
            {result.review.issues.length === 0 ? (
              <p className="mt-2 text-sm text-soil-600">Không có lỗi field trong phần dữ liệu đã đọc.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-soil-700">
                {result.review.issues.map((issue, index) => (
                  <li key={`${issue.recordKey}-${issue.field}-${index}`}>
                    <strong className="text-soil-900">{issue.recordKey}</strong> · {issue.field}: {issue.problem}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-soil-900">Cảnh báo chất lượng dữ liệu</h3>
              {result.review.qualityWarnings.length === 0 ? (
                <p className="mt-2 text-sm text-soil-600">Không có cảnh báo trong payload đã đọc.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-soil-700">
                  {result.review.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-soil-900">Điều kiện khoá kỳ</h3>
              {result.review.lockBlockers.length === 0 ? (
                <p className="mt-2 text-sm text-soil-600">
                  Hệ thống không ghi nhận điều kiện DB nào đang chặn tại thời điểm rà soát.
                </p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-soil-700">
                  {result.review.lockBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              )}
            </div>
          </div>

          <Button type="button" variant="secondary" disabled={running} onClick={run}>
            {running ? "Trợ lý đang rà soát lại…" : "Rà soát lại dữ liệu hiện tại"}
          </Button>
        </div>
      )}
    </Card>
  );
}
