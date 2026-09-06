import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import { PROJECT_ROLE_LABEL } from "@/lib/labels";
import type { Profile, ProjectRole } from "@/lib/auth";

/**
 * Thanh điều hướng của nền tảng dự án.
 *
 * Viết riêng thay vì dùng `AppNav`: `AppNav` chọn menu theo `user_role`, mà nền tảng dự
 * án cố ý không đọc `user_role` (xem `docs/design/auth-role-design.md` §1). Ở đây menu
 * theo NGỮ CẢNH — danh sách dự án, hoặc các trang bên trong một dự án.
 *
 * Giữ đúng khuôn hình của `AppNav` (viền, nền, khoảng cách) để hai nửa hệ thống nhìn
 * như một trong lúc module cũ vẫn còn sống tới bước 6.
 */
export function ProjectTopBar({
  profile,
  role,
  projectName,
}: {
  profile: Profile;
  /** Có mặt khi đang mở một dự án cụ thể. */
  role?: ProjectRole;
  projectName?: string;
}) {
  return (
    <header className="border-b border-soil-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <Link href="/" className="font-semibold text-leaf-800">
          Agri-Carbon Pass
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          <Link
            href="/du-an"
            className="rounded-lg px-3 py-1.5 text-sm text-soil-600 transition hover:bg-soil-100 hover:text-soil-900"
          >
            Danh mục dự án
          </Link>
          {/*
            Đường vào trang trợ lý toàn màn hình. Trước đây nó nằm ở `/htx/tro-ly` và
            được `AppNav` của module hợp tác xã dẫn tới; module đó đã bị gỡ nên link
            phải chuyển về đây, nếu không trang chỉ vào được bằng cách gõ tay URL.
          */}
          <Link
            href="/du-an/tro-ly"
            className="rounded-lg px-3 py-1.5 text-sm text-soil-600 transition hover:bg-soil-100 hover:text-soil-900"
          >
            Trợ lý
          </Link>
          {projectName && (
            <span className="px-2 text-sm text-soil-400" aria-hidden>
              /
            </span>
          )}
          {projectName && (
            <span className="px-1 text-sm font-medium text-soil-900">{projectName}</span>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="text-right leading-tight">
            <div className="font-medium text-soil-900">{profile.full_name}</div>
            <div className="text-xs text-soil-600">
              {role ? PROJECT_ROLE_LABEL[role] : "Tài khoản nền tảng"}
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
