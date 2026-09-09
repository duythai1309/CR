"use server";

import { redirect } from "next/navigation";
import { beginProjectSupport } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string): never {
  redirect(`/du-an/ho-tro?loi=${encodeURIComponent(message)}`);
}

export async function beginSupportAction(formData: FormData): Promise<never> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes"));

  if (!UUID.test(projectId)) fail("UUID dự án không hợp lệ.");
  if (reason.length < 10 || reason.length > 1000)
    fail("Lý do hỗ trợ phải dài từ 10 đến 1000 ký tự.");
  if (![15, 30, 60].includes(durationMinutes)) fail("Thời hạn hỗ trợ không hợp lệ.");

  const result = await beginProjectSupport(projectId, reason, durationMinutes);
  if (!result.ok) fail(result.message);

  redirect(`/du-an/${projectId}`);
}
