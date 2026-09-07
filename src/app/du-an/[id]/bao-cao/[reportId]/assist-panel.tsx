"use client";

import { useState } from "react";
import { Alert, Button, Card, Empty, Locked, SectionHeader } from "@/components/ui";
import { runReportAssist, type ReportAssistResult } from "./assist-actions";

export function ReportAssistPanel({
  projectId,
  reportId,
  configured,
  canUse,
  missingMessage,
}: {
  projectId: string;
  reportId: string;
  configured: boolean;
  canUse: boolean;
  missingMessage: string;
}) {
  const [result, setResult] = useState<ReportAssistResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (running || !configured || !canUse) return;
    setRunning(true);
    try {
      setResult(await runReportAssist(projectId, reportId));
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
        title="Trợ lý giải thích vết tính"
        description="Chuyển calculation trace đã lưu thành lời để đối chiếu nguồn record, factor, đơn vị và phép gộp."
      />

      {!canUse ? (
        <Locked
          title="Không thể chạy trợ lý ở chế độ chỉ đọc"
          reason="Cần vai trò Chủ dự án hoặc Đơn vị phát triển trên một dự án đang hoạt động để yêu cầu giải thích."
        />
      ) : !configured ? (
        <Locked
          title="Trợ lý chưa hoạt động"
          reason={missingMessage}
          unlock={<Button disabled>Giải thích con số này</Button>}
        />
      ) : !result ? (
        <Empty
          title="Chưa có lời giải thích trong phiên này"
          hint="Trợ lý chỉ diễn giải vết tính đã lưu, không tính lại hoặc đưa ra con số mới."
          action={
            <Button type="button" disabled={running} onClick={run}>
              {running ? "Trợ lý đang đọc vết tính…" : "Giải thích con số này"}
            </Button>
          }
        />
      ) : !result.ok ? (
        <div className="space-y-3">
          <Alert tone="error" title="Chưa giải thích được báo cáo">
            {result.message}
          </Alert>
          <Button type="button" disabled={running} onClick={run}>
            {running ? "Trợ lý đang thử lại…" : "Thử giải thích lại"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert tone="warn" title="Nội dung do máy sinh, chưa được thẩm định">
            Mọi con số được giới hạn ở token có trong calculation trace. Người phụ trách
            vẫn phải đối chiếu trực tiếp vết tính trước khi dùng trong hồ sơ thẩm định.
          </Alert>
          <div className="space-y-3 text-sm leading-relaxed text-soil-700">
            {result.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
          <Button type="button" variant="secondary" disabled={running} onClick={run}>
            {running ? "Trợ lý đang đọc lại…" : "Giải thích lại vết tính hiện tại"}
          </Button>
        </div>
      )}
    </Card>
  );
}
