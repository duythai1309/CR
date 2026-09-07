# C-route

C-route là nền tảng quản lý vòng đời dự án Carbon dành cho **đơn vị phát triển
dự án chuyên nghiệp**: đội ngũ tư vấn xây dựng hồ sơ theo Verra, Gold Standard và các
Standard tương tự. Sản phẩm tập trung vào hai phần đang nằm trong phạm vi:

- thiết kế dự án qua bảy bước, từ Project concept đến PDD — Project Design Document;
- lập monitoring period, thu nhận observation data, tính ước tính MRV và sinh báo cáo có
  calculation trace.

Nền tảng giải quyết tình trạng công việc, phiên bản methodology, bảng tính, bằng chứng và
báo cáo nằm rời rạc ở nhiều nơi. Mỗi dự án có một nguồn dữ liệu chung, quyền theo từng dự
án và snapshot đủ để lần lại dữ liệu đầu vào của một kết quả đã sinh.

Sản phẩm **không phải chợ tín chỉ**, không quản lý hợp tác xã và không tuyên bố thay thế
vai trò thẩm định của Standard hay VVB.

## Luồng sản phẩm

Bảy stage thiết kế là cố định và được duyệt tuần tự:

1. Project concept
2. Feasibility assessment
3. Standard selection
4. Methodology selection
5. Baseline scenario
6. Additionality
7. PDD — Project Design Document

Kanban dùng stage làm cột; trạng thái task (`todo`, `in_progress`, `done`, `blocked`) là
một trục riêng. Task có assignee, hạn, bình luận và tệp đính kèm. Sau phần thiết kế, đội
ngũ tạo monitoring period, nhập observation data bằng form hoặc CSV, khóa kỳ và sinh báo
cáo MRV dạng preview với calculation trace.

Các thuật ngữ chuyên môn như Standard, Methodology, PDD, baseline scenario,
additionality, monitoring plan, ex-ante/ex-post, VVB, vintage, buffer pool, leakage và
permanence được giữ nguyên để khớp tài liệu nghiệp vụ mà project developer sử dụng.

## Mô hình dữ liệu

```text
Standard
  └─ Methodology (code + version + metric_schema JSONB)
       └─ Project
            ├─ ProjectMember (owner | developer | viewer)
            ├─ Stage (1..7)
            │    └─ Task
            └─ MonitoringPeriod
                 └─ MonitoringData
                      └─ MRVReport
```

`metric_schema` định nghĩa field baseline/observation, kiểu dữ liệu, đơn vị, validation,
phép tính và aggregation. Vì form và import được sinh từ schema này, giao diện không
hard-code riêng cho dự án rừng, năng lượng hay biogas. Standard, methodology, schema, bộ
hệ số và template đều có định danh phiên bản; monitoring period và MRV report giữ snapshot
để thay đổi về sau không viết lại lịch sử.

## Vai trò và phân quyền

Vai trò nằm trong `project_members` và có hiệu lực **theo từng dự án**:

| Vai trò | Quyền chính |
|---|---|
| `owner` | Quản lý dự án/thành viên, khóa Standard và Methodology, duyệt stage, tạo và khóa monitoring period |
| `developer` | Quản lý task, bình luận, đính kèm, nhập observation data và chuẩn bị báo cáo |
| `viewer` | Chỉ đọc dữ liệu của dự án |

Một người có thể là owner ở dự án này và developer ở dự án khác. Trục này tách khỏi
`profiles.role`/`user_role` toàn cục đang được giữ cho định danh, auth và quyền
`platform_admin`; không dùng `user_role` để suy ra quyền trong dự án.

## Kiến trúc và ranh giới bảo mật

| Lớp | Công nghệ / trách nhiệm |
|---|---|
| Web | Next.js 15 App Router, React 19, Server Actions, Tailwind CSS v4 |
| Dữ liệu | Supabase, PostgreSQL 17, PostGIS, Auth và Storage |
| Validation/tính toán | TypeScript strict, Zod, AST giới hạn và số học decimal xác định |
| Trợ lý | Google Gemini qua `@google/genai`, chỉ gọi bộ công cụ đọc dữ liệu dự án đã định kiểu |
| Kiểm thử | Vitest, e2e qua phiên Supabase thật, bộ kiểm chứng PostgreSQL cô lập bằng Docker |

RLS trong PostgreSQL là **lớp bảo vệ thật**. Việc ẩn nút hoặc kiểm role ở Next.js chỉ phục
vụ trải nghiệm; nếu tầng ứng dụng bị bỏ qua, policy vẫn giới hạn người dùng vào các dự án
mà họ là thành viên. RPC `security definer` có `search_path` cố định và quyền EXECUTE được
thu hẹp. Các chuyển trạng thái/snapshot nhạy cảm — tạo dự án, quản lý thành viên, duyệt
stage, tạo/khóa monitoring period, ghi batch observation và tạo MRV report — đi qua RPC;
client không được tự ghi một snapshot tùy ý.

Tệp dự án dùng object path chứa project và user, checksum SHA-256 và chính sách
append-only. Upload thường đã được kiểm với Supabase Storage; upsert và delete bị chặn có
chủ đích để bytes không đổi sau lưng checksum.

## Trợ lý dự án

Trợ lý được tái công cụ hóa cho phần lập kế hoạch Carbon: tra danh sách/tiến độ dự án,
điều kiện duyệt stage, catalog methodology, field giám sát, baseline và task. Handler đọc
bằng phiên của người hỏi nên chịu cùng RLS; service role chỉ dùng ở đường cấu hình bí mật,
không dùng để đọc dữ liệu dự án thay người dùng.

Trợ lý không tự tính MRV và không được kể yêu cầu Verra/Gold Standard từ trí nhớ. Khi dữ
liệu catalog không có, câu trả lời đúng là chưa có dữ liệu và dẫn người dùng tới tài liệu
gốc của Standard.

## Chạy tại máy phát triển

Yêu cầu Node.js/npm; bộ kiểm chứng DB cô lập cần thêm Docker và Python 3.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Các biến môi trường chính:

| Biến | Mục đích |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/anon key cho phiên người dùng và RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Chỉ phía server; cần cho thao tác đặc quyền như ghi MRV report và đọc khóa trợ lý đã lưu |
| `GEMINI_API_KEY` | Khóa Gemini dự phòng khi chưa lưu cấu hình trợ lý trong hệ thống |

Không đặt `SUPABASE_SERVICE_ROLE_KEY` trong biến public hoặc mã phía trình duyệt. Có thể
đặt thêm `GEMINI_MODEL`; thiếu mọi khóa AI thì trợ lý tự tắt, phần quản lý dự án vẫn chạy.

| Lệnh | Phạm vi |
|---|---|
| `npm run dev` | Chạy ứng dụng tại `http://localhost:3000` |
| `npm run types` | Kiểm tra TypeScript, không phát sinh output |
| `npm run test` | Chạy unit/integration test offline bằng Vitest |
| `npm run test:e2e` | Chạy e2e lên Supabase được cấu hình; có ghi dữ liệu test và cần tài khoản seed |
| `npm run build` | Dựng bản production |

Bộ kiểm chứng migration/RLS chạy PostgreSQL + PostGIS trong container cô lập, không đọc
DSN Supabase:

```bash
python3 -B tests/db/run.py --run-id local-01
```

Mỗi `run-id` phải mới. Runner cần Docker image `postgis/postgis:17-3.4`, tạo container
không network/không volume bền và ghi bằng chứng vào `tests/db/runs/<run-id>/`.

`npm run test:e2e` là đường khác: nó kết nối Supabase theo `.env.local` và có thể để lại
dữ liệu mang tiền tố `E2E-TEST-`. Chỉ chạy trên project phát triển đã chuẩn bị theo
`docs/design/e2e-report.md`, không chạy nhầm production.

## Giới hạn phải biết trước khi dùng

- Bốn methodology hiện có trong database là **DỮ LIỆU MẪU do nhóm tự soạn, chưa được
  thẩm định chuyên môn**. Chúng không phải methodology được Verra hoặc Gold Standard
  công nhận và không được dùng như tư vấn nghiệp vụ chính thức.
- `report_templates` mới là placeholder. Bản in HTML và CSV không phải template chính
  thức; export PDF/DOCX theo mẫu Standard chưa được triển khai.
- Phạm vi dừng trước stakeholder consultation, validation, registration, VVB
  verification, standard review và issuance — tương ứng các bước 8–11 và 15–17 của quy
  trình chuẩn. MRV report hiện là ước tính, không phải tín chỉ đã phát hành.
- Import hiện chỉ hỗ trợ CSV. Chưa có parser `.xlsx`.
- Upload HTTP thường với tệp nhỏ đã được kiểm; TUS/resumable upload và tệp gần giới hạn
  dung lượng chưa được kiểm.
- Giao diện chưa từng được người dùng thật chạy thử đầu-cuối trên trình duyệt. Các báo cáo
  test trong `docs/design/` là bằng chứng kỹ thuật tại từng thời điểm, không phải kiểm thử
  khả dụng hay chứng nhận sẵn sàng production.
- Nhiều monitoring period chồng khoảng thời gian chưa có quy tắc `supersedes/current`;
  tầng tổng hợp phải tránh cộng trùng các version.

Đọc [mục lục tài liệu thiết kế](docs/design/README.md) trước khi thay đổi schema, quyền,
engine hoặc workflow.
