import Image from "next/image";

/**
 * Logo C-ROUTE, hai biến thể theo đúng quy ước nhận diện.
 *
 * `doc` — biểu tượng nằm trên chữ, dùng làm logo chính của landing page.
 * `ngang` — biểu tượng đóng vai chữ C rồi tới ROUTE, dùng cho mọi trang còn lại.
 *
 * Tệp nguồn đã được cắt hết viền trong suốt thừa (ảnh gốc 1254×1254 nhưng phần có hình
 * chỉ chiếm khoảng một nửa). Không cắt thì logo hiện bé tí giữa một ô đệm rỗng, và trình
 * duyệt vẫn tải phần rỗng đó.
 *
 * Cả hai tệp có kênh alpha nên đặt được lên nền tối của hero và footer mà không lộ hộp
 * trắng. Đó là lý do dùng ảnh thật thay vì tô lại bằng CSS filter.
 */

const VARIANTS = {
  doc: { src: "/logo/c-route-doc.webp", sang: "/logo/c-route-doc-sang.webp", width: 286, height: 160 },
  ngang: { src: "/logo/c-route-ngang.webp", sang: "/logo/c-route-ngang-sang.webp", width: 359, height: 160 },
} as const;

export function BrandLogo({
  variant = "ngang",
  onDark = false,
  className,
  priority = false,
}: {
  variant?: keyof typeof VARIANTS;
  /**
   * Bật khi logo nằm trên nền tối.
   *
   * Bản gốc chỉ đọc được trên nền sáng: đo theo WCAG thì chữ đạt 6,81:1 trên `mint-50`
   * nhưng chỉ 1,65:1 trên `forest-800` và 2,21:1 trên `forest-950` — dưới ngưỡng 3,0:1
   * cho đồ hoạ. Phần chữ ROUTE màu `RGB(9,94,115)` gần như tan vào nền xanh đậm.
   *
   * Bản `-sang` nâng độ sáng nhưng GIỮ NGUYÊN sắc độ, nên vẫn là logo cũ chứ không đổi
   * màu thương hiệu. Đo lại: 6,54:1 trên header và 8,74:1 trên footer.
   */
  onDark?: boolean;
  /** Đặt chiều cao ở đây, ví dụ `h-9 w-auto`. Tỉ lệ do `width`/`height` giữ. */
  className?: string;
  /** Bật cho logo nằm trong khung nhìn đầu tiên để không nhấp nháy khi tải. */
  priority?: boolean;
}) {
  const { src, sang, width, height } = VARIANTS[variant];
  return (
    <Image
      src={onDark ? sang : src}
      alt="C-ROUTE"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
