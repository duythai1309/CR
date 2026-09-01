import Image from "next/image";
import Link from "next/link";
import { getProfile, homePathFor } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";
import { LazyVideo } from "@/components/lazy-video";
import { ACTIVE_REGION_FACTORS, IPCC_GLOBAL_DEFAULT } from "@/lib/region";

const SLIDES: HeroSlide[] = [
  {
    video: "/video/ruong-bac-thang.mp4",
    poster: "/anh/poster-hero.jpg",
    media: "Flycam ruộng bậc thang vùng cao phía Bắc lúc lúa chín",
    headline: "Nhật ký canh tác của nông hộ nhỏ,",
    accent: "trở thành tín chỉ carbon bán được.",
    body:
      "Thuê tư vấn quốc tế kiểm định cho một mảnh ruộng vài sào tốn hàng chục nghìn đô la — đắt hơn cả giá trị tín chỉ thu về. Agri-Carbon Pass gom hàng trăm nông hộ thành một dự án tập thể để chi phí đó chia được cho hàng nghìn hecta.",
  },
  {
    video: "/video/thua-ruong-flycam.mp4",
    poster: "/anh/poster-thua-ruong.jpg",
    media: "Flycam toàn cảnh vùng ruộng bậc thang chia thành nhiều thửa nhỏ",
    headline: "Một mảnh ruộng",
    accent: "chỉ được tính tín chỉ một lần.",
    body:
      "Ranh thửa vẽ trên ảnh vệ tinh, diện tích tính từ hình học chứ không lấy số khai báo. Hệ thống đối chiếu với toàn bộ thửa đã có — kể cả của hợp tác xã khác — và chặn lại nếu chồng lấn.",
  },
  {
    poster: "/anh/lua-chin.jpg",
    media: "Bông lúa chín ngược nắng hoàng hôn",
    headline: "Phần lớn doanh thu",
    accent: "về tay người trực tiếp làm ruộng.",
    body:
      "Mỗi đơn hàng thanh toán xong được tách tự động, và phần của nông hộ chia theo đúng tỷ lệ đóng góp giảm phát thải của từng thửa trong lô — không chia đều, không thương lượng lại.",
  },
];

/**
 * Số liệu bối cảnh thị trường và tham số thật của hệ thống. Đây không phải quy
 * mô của nền tảng — nền tảng còn ở giai đoạn thử nghiệm — mà là độ lớn của bài
 * toán. Nguồn trích ở chân trang.
 */
const STEPS = [
  {
    n: "01",
    title: "Ghi nhật ký canh tác",
    body:
      "Cán bộ hợp tác xã nhập ngày cấy, lịch tháo nước, lượng phân bón và cách xử lý rơm rạ cho từng thửa. Nông hộ không cần tài khoản, không cần điện thoại thông minh.",
  },
  {
    n: "02",
    title: "Tính lượng giảm phát thải",
    body:
      "Hệ thống áp công thức IPCC với hệ số đo tại chính vùng canh tác. Chế độ nước suy ra từ số lần tháo nước đã ghi, không để ai tự khai.",
  },
  {
    n: "03",
    title: "Xác minh ranh thửa",
    body:
      "Mỗi thửa vẽ thành vùng trên ảnh vệ tinh, diện tích tính từ hình học. Hệ thống báo ngay nếu hai hộ cùng khai một mảnh ruộng.",
  },
  {
    n: "04",
    title: "Gộp lô và kết nối bên mua",
    body:
      "Hàng nghìn hecta gộp thành một báo cáo phát thải tập trung, đủ quy mô để làm việc với đơn vị kiểm định quốc tế và doanh nghiệp cần bù đắp.",
  },
];

const STORIES = [
  {
    img: "/anh/nong-ho-ruong-xanh.jpg",
    alt: "Nông dân và trâu trên cánh đồng lúa xanh, núi mờ phía xa",
    title: "Nông hộ không phải đổi cách làm ruộng",
    body:
      "Quy trình bám theo tập quán canh tác sẵn có. Việc duy nhất phát sinh là ghi lại những gì vẫn đang làm — và người ghi là cán bộ hợp tác xã.",
    href: "#cach-lam",
  },
  {
    img: "/anh/ruong-ngap-nuoc.jpg",
    alt: "Ruộng lúa mới cấy đang ngập nước lúc hoàng hôn",
    title: "Rút nước đúng lúc là nguồn tín chỉ lớn nhất",
    body:
      "Ruộng ngập liên tục phát thải methane mạnh nhất. Tưới ngập khô xen kẽ cắt được phần lớn lượng đó, nhưng phải có nhật ký thì mới quy ra tín chỉ.",
    href: "#phuong-phap",
  },
  {
    img: "/anh/ruong-bac-thang.jpg",
    alt: "Ruộng bậc thang có kênh nước, núi phía xa",
    title: "Con số phải tái lập lại được sau nhiều năm",
    body:
      "Mỗi phép tính lưu đủ dữ liệu đầu vào và bộ hệ số đã dùng. Nhật ký khoá lại ngay khi con số phát hành thành tín chỉ.",
    href: "#cong-cu",
  },
];

const MAX_FACTOR = Math.max(...ACTIVE_REGION_FACTORS.map((f) => f.value), IPCC_GLOBAL_DEFAULT);

export default async function Home() {
  const profile = await getProfile();
  const appHref = profile ? homePathFor(profile.role, profile.cooperative_id) : "/dang-ky";

  return (
    <div className="bg-mint-50">
      <SiteHeader ctaHref={appHref} ctaLabel={profile ? "Vào hệ thống" : "Đăng ký"} />

      <main>
        <HeroCarousel
          slides={SLIDES}
          primary={{ href: "/dang-ky", label: "Tôi là hợp tác xã" }}
          secondary={{ href: "/cho", label: "Tôi là doanh nghiệp" }}
        />

        {/* ------------------------------------------------------------- cơ hội */}
        <section id="co-hoi" className="bg-mint-100">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
            <h2 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-forest-900 sm:text-5xl lg:text-6xl">
              Cơ hội carbon lớn nhất của nông nghiệp Việt Nam
            </h2>

            <div className="mt-10 flex max-w-4xl gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                <GlobeIcon />
              </span>
              <div className="space-y-3 text-lg leading-relaxed text-forest-700">
                <p>
                  Canh tác lúa thải khoảng <strong>49,6 triệu tấn CO₂e mỗi năm</strong> ở
                  Việt Nam, chiếm <strong>48%</strong> tổng phát thải nhà kính của ngành
                  nông nghiệp.
                </p>
                <p>
                  Agri-Carbon Pass số hoá khâu đo đạc và kiểm chứng để phần giảm phát thải
                  đó trở thành thu nhập của chính nông hộ đã tạo ra nó.
                </p>
              </div>
            </div>

            <div className="mt-16 overflow-hidden rounded-3xl">
              <div className="relative aspect-[16/7] w-full">
                <Image
                  src="/anh/nong-ho-ruong-xanh.jpg"
                  alt="Cánh đồng lúa xanh trải rộng dưới chân núi"
                  fill
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest-950/85 via-forest-950/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-mint-300">
                    Vùng triển khai
                  </p>
                  <p className="mt-3 max-w-2xl text-2xl font-bold leading-snug text-white sm:text-3xl">
                    Đồng bằng sông Hồng và trung du miền núi phía Bắc, khoảng 950 nghìn
                    hecta lúa gieo trồng mỗi năm
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- lưới số liệu */}
        <section className="bg-mint-100 pb-24 sm:pb-32">
          <div className="mx-auto grid max-w-7xl auto-rows-[minmax(220px,auto)] gap-5 px-6 md:grid-cols-2 lg:grid-cols-3">
            <PhotoTile
              src="/anh/lua-chin.jpg"
              eyebrow="Bối cảnh bài toán"
              title="Vì sao nông hộ nhỏ đứng ngoài thị trường carbon"
            />

            <div className="rounded-3xl bg-white p-8">
              <h3 className="text-xl font-bold text-forest-900">Hệ số phát thải nền</h3>
              <dl className="mt-6 space-y-4">
                {ACTIVE_REGION_FACTORS.map((f) => (
                  <div key={f.seasonType} className="flex items-baseline justify-between gap-4">
                    <dt className="text-forest-700">{f.label}</dt>
                    <dd className="text-2xl font-bold tabular-nums text-forest-900">
                      {f.value.toString().replace(".", ",")}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 border-t border-mint-200 pt-4">
                  <dt className="text-forest-600">Mặc định IPCC toàn cầu</dt>
                  <dd className="text-lg font-semibold tabular-nums text-forest-600">
                    {IPCC_GLOBAL_DEFAULT.toString().replace(".", ",")}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 text-sm text-forest-600">kg CH₄/ha/ngày</p>
            </div>

            <StatTile
              tone="dark"
              value="80%"
              title="Doanh thu về tay nông hộ"
              note="Chia theo tỷ trọng giảm phát thải của từng thửa, không chia đều"
              badge
            />

            <div className="flex flex-col justify-between rounded-3xl bg-white p-8">
              <p className="text-center text-sm font-semibold text-forest-700">
                Phương pháp luận dựa trên
              </p>
              <ul className="my-6 space-y-4 text-center">
                <li className="text-lg font-bold leading-tight text-forest-900">
                  IPCC 2019 Refinement
                  <span className="mt-1 block text-sm font-normal text-forest-600">
                    Vol.4, Chương 5.5 — canh tác lúa nước
                  </span>
                </li>
                <li className="text-lg font-bold leading-tight text-forest-900">
                  Vo và cộng sự, 2020
                  <span className="mt-1 block text-sm font-normal text-forest-600">
                    <em>Climate</em> 8(6):74 — đo tại 36 điểm ở Việt Nam
                  </span>
                </li>
              </ul>
              <p className="text-center text-xs text-forest-600">
                Không dùng hệ số tự đặt
              </p>
            </div>

            <PhotoTile
              src="/anh/ruong-ngap-nuoc.jpg"
              eyebrow="Diện tích gieo trồng"
              title="≈950 nghìn ha"
              subtitle="Lúa mỗi năm ở Đồng bằng sông Hồng"
              align="bottom"
            />

            <StatTile
              tone="carbon"
              value="49,6"
              unit="triệu tấn CO₂e"
              title="Phát thải mỗi năm từ canh tác lúa cả nước"
            />

            <StatTile
              tone="light"
              value="48%"
              title="Tỷ trọng của lúa trong phát thải nhà kính nông nghiệp"
            />

            <PhotoTile
              src="/anh/ruong-bac-thang.jpg"
              eyebrow="Chống khai trùng"
              title="Ranh thửa đối chiếu bằng PostGIS trước khi lưu"
              align="bottom"
            />

            <StatTile
              tone="light"
              value="45%"
              title="Mức cắt giảm methane khi áp dụng tưới ngập khô xen kẽ"
              note="Theo hệ số điều chỉnh chế độ nước của IPCC"
            />
          </div>
        </section>

        {/* ----------------------------------------------------------- cách làm */}
        <section id="cach-lam" className="bg-forest-800">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
            <h2 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              Bốn bước, <span className="text-mint-400">từ bờ ruộng đến hợp đồng</span>
            </h2>
            <p className="mt-8 max-w-3xl text-lg leading-relaxed text-mint-100">
              Nông dân Việt Nam đã biết cách tưới ngập khô xen kẽ và ngừng đốt rơm. Cái
              thiếu là bằng chứng — thứ mà thị trường carbon đòi hỏi trước khi trả tiền.
            </p>

            <figure className="mt-14">
              <div className="overflow-hidden rounded-3xl">
                <LazyVideo
                  src="/video/thua-ruong-flycam.mp4"
                  poster="/anh/poster-thua-ruong.jpg"
                  label="Flycam toàn cảnh vùng ruộng bậc thang chia thành nhiều thửa nhỏ"
                  className="aspect-video w-full bg-forest-900 object-cover"
                />
              </div>
              <figcaption className="mt-5 text-center text-mint-400">
                Vùng canh tác bậc thang phía Bắc — mỗi bậc là một thửa cần ranh giới riêng
              </figcaption>
            </figure>

            <div className="mt-20 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-500 text-sm font-bold text-forest-950">
                    {s.n}
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-white">{s.title}</h3>
                  <p className="mt-3 leading-relaxed text-mint-100/80">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- dải nổi bật: công cụ */}
        <section id="cong-cu" className="relative isolate overflow-hidden bg-forest-900">
          <Image
            src="/anh/ruong-ngap-nuoc.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/70 to-forest-950/40" />
          <div className="relative mx-auto max-w-7xl px-6 py-32 sm:py-44">
            <span className="inline-block rounded-md bg-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-white backdrop-blur">
              Công cụ cho hợp tác xã
            </span>
            <h2 className="mt-8 max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Không tính được thì nói rõ còn thiếu gì
            </h2>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-mint-100">
              Phần lớn phần mềm MRV cho ra một con số bất kể dữ liệu đầu vào ra sao. Chúng
              tôi làm ngược lại: thiếu dữ liệu thì engine từ chối tính và nêu đích danh
              trường còn trống, để cán bộ hợp tác xã biết phải bổ sung gì.
            </p>

            <ul className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
              {[
                "Vẽ ranh thửa trên ảnh vệ tinh",
                "Cảnh báo khi hai hộ khai trùng ruộng",
                "Khoá nhật ký sau khi phát hành tín chỉ",
                "Lưu đủ tham số để tái lập phép tính",
              ].map((t) => (
                <li key={t} className="flex gap-3 text-mint-100">
                  <CheckIcon />
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/dang-ky"
                className="rounded-full bg-mint-500 px-8 py-4 font-semibold text-forest-950 transition hover:bg-mint-400"
              >
                Dùng thử công cụ
              </Link>
              <Link
                href="/cho"
                className="rounded-full border border-white/70 px-8 py-4 font-semibold text-white transition hover:bg-white hover:text-forest-900"
              >
                Xem tín chỉ đang chào bán
              </Link>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- câu chuyện */}
        <section id="cau-chuyen" className="bg-forest-800">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ba điều quyết định con số có đáng tin không
            </h2>

            <div className="mt-14 grid gap-10 md:grid-cols-3">
              {STORIES.map((s) => (
                <article key={s.title}>
                  <div className="overflow-hidden rounded-2xl">
                    <Image
                      src={s.img}
                      alt={s.alt}
                      width={900}
                      height={600}
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="aspect-[3/2] w-full object-cover"
                    />
                  </div>
                  <h3 className="mt-6 text-xl font-bold leading-snug text-white">
                    {s.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-mint-100/80">{s.body}</p>
                  <a
                    href={s.href}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-mint-400 transition hover:text-mint-300"
                  >
                    <span aria-hidden>▶</span> Tìm hiểu
                  </a>
                </article>
              ))}
            </div>

            <div className="mt-20 flex flex-col items-start justify-between gap-8 rounded-3xl bg-mint-100 p-10 sm:p-12 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <h3 className="text-3xl font-bold leading-tight tracking-tight text-forest-900">
                  Hợp tác xã của bạn đã có vùng canh tác — phần còn lại là hồ sơ
                </h3>
                <p className="mt-4 leading-relaxed text-forest-700">
                  Tạo tài khoản, khai vùng canh tác và bắt đầu ghi nhật ký mùa vụ. Nông hộ
                  không cần tài khoản riêng, mọi dữ liệu do cán bộ hợp tác xã nhập.
                </p>
              </div>
              <Link
                href="/dang-ky"
                className="shrink-0 rounded-full border-2 border-forest-800 px-8 py-4 font-semibold text-forest-900 transition hover:bg-forest-800 hover:text-white"
              >
                Đăng ký hợp tác xã
              </Link>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- doanh thu */}
        <section id="doanh-thu" className="bg-mint-50">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-24 sm:py-32 lg:grid-cols-[0.72fr_1.28fr]">
            <figure className="mx-auto w-full max-w-[300px]">
              <LazyVideo
                src="/video/nong-dan-trau.mp4"
                poster="/anh/poster-nong-dan.jpg"
                label="Nông dân dắt đàn trâu trên bờ ruộng lúc hoàng hôn"
                className="aspect-[9/16] w-full rounded-[2rem] bg-mint-100 object-cover"
              />
              <figcaption className="mt-4 text-center text-sm leading-relaxed text-forest-600">
                Tín chỉ carbon là khoản thu thêm trên chính mảnh ruộng đang canh tác,
                không bắt nông hộ đổi nghề.
              </figcaption>
            </figure>

            <div>
              <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-forest-900 sm:text-5xl">
                Phần lớn doanh thu <span className="text-mint-600">về tay nông dân</span>
              </h2>
              <p className="mt-8 text-lg leading-relaxed text-forest-700">
                Mỗi đơn hàng thanh toán xong được tách tự động, và phần của nông hộ chia
                theo đúng tỷ lệ đóng góp giảm phát thải của từng hộ trong lô — không chia
                đều, không thương lượng lại.
              </p>

              <div className="mt-10 flex h-16 overflow-hidden rounded-2xl">
                <div className="flex w-[80%] items-center justify-center bg-forest-800 font-semibold text-white">
                  Nông hộ 80%
                </div>
                <div className="flex w-[12%] items-center justify-center bg-mint-500 text-sm font-semibold text-forest-950">
                  12%
                </div>
                <div className="flex w-[8%] items-center justify-center bg-mint-300 text-sm font-semibold text-forest-950">
                  8%
                </div>
              </div>

              <dl className="mt-8 grid gap-5 sm:grid-cols-3">
                {[
                  ["bg-forest-800", "Nông hộ", "Theo tỷ trọng giảm phát thải của từng thửa"],
                  ["bg-mint-500", "Phí nền tảng", "Duy trì hệ thống và kết nối bên mua"],
                  ["bg-mint-300", "Phí quản lý HTX", "Chi phí vận hành của đơn vị"],
                ].map(([color, name, desc]) => (
                  <div key={name}>
                    <span aria-hidden className={`block h-1.5 w-10 rounded-full ${color}`} />
                    <dt className="mt-3 font-semibold text-forest-900">{name}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-forest-600">{desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- phương pháp */}
        <section id="phuong-phap" className="bg-forest-800">
          <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 sm:py-32 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
                Hệ số đo tại <span className="text-mint-400">chính vùng canh tác</span>
              </h2>
              <p className="mt-8 leading-relaxed text-mint-100">
                Mặc định toàn cầu của IPCC là 1,19 kg CH₄/ha/ngày. Số đo thực địa ở Đồng
                bằng sông Hồng cho thấy cao hơn nhiều, và hai vụ trong năm chênh nhau rõ
                rệt — Vụ Mùa phát thải nền gần gấp đôi Vụ Xuân.
              </p>
              <p className="mt-4 leading-relaxed text-mint-100/80">
                Dùng mặc định toàn cầu ở miền Bắc nghĩa là tính thiếu cho nông hộ phần lớn
                lượng giảm phát thải họ thực sự tạo ra. Hệ thống vì thế chọn hệ số theo
                vùng và loại vụ, và lưu lại phiên bản bộ hệ số đã dùng cho từng phép tính.
              </p>
            </div>

            <div className="rounded-3xl bg-forest-900 p-8 sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-mint-400">
                Hệ số phát thải nền · kg CH₄/ha/ngày
              </p>
              <div className="mt-10 space-y-8">
                <FactorBar
                  label="Mặc định IPCC toàn cầu"
                  value={IPCC_GLOBAL_DEFAULT}
                  max={MAX_FACTOR}
                />
                {ACTIVE_REGION_FACTORS.map((f) => (
                  <FactorBar
                    key={f.seasonType}
                    label={f.label}
                    value={f.value}
                    max={MAX_FACTOR}
                    highlight
                    delta={`+${Math.round((f.value / IPCC_GLOBAL_DEFAULT - 1) * 100)}%`}
                  />
                ))}
              </div>
              <p className="mt-10 text-sm leading-relaxed text-mint-100/60">
                Nguồn: Vo và cộng sự, 2020, <em>Climate</em> 8(6):74 — đo theo đúng điều
                kiện nền mà IPCC quy định.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- CTA cuối */}
        <section className="bg-forest-900">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
            <h2 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Cùng biến ruộng lúa miền Bắc thành tài sản carbon
            </h2>
            <p className="mt-8 max-w-3xl text-lg leading-relaxed text-mint-100">
              Agri-Carbon Pass kết nối hợp tác xã với doanh nghiệp cần bù đắp phát thải,
              trên nền một hồ sơ MRV truy xuất được tới từng thửa ruộng và từng nông hộ.
            </p>

            <h3 className="mt-16 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Bạn đến từ phía nào?
            </h3>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/dang-ky"
                className="rounded-full bg-mint-100 px-10 py-4 font-semibold text-forest-900 transition hover:bg-white"
              >
                Hợp tác xã
              </Link>
              <Link
                href="/cho"
                className="rounded-full border border-white/70 px-10 py-4 font-semibold text-white transition hover:bg-white hover:text-forest-900"
              >
                Doanh nghiệp
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-forest-950">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div>
              <div className="text-lg font-bold text-white">Agri-Carbon Pass</div>
              <p className="mt-3 max-w-sm leading-relaxed text-mint-100/70">
                Nền tảng số hoá MRV và kết nối tín chỉ carbon cho nông hộ nhỏ.
              </p>
            </div>
            <div className="flex gap-16 text-sm">
              <div>
                <div className="font-semibold text-white">Hợp tác xã</div>
                <ul className="mt-4 space-y-2.5 text-mint-100/70">
                  <li><Link href="/dang-ky" className="hover:text-mint-400">Đăng ký</Link></li>
                  <li><Link href="/dang-nhap" className="hover:text-mint-400">Đăng nhập</Link></li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-white">Doanh nghiệp</div>
                <ul className="mt-4 space-y-2.5 text-mint-100/70">
                  <li><Link href="/cho" className="hover:text-mint-400">Chợ tín chỉ</Link></li>
                  <li><Link href="/don-hang" className="hover:text-mint-400">Đơn hàng</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-14 border-t border-white/10 pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mint-400">
              Nguồn số liệu trích dẫn
            </p>
            <ul className="mt-4 space-y-2 text-xs leading-relaxed text-mint-100/50">
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
              <li>Công thức và hệ số điều chỉnh: IPCC 2019 Refinement, Vol.4 Chương 5.</li>
              <li>
                Ảnh và video trên trang là tư liệu minh hoạ, không phải ảnh chụp tại vùng
                dự án.
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Ô ảnh trong lưới số liệu: ảnh nền, chữ đè lên, phủ tối để đọc được. */
function PhotoTile({
  src,
  eyebrow,
  title,
  subtitle,
  align = "top",
}: {
  src: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "top" | "bottom";
}) {
  return (
    <div className="relative isolate flex min-h-[220px] overflow-hidden rounded-3xl">
      <Image src={src} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
      <div
        className={`absolute inset-0 ${
          align === "bottom"
            ? "bg-gradient-to-t from-forest-950/90 via-forest-950/40 to-forest-950/10"
            : "bg-gradient-to-b from-forest-950/85 via-forest-950/40 to-forest-950/10"
        }`}
      />
      <div
        className={`relative flex w-full flex-col p-8 ${
          align === "bottom" ? "justify-end" : "justify-start"
        }`}
      >
        <p className="text-sm font-semibold text-mint-300">{eyebrow}</p>
        <p className="mt-2 text-2xl font-bold leading-tight text-white">{title}</p>
        {subtitle && <p className="mt-2 text-mint-100/80">{subtitle}</p>}
      </div>
    </div>
  );
}

/** Ô số liệu ba tông: tối, sáng, và tông carbon dùng cho con số phát thải. */
function StatTile({
  tone,
  value,
  unit,
  title,
  note,
  badge,
}: {
  tone: "dark" | "light" | "carbon";
  value: string;
  unit?: string;
  title: string;
  note?: string;
  badge?: boolean;
}) {
  const skin = {
    dark: "bg-forest-800 text-white",
    light: "bg-white text-forest-900",
    carbon: "bg-gradient-to-br from-carbon-500 to-carbon-700 text-white",
  }[tone];
  const muted = tone === "light" ? "text-forest-600" : "text-white/75";

  return (
    <div className={`relative flex min-h-[220px] flex-col justify-between rounded-3xl p-8 ${skin}`}>
      {badge && (
        <span className="absolute right-7 top-7">
          <CheckBadge />
        </span>
      )}
      <div>
        <span className="text-5xl font-bold tracking-tight">{value}</span>
        {unit && <span className="ml-2 font-semibold">{unit}</span>}
      </div>
      <div>
        <p className="text-lg font-semibold leading-snug">{title}</p>
        {note && <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{note}</p>}
      </div>
    </div>
  );
}

function FactorBar({
  label,
  value,
  max,
  highlight,
  delta,
}: {
  label: string;
  value: number;
  max: number;
  highlight?: boolean;
  delta?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className={highlight ? "font-semibold text-white" : "text-mint-100/70"}>
          {label}
        </span>
        <span className="flex items-baseline gap-3">
          {delta && <span className="text-sm font-semibold text-mint-400">{delta}</span>}
          <span
            className={`text-xl font-bold tabular-nums ${
              highlight ? "text-white" : "text-mint-100/70"
            }`}
          >
            {value.toString().replace(".", ",")}
          </span>
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${highlight ? "bg-mint-400" : "bg-white/30"}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="text-forest-800"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-mint-400"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" className="text-mint-400">
      <path
        fill="currentColor"
        d="M12 1.5 14.3 3l2.7-.4 1.2 2.5 2.5 1.2-.4 2.7 1.5 2.3-1.5 2.3.4 2.7-2.5 1.2-1.2 2.5-2.7-.4L12 22.5 9.7 21l-2.7.4-1.2-2.5-2.5-1.2.4-2.7L2.2 12l1.5-2.3-.4-2.7 2.5-1.2L7 3.3l2.7.4z"
      />
      <path
        fill="none"
        stroke="#16302A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.5 12 2.5 2.5 4.5-5"
      />
    </svg>
  );
}
