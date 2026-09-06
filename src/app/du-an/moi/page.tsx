import type { Metadata } from "next";
import { PageHeader } from "@/components/app-nav";
import { Card } from "@/components/ui";
import { NewProjectForm } from "./form";

export const metadata: Metadata = { title: "Tạo dự án" };

/**
 * Tạo dự án.
 *
 * Form chỉ có hai ô, nhưng cái tạo ra thì không nhỏ: RPC `create_project` chạy trigger
 * `project_bootstrap` trong cùng transaction, dựng tư cách owner và đủ bảy stage. Trang
 * nói trước điều đó, và nói luôn hai thứ CHƯA được chọn — Standard và Methodology, cả hai
 * khoá một chiều — để người dùng chuyên nghiệp không tưởng đây là bước chọn chuẩn.
 */
export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Tạo dự án"
        description="Bạn sẽ là chủ dự án. Bảy stage thiết kế được dựng sẵn trong cùng một transaction ngay khi tạo xong."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Thông tin ban đầu">
          <NewProjectForm />
        </Card>

        <div className="space-y-4">
          <Card title="Tạo xong thì có gì">
            <ul className="space-y-2 text-sm text-soil-700">
              <li>Bảy stage từ Project concept tới PDD, đúng thứ tự, duyệt tuần tự.</li>
              <li>Bạn là chủ dự án; mời thêm Đơn vị phát triển và Người xem ở tab Thành viên.</li>
              <li>Một bảng công việc rỗng — mỗi stage là một cột.</li>
            </ul>
          </Card>

          <Card title="Chưa chọn ở bước này">
            <ul className="space-y-2 text-sm text-soil-700">
              <li>
                <strong>Standard</strong> chọn và khoá ở bước 3. Khoá là một chiều: cơ sở dữ
                liệu từ chối mọi lượt đổi sau đó.
              </li>
              <li>
                <strong>Methodology</strong> chọn và khoá ở bước 4, chỉ trong những bản đã
                publish thuộc Standard đã khoá.
              </li>
              <li>
                <strong>Baseline</strong> nhập ở bước 5, theo{" "}
                <code className="font-mono text-xs">metric_schema</code> của Methodology đã
                khoá.
              </li>
            </ul>
            <p className="mt-3 border-t border-soil-100 pt-3 text-xs text-soil-600">
              Bốn methodology hiện có là <strong>dữ liệu mẫu chưa thẩm định</strong>, không
              phải methodology được Verra hay Gold Standard công nhận.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
