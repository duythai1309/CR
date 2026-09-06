import type { Metadata } from "next";
import { PageHeader } from "@/components/app-nav";
import { Card } from "@/components/ui";
import { NewProjectForm } from "./form";

export const metadata: Metadata = { title: "Tạo dự án" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Tạo dự án"
        description="Bạn sẽ là chủ dự án. Bảy bước thiết kế được dựng sẵn ngay khi tạo xong."
      />
      <Card>
        <NewProjectForm />
      </Card>
    </div>
  );
}
