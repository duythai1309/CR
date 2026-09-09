import type { Metadata } from "next";
import { PageHeader } from "@/components/app-nav";
import { Card } from "@/components/ui";
import { NewProjectForm } from "./form";

export const metadata: Metadata = { title: "Tạo dự án" };

/**
 * Tạo dự án.
 *
 * Form chỉ nhận thông tin ban đầu. Thẻ bên cạnh nói gọn những gì hệ thống dựng sẵn,
 * những lựa chọn để lại cho phần hồ sơ và ranh giới của kết quả tạo ra.
 */
export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Tạo dự án"
        description="Bảy mục hồ sơ thiết kế được dựng sẵn trong cùng một transaction ngay khi tạo xong."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Thông tin ban đầu">
          <NewProjectForm />
        </Card>

        <div>
          <Card title="Sau khi tạo">
            <ul className="space-y-2 text-sm text-soil-700">
              <li>
                Có ngay bảy mục hồ sơ từ <strong>Project concept</strong> tới{" "}
                <strong>PDD</strong> và một bảng công việc rỗng.
              </li>
              <li>
                <strong>Standard</strong>, <strong>Methodology</strong> và{" "}
                <strong>Baseline</strong> được chọn trong các mục hồ sơ sau. Khi khoá
                Standard hoặc Methodology, cơ sở dữ liệu không cho đổi lại.
              </li>
            </ul>
            <p className="mt-3 border-t border-soil-100 pt-3 text-xs text-soil-600">
              Bốn methodology hiện có là <strong>dữ liệu mẫu chưa thẩm định</strong>, không
              phải methodology được Verra hay Gold Standard công nhận.
            </p>
            <p className="mt-2 text-xs text-soil-600">
              Nền tảng dừng trước validation, registration, VVB verification và issuance.
              Hồ sơ dựng ở đây <strong>chưa phải hồ sơ nộp được</strong>; MRV report chỉ là
              ước tính, không phải tín chỉ đã phát hành.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
