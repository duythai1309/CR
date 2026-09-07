import Image from "next/image";
import Link from "next/link";
import { getProfile, homePathFor } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";
import { LazyVideo } from "@/components/lazy-video";

const SLIDES: HeroSlide[] = [
  {
    video: "/video/ruong-bac-thang.mp4",
    poster: "/anh/poster-hero.jpg",
    media: "Flycam cảnh quan dự án carbon tại vùng núi phía Bắc",
    headline: "Từ ý tưởng đến hồ sơ đăng ký,",
    accent: "một vòng đời liền mạch.",
    body:
      "C-ROUTE giúp đơn vị phát triển dự án điều phối bảy bước thiết kế, phân công công việc và tập trung bằng chứng trên cùng một không gian làm việc.",
  },
  {
    video: "/video/thua-ruong-flycam.mp4",
    poster: "/anh/poster-thua-ruong.jpg",
    media: "Flycam toàn cảnh một vùng dự án carbon",
    headline: "Methodology có phiên bản,",
    accent: "dữ liệu đúng ngữ cảnh.",
    body:
      "Mỗi dự án chọn Standard và đúng phiên bản methodology. Schema chỉ số, bộ hệ số và biểu mẫu báo cáo đi cùng phiên bản để đội ngũ không dùng nhầm tài liệu.",
  },
  {
    poster: "/anh/lua-chin.jpg",
    media: "Cảnh quan thiên nhiên trong một vùng dự án carbon",
    headline: "Mỗi con số MRV",
    accent: "đều lần ngược được nguồn.",
    body:
      "Dữ liệu giám sát, phiên bản hệ số, kết quả tính và báo cáo được nối thành một vết kiểm toán rõ ràng, sẵn sàng cho rà soát nội bộ và làm việc với VVB.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Khởi tạo & đánh giá",
    body:
      "Ghi nhận Project Idea, tổ chức đánh giá khả thi và giao đầu việc có người phụ trách, hạn hoàn thành, bình luận và tệp đính kèm.",
  },
  {
    n: "02",
    title: "Chọn Standard & Methodology",
    body:
      "Chọn Verra hoặc Gold Standard, sau đó khóa đúng methodology và phiên bản làm nền cho thiết kế, chỉ số giám sát và phép tính.",
  },
  {
    n: "03",
    title: "Baseline, additionality & PDD",
    body:
      "Điều phối ba bước chuyên môn còn lại của giai đoạn thiết kế; lưu phiên bản tài liệu và toàn bộ trao đổi ngay trong dự án.",
  },
  {
    n: "04",
    title: "Giám sát MRV & báo cáo",
    body:
      "Tạo kỳ giám sát, nhập tay hoặc import dữ liệu theo schema, khóa snapshot tính toán và sinh báo cáo với vết tính tái lập được.",
  },
];

const STORIES = [
  {
    img: "/anh/nong-ho-ruong-xanh.jpg",
    alt: "Cảnh quan xanh trong khu vực triển khai dự án carbon",
    title: "Bảy bước thiết kế có cùng một trạng thái",
    body:
      "Owner và developer cùng nhìn thấy tiến độ, đầu việc bị chặn, người phụ trách và hồ sơ còn thiếu trước khi chuyển bước.",
    href: "#cach-lam",
  },
  {
    img: "/anh/ruong-ngap-nuoc.jpg",
    alt: "Cảnh quan vùng dự án được theo dõi theo kỳ",
    title: "Dữ liệu giám sát tuân theo methodology",
    body:
      "Biểu mẫu và import CSV được sinh từ schema chỉ số có đơn vị, kiểu dữ liệu và quy tắc kiểm tra rõ ràng.",
    href: "#phuong-phap",
  },
  {
    img: "/anh/ruong-bac-thang.jpg",
    alt: "Cảnh quan dự án carbon tại vùng núi phía Bắc",
    title: "Báo cáo giữ nguyên vết tính",
    body:
      "Mỗi kết quả gắn với dữ liệu nguồn, phiên bản methodology, bộ hệ số và mẫu báo cáo đã dùng tại thời điểm tạo.",
    href: "#phuong-phap",
  },
];

const METHOD_VERSIONS = [
  { key: "standard", label: "Standard", status: "Đã chọn", value: 100 },
  { key: "methodology", label: "Methodology", status: "Có version", value: 100 },
  { key: "factors", label: "Bộ hệ số & schema chỉ số", status: "Đã khóa", value: 100 },
];
const MAX_FACTOR = 100;

export default async function Home() {
  const profile = await getProfile();
  const appHref = profile ? homePathFor(profile.role, profile.cooperative_id) : "/dang-ky";

  return (
    <div className="bg-mint-50">
      <SiteHeader ctaHref={appHref} ctaLabel={profile ? "Vào hệ thống" : "Đăng ký"} />

      <main>
        <HeroCarousel
          slides={SLIDES}
          primary={{ href: "/dang-ky", label: "Bắt đầu một dự án" }}
          secondary={{ href: "/du-an", label: "Mở không gian dự án" }}
        />

        {/* ----------------------------------------------------------- cách làm */}
        <section id="cach-lam" className="bg-forest-800">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
            <h2 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              C-ROUTE, <span className="text-mint-400">từ ý tưởng đến hồ sơ</span>
            </h2>
            <p className="mt-8 max-w-3xl text-lg leading-relaxed text-mint-100">
              Mỗi bước có đầu việc, người phụ trách, thời hạn, bình luận và tài liệu. Tiến
              độ luôn hiện rõ để đội ngũ xử lý điểm nghẽn trước khi hồ sơ sang vòng kế tiếp.
            </p>

            <figure className="mt-14">
              <div className="overflow-hidden rounded-3xl">
                <LazyVideo
                  src="/video/thua-ruong-flycam.mp4"
                  poster="/anh/poster-thua-ruong.jpg"
                  label="Flycam cảnh quan minh hoạ cho vùng triển khai dự án carbon"
                  className="aspect-video w-full bg-forest-900 object-cover"
                />
              </div>
              <figcaption className="mt-5 text-center text-mint-400">
                Mỗi địa bàn dự án đều cần một hồ sơ nhất quán từ thiết kế đến giám sát
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

        {/* ------------------------------------------------------------- cơ hội */}
        <section id="co-hoi" className="bg-mint-100">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
            <h2 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-forest-900 sm:text-5xl lg:text-6xl">
              Hạ tầng vận hành cho dự án carbon
            </h2>

            <div className="mt-10 flex max-w-4xl gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                <GlobeIcon />
              </span>
              <div className="space-y-3 text-lg leading-relaxed text-forest-700">
                <p>
                  Một dự án carbon chuyên nghiệp đi qua <strong>bảy bước thiết kế</strong>,
                  nhiều vòng tài liệu và các kỳ giám sát kéo dài trong nhiều năm.
                </p>
                <p>
                  C-ROUTE giữ công việc, methodology, dữ liệu MRV và báo cáo trong
                  một cấu trúc thống nhất để đội ngũ tập trung vào chất lượng hồ sơ.
                </p>
              </div>
            </div>

            <div className="mt-16 overflow-hidden rounded-3xl">
              <div className="relative aspect-[16/7] w-full">
                <Image
                  src="/anh/nong-ho-ruong-xanh.jpg"
                  alt="Cảnh quan xanh minh hoạ cho một vùng dự án carbon"
                  fill
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest-950/85 via-forest-950/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-mint-300">
                    Một nguồn dữ liệu dự án
                  </p>
                  <p className="mt-3 max-w-2xl text-2xl font-bold leading-snug text-white sm:text-3xl">
                    Từ Project Idea, PDD đến từng kỳ Monitoring và báo cáo MRV
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
              eyebrow="Bối cảnh vận hành"
              title="Dự án phức tạp cần nhiều hơn một thư mục tài liệu"
            />

            <div className="rounded-3xl bg-white p-8">
              <h3 className="text-xl font-bold text-forest-900">Chuỗi phiên bản có kiểm soát</h3>
              <dl className="mt-6 space-y-4">
                {METHOD_VERSIONS.map((f) => (
                  <div key={f.key} className="flex items-baseline justify-between gap-4">
                    <dt className="text-forest-700">{f.label}</dt>
                    <dd className="text-2xl font-bold tabular-nums text-forest-900">
                      {f.status}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 border-t border-mint-200 pt-4">
                  <dt className="text-forest-600">Snapshot báo cáo</dt>
                  <dd className="text-lg font-semibold tabular-nums text-forest-600">
                    Bất biến
                  </dd>
                </div>
              </dl>
              <p className="mt-5 text-sm text-forest-600">Không ghi đè lịch sử đã phát hành</p>
            </div>

            <StatTile
              tone="dark"
              value="7"
              title="Bước thiết kế dự án được quản lý thống nhất"
              note="Từ ý tưởng, khả thi, lựa chọn chuẩn đến baseline, additionality và PDD"
              badge
            />

            <div className="flex flex-col justify-between rounded-3xl bg-white p-8">
              <p className="text-center text-sm font-semibold text-forest-700">
                Đa Standard ngay từ thiết kế
              </p>
              <ul className="my-6 space-y-4 text-center">
                <li className="text-lg font-bold leading-tight text-forest-900">
                  Verra
                  <span className="mt-1 block text-sm font-normal text-forest-600">
                    Methodology và bộ hệ số có phiên bản
                  </span>
                </li>
                <li className="text-lg font-bold leading-tight text-forest-900">
                  Gold Standard
                  <span className="mt-1 block text-sm font-normal text-forest-600">
                    Schema chỉ số và mẫu báo cáo riêng
                  </span>
                </li>
              </ul>
              <p className="text-center text-xs text-forest-600">
                Mỗi dự án khóa đúng phiên bản áp dụng
              </p>
            </div>

            <PhotoTile
              src="/anh/ruong-ngap-nuoc.jpg"
              eyebrow="Monitoring"
              title="Nhiều kỳ, một cấu trúc"
              subtitle="Nhập tay hoặc import CSV theo schema methodology"
              align="bottom"
            />

            <StatTile
              tone="carbon"
              value="MRV"
              title="Dữ liệu, phép tính và báo cáo nối liền nhau"
            />

            <StatTile
              tone="light"
              value="100%"
              title="Kết quả có nguồn dữ liệu và phiên bản hệ số đi kèm"
            />

            <PhotoTile
              src="/anh/ruong-bac-thang.jpg"
              eyebrow="Cộng tác"
              title="Owner, developer và viewer đúng quyền trong từng dự án"
              align="bottom"
            />

            <StatTile
              tone="light"
              value="1"
              title="Nguồn sự thật cho toàn bộ hồ sơ dự án"
              note="Không còn phiên bản rời rạc giữa bảng tính, email và thư mục dùng chung"
            />
          </div>
        </section>



        {/* --------------------------------------------------------- câu chuyện */}
        <section id="cau-chuyen" className="bg-forest-800">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ba lớp giữ hồ sơ sẵn sàng rà soát
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
                  Đội ngũ của bạn có chuyên môn — nền tảng giữ phần vận hành liền mạch
                </h3>
                <p className="mt-4 leading-relaxed text-forest-700">
                  Tạo dự án, mời developer và bắt đầu từ Project Idea. Mọi quyết định,
                  bằng chứng và dữ liệu giám sát đi cùng dự án suốt vòng đời.
                </p>
              </div>
              <Link
                href="/dang-ky"
                className="shrink-0 rounded-full border-2 border-forest-800 px-8 py-4 font-semibold text-forest-900 transition hover:bg-forest-800 hover:text-white"
              >
                Đăng ký đơn vị
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
                Một dự án carbon tốt bắt đầu từ hiện trường và kết thúc bằng hồ sơ có thể
                kiểm tra lại từng giả định.
              </figcaption>
            </figure>

            <div>
              <h2 className="text-4xl font-bold leading-[1.1] tracking-tight text-forest-900 sm:text-5xl">
                Một không gian <span className="text-mint-600">cho cả đội dự án</span>
              </h2>
              <p className="mt-8 text-lg leading-relaxed text-forest-700">
                Project Owner kiểm soát cấu hình và phê duyệt; Project Developer xử lý đầu
                việc và dữ liệu MRV; Viewer theo dõi hồ sơ mà không làm thay đổi nguồn dữ liệu.
              </p>

              <div className="mt-10 flex h-16 overflow-hidden rounded-2xl">
                <div className="flex w-[80%] items-center justify-center bg-forest-800 font-semibold text-white">
                  Thiết kế 80%
                </div>
                <div className="flex w-[12%] items-center justify-center bg-mint-500 text-sm font-semibold text-forest-950">
                  MRV
                </div>
                <div className="flex w-[8%] items-center justify-center bg-mint-300 text-sm font-semibold text-forest-950">
                  Báo cáo
                </div>
              </div>

              <dl className="mt-8 grid gap-5 sm:grid-cols-3">
                {[
                  ["bg-forest-800", "Thiết kế dự án", "Bảy bước có task, tài liệu và phê duyệt"],
                  ["bg-mint-500", "Giám sát MRV", "Kỳ theo dõi, dữ liệu và validation"],
                  ["bg-mint-300", "Báo cáo", "Snapshot bất biến với vết tính đầy đủ"],
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
                Methodology đúng <span className="text-mint-400">phiên bản</span>
              </h2>
              <p className="mt-8 leading-relaxed text-mint-100">
                Verra và Gold Standard tổ chức phương pháp luận, chỉ số giám sát và biểu
                mẫu theo cách khác nhau. Nền tảng lưu quan hệ này thành dữ liệu có phiên bản,
                không chỉ là tên tài liệu trong một ô nhập liệu.
              </p>
              <p className="mt-4 leading-relaxed text-mint-100/80">
                Khi methodology được cập nhật, dự án và báo cáo cũ vẫn trỏ về đúng schema,
                hệ số và template đã áp dụng. Đội ngũ có thể tái lập kết quả nhiều năm sau.
              </p>
            </div>

            <div className="rounded-3xl bg-forest-900 p-8 sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-mint-400">
                Chuỗi cấu hình được đóng dấu phiên bản
              </p>
              <div className="mt-10 space-y-8">
                <FactorBar
                  label="Standard đã chọn"
                  value={100}
                  max={MAX_FACTOR}
                />
                {METHOD_VERSIONS.slice(1).map((f) => (
                  <FactorBar
                    key={f.key}
                    label={f.label}
                    value={f.value}
                    max={MAX_FACTOR}
                    highlight
                    delta="Đã khóa"
                  />
                ))}
              </div>
              <p className="mt-10 text-sm leading-relaxed text-mint-100/60">
                Cùng phiên bản này được lưu trong dữ liệu giám sát, kết quả tính và báo cáo
                để tạo thành một vết kiểm toán xuyên suốt.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- CTA cuối */}
        <section className="bg-forest-900">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
            <h2 className="max-w-4xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Vận hành dự án carbon trên một nền tảng
            </h2>
            <p className="mt-8 max-w-3xl text-lg leading-relaxed text-mint-100">
              C-ROUTE giúp đơn vị tư vấn xây dựng hồ sơ Verra và Gold Standard
              quản lý công việc, methodology, Monitoring và báo cáo MRV có vết tính.
            </p>

            <h3 className="mt-16 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Bắt đầu với không gian dự án của bạn
            </h3>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/dang-ky"
                className="rounded-full bg-mint-100 px-10 py-4 font-semibold text-forest-900 transition hover:bg-white"
              >
                Tạo tài khoản
              </Link>
              <Link
                href="/du-an"
                className="rounded-full border border-white/70 px-10 py-4 font-semibold text-white transition hover:bg-white hover:text-forest-900"
              >
                Xem dự án
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-forest-950">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div>
              <div className="text-lg font-bold text-white">C-ROUTE</div>
              <p className="mt-3 max-w-sm leading-relaxed text-mint-100/70">
                Nền tảng quản lý vòng đời dự án carbon cho đội ngũ phát triển chuyên nghiệp.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-16 gap-y-10 text-sm">
              <div>
                <div className="font-semibold text-white">Nền tảng</div>
                <ul className="mt-4 space-y-2.5 text-mint-100/70">
                  <li><Link href="/dang-ky" className="hover:text-mint-400">Đăng ký</Link></li>
                  <li><Link href="/dang-nhap" className="hover:text-mint-400">Đăng nhập</Link></li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-white">Dự án carbon</div>
                <ul className="mt-4 space-y-2.5 text-mint-100/70">
                  <li><Link href="/du-an" className="hover:text-mint-400">Danh sách dự án</Link></li>
                  <li><Link href="/dang-ky" className="hover:text-mint-400">Bắt đầu</Link></li>
                </ul>
              </div>

              {/*
                Điện thoại và email để dạng tel:/mailto: chứ không phải chữ trơn — trên
                điện thoại đó là khác biệt giữa bấm một lần và phải chép tay.
                `not-italic` vì <address> mặc định in nghiêng.
              */}
              <address className="not-italic">
                <div className="font-semibold text-white">Liên hệ</div>
                <ul className="mt-4 space-y-2.5 text-mint-100/70">
                  <li>
                    <a href="tel:0986147699" className="hover:text-mint-400">
                      0986 147 699
                    </a>
                  </li>
                  <li>
                    <a href="mailto:croute.vn@gmail.com" className="hover:text-mint-400">
                      croute.vn@gmail.com
                    </a>
                  </li>
                  <li className="max-w-xs leading-relaxed">
                    Số 207 đường Giải Phóng, phường Đồng Tâm, quận Hai Bà Trưng, thành phố
                    Hà Nội
                  </li>
                </ul>
              </address>
            </div>
          </div>

          <div className="mt-14 border-t border-white/10 pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mint-400">
              Nguyên tắc sản phẩm
            </p>
            <ul className="mt-4 space-y-2 text-xs leading-relaxed text-mint-100/50">
              <li>
                Quản lý xuyên suốt bảy bước thiết kế dự án, từ Project Idea đến Project
                Design Document.
              </li>
              <li>
                Hỗ trợ nhiều Standard; methodology, metric schema, bộ hệ số và template
                báo cáo đều có phiên bản.
              </li>
              <li>
                Dữ liệu Monitoring được kiểm tra trước khi lưu và được khóa thành snapshot
                khi sinh báo cáo MRV.
              </li>
              <li>Mỗi báo cáo giữ đủ dữ liệu nguồn và vết tính để tái lập kết quả.</li>
              <li>
                Ảnh và video trên trang là tư liệu minh hoạ cho bối cảnh dự án carbon.
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
