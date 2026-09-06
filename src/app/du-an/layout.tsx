import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireProfile } from "@/lib/auth";
import { ProjectTopBar } from "@/components/project/project-shell";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: { default: "Dự án", template: "%s · Dự án · Agri-Carbon Pass" },
};

/**
 * Khung ngoài của toàn bộ nền tảng dự án.
 *
 * Chỉ lo hai việc: bắt buộc đăng nhập, và dựng nền + thanh điều hướng chung. Mọi thứ
 * thuộc về MỘT dự án cụ thể (kiểm tư cách thành viên, menu trong dự án) nằm ở
 * `src/app/du-an/[id]/layout.tsx`, để trang danh sách không phải trả giá cho truy vấn
 * mà nó không cần.
 *
 * `middleware.ts` đã chặn khách chưa đăng nhập ở `/du-an`; `requireProfile()` ở đây là
 * lớp thứ hai, và cũng là chỗ lấy hồ sơ cho thanh điều hướng.
 */
export default async function ProjectPlatformLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="min-h-dvh bg-soil-50">
      <ProjectTopBar profile={profile} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      {/*
        Trợ lý có mặt trong sản phẩm mới. Trước bước này, cả bốn điểm gắn widget đều nằm
        trong module cũ (`htx/layout.tsx`, `cho/layout.tsx`, `don-hang/layout.tsx`,
        `quan-tri/page.tsx`), nên người dùng nền tảng dự án không gặp trợ lý ở đâu cả —
        đúng rủi ro R7 trong `docs/audit/audit-keep.md`. Bốn điểm cũ giữ nguyên.

        `audience` để mặc định: `ChatPanel` tự nhận ngữ cảnh dự án từ đường dẫn.
      */}
      <ChatWidget />
    </div>
  );
}
