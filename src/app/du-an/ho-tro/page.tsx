import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { beginSupportAction } from "./actions";

export const metadata: Metadata = { title: "Hỗ trợ vận hành" };

export default async function ProjectSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "platform_admin") redirect("/du-an");
  const { loi } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-sm text-soil-600">
          <Link href="/du-an" className="hover:text-leaf-800 hover:underline">
            Danh mục dự án
          </Link>{" "}
          / Hỗ trợ vận hành
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-soil-900">Mở phiên xem hộ dự án</h1>
        <p className="mt-1 text-sm text-soil-600">
          Dùng UUID do khách hàng cung cấp. Phiên chỉ có quyền đọc và tự hết hạn.
        </p>
      </div>

      <Alert tone="warn" title="Đây là quyền truy cập dữ liệu khách hàng">
        Mỗi lần mở phiên, hệ thống ghi lại quản trị viên, dự án, lý do, thời điểm mở và
        thời điểm hết hạn. Nhật ký ghi khoảng truy cập, không ghi được từng hàng dữ liệu
        bạn đã xem. Chỉ mở khi có yêu cầu hỗ trợ hợp lệ.
      </Alert>

      {loi && <Alert tone="error">{loi}</Alert>}

      <Card title="Thông tin phiên hỗ trợ">
        <form action={beginSupportAction} className="space-y-4">
          <Field
            label="UUID dự án"
            hint="Lấy từ đường dẫn dự án khách gửi; hệ thống không cung cấp chức năng dò dự án."
          >
            <Input
              name="project_id"
              required
              autoComplete="off"
              placeholder="00000000-0000-4000-8000-000000000000"
            />
          </Field>

          <Field label="Lý do hỗ trợ" hint="Từ 10 đến 1000 ký tự; nội dung được lưu vào audit.">
            <Textarea
              name="reason"
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              placeholder="Ví dụ: Điều tra ticket CR-123 về báo cáo MRV không tải được"
            />
          </Field>

          <Field label="Thời hạn">
            <Select name="duration_minutes" defaultValue="30">
              <option value="15">15 phút</option>
              <option value="30">30 phút</option>
              <option value="60">60 phút</option>
            </Select>
          </Field>

          <div className="flex justify-end">
            <Button type="submit">Ghi audit và mở dự án</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
