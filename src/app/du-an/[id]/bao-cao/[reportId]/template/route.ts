import { NextResponse } from "next/server";
import { projectClient, requireProjectMember } from "@/lib/auth";
import {
  parseReportTemplateSnapshot,
  templateDownloadName,
} from "@/lib/mrv/template";
import { getReport } from "../../../giam-sat/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  const { id, reportId } = await params;
  await requireProjectMember(id);

  const report = await getReport(id, reportId);
  if (!report)
    return NextResponse.json({ error: "Không tìm thấy báo cáo." }, { status: 404 });

  const template = parseReportTemplateSnapshot(report.template_snapshot);
  if (!template || template.status !== "ready" || !template.objectPath)
    return NextResponse.json(
      { error: "Báo cáo này không có tệp template để tải." },
      { status: 404 },
    );

  const supabase = await projectClient();
  const { data, error } = await supabase.storage
    .from(template.bucketId)
    .createSignedUrl(template.objectPath, 60, {
      download: templateDownloadName(template),
    });

  if (error || !data?.signedUrl)
    return NextResponse.json(
      { error: `Không tạo được đường tải template: ${error?.message ?? "lỗi không rõ"}` },
      { status: 502 },
    );

  return NextResponse.redirect(data.signedUrl);
}
