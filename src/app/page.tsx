import Link from "next/link";
import { getProfile, homePathFor } from "@/lib/auth";
import { LinkButton } from "@/components/ui";
import {
  ACTIVE_REGION_FACTORS,
  IPCC_GLOBAL_DEFAULT,
} from "@/lib/region";

/**
 * Số liệu bối cảnh thị trường, đều trích nguồn công khai. Đây không phải quy mô
 * của nền tảng — nền tảng còn ở giai đoạn thử nghiệm — mà là độ lớn của bài toán.
 */
const MARKET_STATS = [
  { value: "≈950", unit: "nghìn ha", label: "Lúa gieo trồng mỗi năm ở Đồng bằng sông Hồng" },
  { value: "48", unit: "%", label: "Tỷ trọng của lúa trong phát thải nhà kính nông nghiệp" },
  { value: "49,6", unit: "triệu tấn CO₂e", label: "Phát thải mỗi năm từ canh tác lúa cả nước" },
  { value: "45", unit: "%", label: "Mức cắt giảm methane khi áp dụng AWD, theo hệ số IPCC" },
];

const STEPS = [
  {
    n: "01",
    title: "Ghi nhật ký canh tác",
    body: "Cán bộ hợp tác xã nhập ngày cấy, lịch tháo nước, lượng phân bón và cách xử lý rơm rạ cho từng thửa. Nông hộ không cần tài khoản, không cần điện thoại thông minh.",
  },
  {
    n: "02",
    title: "Tính lượng giảm phát thải",
    body: "Hệ thống áp công thức IPCC với hệ số đo tại chính vùng canh tác. Chế độ nước suy ra từ số lần tháo nước đã ghi, không để ai tự khai.",
  },
  {
    n: "03",
    title: "Xác minh ranh thửa",
    body: "Mỗi thửa vẽ thành vùng trên ảnh vệ tinh, diện tích tính từ hình học chứ không lấy số khai. Hệ thống báo ngay nếu hai hộ cùng khai một mảnh ruộng.",
  },
  {
    n: "04",
    title: "Gộp lô và kết nối bên mua",
    body: "Hàng nghìn hecta gộp thành một báo cáo phát thải tập trung, đủ quy mô để làm việc với đơn vị kiểm định quốc tế và doanh nghiệp cần bù đắp phát thải.",
  },
];

const MAX_FACTOR = Math.max(...ACTIVE_REGION_FACTORS.map((f) => f.value));

export default async function Home() {
  const profile = await getProfile();
  const appHref = profile ? homePathFor(profile.role, profile.cooperative_id) : "/dang-nhap";

  return (
    <div className="bg-white">
      <header className="sticky top-0 z-50 border-b border-soil-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-leaf-800">
            Agri-Carbon Pass
          </Link>
          <div className="hidden items-center gap-6 text-sm text-soil-600 md:flex">
            <a href="#van-de" className="hover:text-soil-900">Vấn đề</a>
            <a href="#cach-lam" className="hover:text-soil-900">Cách vận hành</a>
            <a href="#phuong-phap" className="hover:text-soil-900">Phương pháp luận</a>
            <a href="#doanh-thu" className="hover:text-soil-900">Chia doanh thu</a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {profile ? (
              <LinkButton href={appHref}>Vào hệ thống</LinkButton>
            ) : (
              <>
                <LinkButton href="/dang-nhap" variant="ghost">Đăng nhập</LinkButton>
                <LinkButton href="/dang-ky">Đăng ký</LinkButton>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        {/* ---------------------------------------------------------------- hero */}
        <section className="relative overflow-hidden bg-leaf-900">
          <PaddyPattern />
          <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-leaf-300">
              Nền tảng MRV cho nông nghiệp carbon thấp
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl">
              Nhật ký canh tác của nông hộ nhỏ,
              <br className="hidden sm:block" /> trở thành tín chỉ carbon bán được.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-leaf-100">
              Thuê tư vấn quốc tế đo đạc kiểm định cho một mảnh ruộng nhỏ tốn hàng chục
              nghìn đô la — đắt hơn cả giá trị tín chỉ thu về. Agri-Carbon Pass gom hàng
              trăm nông hộ thành một dự án carbon tập thể để chi phí đó chia được cho
              hàng nghìn hecta.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/dang-ky"
                className="group rounded-xl bg-white px-6 py-4 text-left transition hover:bg-leaf-50"
              >
                <span className="block text-base font-semibold text-leaf-900">
                  Tôi là hợp tác xã →
                </span>
                <span className="mt-0.5 block text-sm text-soil-600">
                  Số hoá vùng canh tác và tạo hồ sơ tín chỉ
                </span>
              </Link>
              <Link
                href="/cho"
                className="group rounded-xl border border-leaf-500/40 px-6 py-4 text-left transition hover:border-leaf-300 hover:bg-leaf-800"
              >
                <span className="block text-base font-semibold text-white">
                  Tôi là doanh nghiệp →
                </span>
                <span className="mt-0.5 block text-sm text-leaf-200">
                  Mua tín chỉ truy xuất được tới từng thửa ruộng
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- số liệu thị trường */}
        <section className="border-b border-soil-200 bg-soil-50">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {MARKET_STATS.map((s) => (
                <div key={s.label}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight text-leaf-800">
                      {s.value}
                    </span>
                    <span className="text-sm font-medium text-leaf-700">{s.unit}</span>
                  </div>
                  <p className="mt-2 text-sm leading-snug text-soil-600">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-xs text-soil-400">
              Số liệu bối cảnh thị trường, không phải quy mô của nền tảng. Nguồn trích ở
              cuối trang.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- vấn đề */}
        <section id="van-de" className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-soil-900 sm:text-4xl">
                Điểm nghẽn không nằm ở kỹ thuật canh tác
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-soil-600">
                Nông dân Việt Nam đã biết cách tưới ngập khô xen kẽ và ngừng đốt rơm. Cái
                thiếu là bằng chứng — thứ mà thị trường carbon đòi hỏi trước khi trả tiền.
              </p>
            </div>
            <dl className="space-y-8">
              {[
                {
                  t: "Chi phí kiểm định vượt giá trị tín chỉ",
                  d: "Một mảnh ruộng vài sào không thể gánh nổi phí thuê đơn vị MRV quốc tế. Nông hộ nhỏ vì thế đứng ngoài thị trường carbon.",
                },
                {
                  t: "Không có nhật ký canh tác",
                  d: "Làm nông theo kinh nghiệm, không ai ghi lại ngày tháo nước hay lượng phân bón. Tổ chức quốc tế không có cơ sở dữ liệu để cấp chứng chỉ.",
                },
                {
                  t: "Doanh nghiệp khát tín chỉ sạch",
                  d: "Các tập đoàn chịu áp lực Net Zero nhưng không biết mua tín chỉ chất lượng cao, minh bạch nguồn gốc ở đâu.",
                },
              ].map((x) => (
                <div key={x.t} className="border-l-2 border-leaf-500 pl-6">
                  <dt className="text-lg font-semibold text-soil-900">{x.t}</dt>
                  <dd className="mt-2 leading-relaxed text-soil-600">{x.d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* -------------------------------------------------------------- cách làm */}
        <section id="cach-lam" className="border-y border-soil-200 bg-soil-50">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-soil-900 sm:text-4xl">
              Bốn bước, từ bờ ruộng đến hợp đồng
            </h2>
            <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf-700 text-sm font-bold text-white">
                    {s.n}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-soil-900">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-soil-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- công cụ */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-leaf-700">
                Công cụ cho hợp tác xã
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-soil-900 sm:text-4xl">
                Không tính được thì nói rõ còn thiếu gì
              </h2>
              <p className="mt-6 leading-relaxed text-soil-600">
                Phần lớn phần mềm MRV cho ra một con số bất kể dữ liệu đầu vào ra sao.
                Chúng tôi làm ngược lại: thiếu dữ liệu thì engine từ chối tính và nêu đích
                danh trường còn trống, để cán bộ hợp tác xã biết phải bổ sung gì.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Vẽ ranh thửa trên ảnh vệ tinh, diện tích tính từ hình học",
                  "Cảnh báo ngay khi hai hộ cùng khai một mảnh ruộng",
                  "Khoá nhật ký sau khi con số đã phát hành thành tín chỉ",
                  "Lưu đủ tham số để tái lập lại phép tính sau nhiều năm",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-soil-700">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-600" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <AppPreview />
          </div>
        </section>

        {/* ----------------------------------------------------------- phương pháp */}
        <section id="phuong-phap" className="border-y border-soil-200 bg-soil-900">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr]">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Hệ số đo tại chính vùng canh tác
                </h2>
                <p className="mt-6 leading-relaxed text-soil-200">
                  Mặc định toàn cầu của IPCC là 1,19 kg CH₄/ha/ngày. Số đo thực địa ở
                  Đồng bằng sông Hồng cho thấy cao hơn nhiều, và hai vụ trong năm chênh
                  nhau rõ rệt — Vụ Mùa phát thải nền gần gấp đôi Vụ Xuân.
                </p>
                <p className="mt-4 leading-relaxed text-soil-200">
                  Dùng một con số chung cho cả năm sẽ tính thiếu lượng giảm phát thải mà
                  nông dân đáng được ghi nhận. Hệ thống chọn hệ số theo đúng loại vụ đã
                  khai; gặp tổ hợp chưa có số đo thì báo lỗi chứ không lấy đại.
                </p>
                <pre className="mt-8 overflow-x-auto rounded-xl border border-soil-800 bg-black/40 px-5 py-4 text-sm text-leaf-300">
{`CH₄ = EFc × SFw × SFp × SFo × t × A
SFo = (1 + Σ ROAᵢ × CFOAᵢ)^0.59`}
                </pre>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-soil-400">
                    Hệ số phát thải nền EFc — kg CH₄/ha/ngày
                  </p>
                  <span className="text-xs text-leaf-400">Đồng bằng sông Hồng</span>
                </div>

                <div className="mt-7 space-y-6">
                  {ACTIVE_REGION_FACTORS.map((f) => (
                    <FactorBar
                      key={f.seasonType}
                      label={f.label}
                      value={f.value}
                      delta={f.value / IPCC_GLOBAL_DEFAULT - 1}
                      highlight
                    />
                  ))}
                  <div className="border-t border-soil-800 pt-6">
                    <FactorBar
                      label="Mặc định toàn cầu IPCC"
                      value={IPCC_GLOBAL_DEFAULT}
                      highlight={false}
                    />
                  </div>
                </div>

                <p className="mt-8 text-xs leading-relaxed text-soil-400">
                  Hệ số đo tại 36 điểm trên cả nước theo đúng điều kiện nền của IPCC —
                  ruộng ngập liên tục, không bón chất hữu cơ — nên cắm thẳng vào công
                  thức được.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ doanh thu */}
        <section id="doanh-thu" className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-16 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-soil-900 sm:text-4xl">
                Phần lớn doanh thu về tay nông dân
              </h2>
              <p className="mt-6 leading-relaxed text-soil-600">
                Mỗi đơn hàng thanh toán xong được tách tự động, và phần của nông hộ chia
                theo đúng tỷ lệ đóng góp giảm phát thải của từng hộ trong lô — không chia
                đều, không thương lượng lại.
              </p>
              <p className="mt-4 leading-relaxed text-soil-600">
                Đây là nguồn sinh kế mới bên cạnh tiền bán lúa, trên chính mảnh ruộng họ
                vẫn đang canh tác.
              </p>
            </div>

            <div>
              <div className="flex h-14 overflow-hidden rounded-xl">
                <div className="flex w-[80%] items-center justify-center bg-leaf-700 text-sm font-semibold text-white">
                  Nông hộ 80%
                </div>
                <div className="flex w-[12%] items-center justify-center bg-carbon-500 text-xs font-semibold text-white">
                  12%
                </div>
                <div className="flex w-[8%] items-center justify-center bg-soil-400 text-xs font-semibold text-white">
                  8%
                </div>
              </div>
              <dl className="mt-6 space-y-3 text-sm">
                {[
                  ["bg-leaf-700", "Nông hộ", "Chia theo tỷ trọng giảm phát thải của từng thửa"],
                  ["bg-carbon-500", "Phí nền tảng", "Duy trì hệ thống và kết nối bên mua"],
                  ["bg-soil-400", "Phí quản lý hợp tác xã", "Chi phí vận hành của đơn vị"],
                ].map(([color, name, desc]) => (
                  <div key={name} className="flex gap-3">
                    <span aria-hidden className={`mt-1.5 h-3 w-3 shrink-0 rounded ${color}`} />
                    <div>
                      <dt className="font-medium text-soil-900">{name}</dt>
                      <dd className="text-soil-600">{desc}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ CTA hai luồng */}
        <section className="border-t border-soil-200 bg-soil-50">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-center text-3xl font-bold tracking-tight text-soil-900 sm:text-4xl">
              Bạn đến từ phía nào?
            </h2>
            <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-soil-200 bg-white p-8">
                <h3 className="text-xl font-semibold text-soil-900">Hợp tác xã nông nghiệp</h3>
                <p className="mt-3 flex-1 leading-relaxed text-soil-600">
                  Số hoá vùng canh tác, ghi nhật ký mùa vụ và gộp thành lô tín chỉ đủ quy
                  mô để chào bán. Nông hộ không cần tài khoản riêng.
                </p>
                <LinkButton href="/dang-ky" className="mt-8 w-full">
                  Bắt đầu với hợp tác xã của bạn
                </LinkButton>
              </div>
              <div className="flex flex-col rounded-2xl border border-soil-200 bg-white p-8">
                <h3 className="text-xl font-semibold text-soil-900">Doanh nghiệp mua tín chỉ</h3>
                <p className="mt-3 flex-1 leading-relaxed text-soil-600">
                  Duyệt các lô đang chào bán, xem hồ sơ phương pháp luận và đặt mua. Mỗi
                  lô truy xuất được tới từng thửa ruộng và từng nông hộ.
                </p>
                <LinkButton href="/cho" variant="secondary" className="mt-8 w-full">
                  Xem tín chỉ đang chào bán
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-soil-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <div className="font-bold text-leaf-800">Agri-Carbon Pass</div>
              <p className="mt-2 max-w-md text-sm text-soil-600">
                Nền tảng số hoá MRV và kết nối tín chỉ carbon cho nông hộ nhỏ.
              </p>
            </div>
            <div className="flex gap-12 text-sm">
              <div>
                <div className="font-medium text-soil-900">Hợp tác xã</div>
                <ul className="mt-3 space-y-2 text-soil-600">
                  <li><Link href="/dang-ky" className="hover:text-leaf-700">Đăng ký</Link></li>
                  <li><Link href="/dang-nhap" className="hover:text-leaf-700">Đăng nhập</Link></li>
                </ul>
              </div>
              <div>
                <div className="font-medium text-soil-900">Doanh nghiệp</div>
                <ul className="mt-3 space-y-2 text-soil-600">
                  <li><Link href="/cho" className="hover:text-leaf-700">Chợ tín chỉ</Link></li>
                  <li><Link href="/don-hang" className="hover:text-leaf-700">Đơn hàng</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-soil-200 pt-8">
            <p className="text-xs font-medium text-soil-600">Nguồn số liệu trích dẫn</p>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-soil-400">
              <li>
                Diện tích gieo trồng lúa Đồng bằng sông Hồng: Tổng cục Thống kê, số liệu
                sản xuất lúa 2022 và vụ đông xuân 2024.
              </li>
              <li>
                Tỷ trọng phát thải của lúa trong nông nghiệp và lượng phát thải hằng năm:
                Viện Khoa học Nông nghiệp Việt Nam.
              </li>
              <li>
                Hệ số phát thải nền theo vùng và mùa vụ: Vo và cộng sự, 2020,{" "}
                <em>Climate</em> 8(6):74 — đo tại 36 điểm trên cả nước theo điều kiện nền
                của IPCC.
              </li>
              <li>
                Công thức và hệ số điều chỉnh: IPCC 2019 Refinement, Vol.4 Chương 5.
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Hoa văn ruộng bậc thang mờ phía sau hero, thuần SVG nên không phụ thuộc ảnh ngoài. */
function PaddyPattern() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
      preserveAspectRatio="none"
      viewBox="0 0 1200 600"
    >
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#86efac" stopOpacity="0" />
          <stop offset="100%" stopColor="#86efac" stopOpacity="1" />
        </linearGradient>
      </defs>
      {Array.from({ length: 9 }, (_, i) => {
        const y = 210 + i * 46;
        const bend = 26 + i * 9;
        return (
          <path
            key={i}
            d={`M-40 ${y} Q 600 ${y - bend} 1240 ${y}`}
            fill="none"
            stroke="url(#fade)"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}

function FactorBar({
  label,
  value,
  highlight,
  delta,
}: {
  label: string;
  value: number;
  highlight: boolean;
  /** Mức chênh so với mặc định IPCC, dạng tỷ lệ. Bỏ trống với chính dòng mặc định. */
  delta?: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span
          className={`text-sm ${highlight ? "font-semibold text-leaf-300" : "text-soil-300"}`}
        >
          {label}
        </span>
        <span className="flex items-baseline gap-3">
          {delta !== undefined && (
            <span className="text-xs font-medium text-carbon-500">
              cao hơn {Math.round(delta * 100)}%
            </span>
          )}
          <span
            className={`text-lg tabular-nums ${
              highlight ? "font-semibold text-leaf-300" : "text-soil-300"
            }`}
          >
            {value.toFixed(2).replace(".", ",")}
          </span>
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-soil-800">
        <div
          className={`h-full rounded-full ${highlight ? "bg-leaf-500" : "bg-soil-500"}`}
          style={{ width: `${(value / MAX_FACTOR) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Phác hoạ hai màn hình thật của ứng dụng: checklist dữ liệu thiếu và bảng kết quả. */
function AppPreview() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-soil-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-soil-900">Tính giảm phát thải</span>
          <span className="rounded-full bg-carbon-100 px-2.5 py-0.5 text-xs font-medium text-carbon-700">
            Chưa đủ dữ liệu
          </span>
        </div>
        <p className="mt-4 text-xs font-medium text-soil-600">Còn thiếu trước khi tính được</p>
        <ul className="mt-2 space-y-1.5 text-sm text-soil-700">
          {["Ngày thu hoạch", "Cách xử lý rơm rạ", "Loại vụ của mùa vụ này"].map((t) => (
            <li key={t} className="flex gap-2">
              <span aria-hidden className="text-carbon-500">•</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-leaf-200 bg-leaf-50 p-6 shadow-sm">
        <div className="text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-leaf-700">
            Giảm phát thải
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums text-leaf-900">
            2,6361 <span className="text-2xl">tCO₂e</span>
          </div>
          <div className="mt-1 text-xs text-leaf-700">
            trên 4,87 ha · 100 ngày canh tác
          </div>
        </div>
        <dl className="mt-5 space-y-1.5 border-t border-leaf-200 pt-4 text-xs">
          {[
            ["Hệ số nền đã dùng", "ef_c_north_early = 2,21"],
            ["Chế độ nước suy ra", "Rút nước nhiều lần (AWD)"],
            ["Phương pháp luận", "IPCC2019-VN-TIER2-1.0"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-leaf-700">{k}</dt>
              <dd className="font-medium text-leaf-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
