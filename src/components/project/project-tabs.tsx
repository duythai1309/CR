"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Tab trong một dự án, có trạng thái đang mở.
 *
 * Trước đây năm tab trông giống hệt nhau ở mọi trang, nên không có cách nào biết mình
 * đang đứng đâu ngoài việc đọc thanh địa chỉ. Đó là thứ đầu tiên hỏng khi người dùng mở
 * năm dự án ở năm tab trình duyệt — đúng cách họ làm việc.
 *
 * So khớp theo đoạn đường dẫn ngay sau `/du-an/[id]`, không phải `startsWith`: tab "Bảng
 * công việc" có slug rỗng nên `startsWith` sẽ khớp với mọi trang con.
 */
export function ProjectTabs({
  projectId,
  tabs,
}: {
  projectId: string;
  tabs: Array<{ slug: string; label: string; locked?: boolean; lockReason?: string }>;
}) {
  const pathname = usePathname();
  const base = `/du-an/${projectId}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, "") : "";
  const active = rest.split("/")[0] ?? "";

  return (
    <nav className="mt-5 flex flex-wrap gap-1 border-b border-soil-200" aria-label="Trang trong dự án">
      {tabs.map((tab) => {
        const current = tab.slug === active;

        // Tab khoá vẫn hiện, vẫn đọc được lý do. Dùng <span> thay vì <Link> vô hiệu hoá,
        // và KHÔNG dùng pointer-events:none — người dùng phải rê được vào để thấy title.
        if (tab.locked) {
          return (
            <span
              key={tab.slug}
              aria-disabled="true"
              title={tab.lockReason}
              className="-mb-px flex cursor-not-allowed items-center gap-1.5 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm text-soil-400"
            >
              <span aria-hidden="true">◌</span>
              {tab.label}
            </span>
          );
        }

        return (
          <Link
            key={tab.slug}
            href={`${base}${tab.slug ? `/${tab.slug}` : ""}`}
            aria-current={current ? "page" : undefined}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm transition ${
              current
                ? "border-leaf-600 font-medium text-soil-900"
                : "border-transparent text-soil-600 hover:border-soil-300 hover:text-soil-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
