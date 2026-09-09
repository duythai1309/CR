import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { ROLE_LABEL } from "@/lib/labels";
import { BrandLogo } from "@/components/brand-logo";
import type { Profile } from "@/lib/auth";

const PROJECT_LINK = { href: "/du-an", label: "Dự án carbon" };

const ADMIN_LINKS = [
  PROJECT_LINK,
  { href: "/quan-tri/tro-ly", label: "Cấu hình trợ lý" },
];

const PROJECT_LINKS = [PROJECT_LINK];

/**
 * Dòng chú thích dưới tên người dùng.
 *
 * `ROLE_LABEL[coop_staff]` là "Cán bộ hợp tác xã" — đúng với người gia nhập HTX bằng mã,
 * nhưng SAI với tài khoản nền tảng dự án, vốn cũng mang `coop_staff` (xem
 * `docs/design/auth-role-design.md` §1). Phân biệt bằng `cooperative_id`: không có HTX
 * thì không nói gì về hợp tác xã cả.
 */
function accountLabel(profile: Profile, coopName?: string): string {
  if (profile.company_name) return profile.company_name;
  if (profile.role !== "platform_admin") return "Tài khoản nền tảng";
  if (coopName) return coopName;
  return ROLE_LABEL[profile.role];
}

export function AppNav({
  profile,
  coopName,
}: {
  profile: Profile;
  coopName?: string;
}) {
  const links = profile.role === "platform_admin" ? ADMIN_LINKS : PROJECT_LINKS;

  return (
    <header className="border-b border-soil-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <Link href="/" className="flex items-center transition hover:opacity-90">
          <BrandLogo variant="ngang" priority className="h-8 w-auto" />
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
            <div className="text-xs text-soil-600">{accountLabel(profile, coopName)}</div>
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
