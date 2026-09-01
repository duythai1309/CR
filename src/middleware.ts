import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { missingConfigMessage, readSupabaseConfig } from "@/lib/supabase/config";

/** Các nhánh đường dẫn bắt buộc đăng nhập. */
const PROTECTED = ["/htx", "/cho", "/don-hang", "/thiet-lap", "/quan-tri"];

const needsAuth = (path: string) =>
  PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const config = readSupabaseConfig();

  // Thiếu cấu hình thì không xác thực được ai. Trước đây chỗ này ném lỗi và làm
  // sập toàn bộ site kể cả trang công khai; giờ trang công khai vẫn phục vụ được,
  // còn trang cần đăng nhập bị chặn hẳn — không nới lỏng bảo mật vì lỗi cấu hình.
  if (!config) {
    if (!needsAuth(path)) return NextResponse.next({ request });
    return new NextResponse(configErrorPage(), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (needsAuth(path) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dang-nhap";
    url.searchParams.set("tiep-tuc", path);
    return NextResponse.redirect(url);
  }

  return response;
}

function configErrorPage() {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chưa cấu hình xong</title></head>
<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1.5rem;line-height:1.6;color:#23201b">
<h1 style="font-size:1.4rem;margin:0 0 .75rem">Hệ thống chưa kết nối được cơ sở dữ liệu</h1>
<p style="margin:0 0 1rem">${missingConfigMessage()}</p>
<p style="margin:0;color:#6b6459;font-size:.9rem">Trang giới thiệu vẫn xem được bình thường.</p>
</body></html>`;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
