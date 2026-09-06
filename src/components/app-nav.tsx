import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { PROJECT_ROLE_LABEL, ROLE_LABEL } from "@/lib/labels";
import type { Profile, ProjectRole } from "@/lib/auth";

/** Lối vào nền tảng dự án, thêm vào cả ba menu cũ để người dùng hiện tại tìm thấy nó. */
const PROJECT_LINK = { href: "/du-an", label: "Dự án carbon" };

const COOP_LINKS = [
  { href: "/htx", label: "Tổng quan" },
  { href: "/htx/nong-ho", label: "Nông hộ" },
  { href: "/htx/thua-ruong", label: "Thửa ruộng" },
  { href: "/htx/mua-vu", label: "Mùa vụ" },
  { href: "/htx/lo-tin-chi", label: "Lô tín chỉ" },
  { href: "/htx/he-so", label: "Hệ số phát thải" },
  { href: "/htx/tro-ly", label: "Trợ lý" },
  PROJECT_LINK,
];

const BUYER_LINKS = [
  { href: "/cho", label: "Chợ tín chỉ" },
  { href: "/don-hang", label: "Đơn hàng của tôi" },
  PROJECT_LINK,
];

const ADMIN_LINKS = [
  { href: "/quan-tri", label: "Tổng quan nền tảng" },
  { href: "/quan-tri/tro-ly", label: "Cấu hình trợ lý" },
  PROJECT_LINK,
];

/** Nền tảng dự án. Chỉ dùng khi đang ở trong ngữ cảnh một dự án. */
const PROJECT_LINKS = [{ href: "/du-an", label: "Dự án của tôi" }];

/**
 * Dòng chú thích dưới tên người dùng.
 *
 * `ROLE_LABEL[coop_staff]` là "Cán bộ hợp tác xã" — đúng với người gia nhập HTX bằng mã,
 * nhưng SAI với tài khoản nền tảng dự án, vốn cũng mang `coop_staff` (xem
 * `docs/design/auth-role-design.md` §1). Phân biệt bằng `cooperative_id`: không có HTX
 * thì không nói gì về hợp tác xã cả.
 */
function accountLabel(profile: Profile, coopName?: string): string {
  if (coopName) return coopName;
  if (profile.company_name) return profile.company_name;
  if (profile.role === "coop_staff" && !profile.cooperative_id) return "Tài khoản nền tảng";
  return ROLE_LABEL[profile.role];
}

export function AppNav({
  profile,
  coopName,
  projectRole,
}: {
  profile: Profile;
  coopName?: string;
  /** Có mặt khi đang mở một dự án: thanh điều hướng chuyển sang nền tảng dự án. */
  projectRole?: ProjectRole;
}) {
  const links = projectRole
    ? PROJECT_LINKS
    : profile.role === "buyer"
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
              {projectRole
                ? PROJECT_ROLE_LABEL[projectRole]
                : accountLabel(profile, coopName)}
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
