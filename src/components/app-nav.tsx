import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile } from "@/lib/auth";

const COOP_LINKS = [
  { href: "/htx", label: "Tổng quan" },
  { href: "/htx/nong-ho", label: "Nông hộ" },
  { href: "/htx/thua-ruong", label: "Thửa ruộng" },
  { href: "/htx/mua-vu", label: "Mùa vụ" },
  { href: "/htx/lo-tin-chi", label: "Lô tín chỉ" },
  { href: "/htx/he-so", label: "Hệ số phát thải" },
  { href: "/htx/tro-ly", label: "Trợ lý" },
];

const BUYER_LINKS = [
  { href: "/cho", label: "Chợ tín chỉ" },
  { href: "/don-hang", label: "Đơn hàng của tôi" },
];

const ADMIN_LINKS = [
  { href: "/quan-tri", label: "Tổng quan nền tảng" },
  { href: "/quan-tri/tro-ly", label: "Cấu hình trợ lý" },
];

export function AppNav({ profile, coopName }: { profile: Profile; coopName?: string }) {
  const links =
    profile.role === "buyer"
      ? BUYER_LINKS
      : profile.role === "platform_admin"
        ? ADMIN_LINKS
        : COOP_LINKS;

  return (
    <header className="border-b border-soil-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <Link href="/" className="font-semibold text-leaf-800">
          Agri-Carbon Pass
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-soil-600 transition hover:bg-soil-100 hover:text-soil-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="text-right leading-tight">
            <div className="font-medium text-soil-900">{profile.full_name}</div>
            <div className="text-xs text-soil-600">
              {coopName ?? profile.company_name ?? ROLE_LABEL[profile.role]}
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-soil-600 transition hover:bg-soil-100 hover:text-soil-900"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-soil-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-soil-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}
