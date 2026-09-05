# Lớp Dự án — thiết kế

Ngày 05/9/2026. Dự án con 1 trong lộ trình chuyển Agri-Carbon Pass sang nền tảng
Digital MRV theo *MVP Product Specification v1.0*.

## Vị trí trong lộ trình

Spec đầy đủ có 17 module, 8 vai trò, 17+ màn hình — nhiều chu kỳ phát triển. Đã chia
thành năm dự án con, mỗi cái một chu kỳ thiết kế → kế hoạch → viết mã riêng:

| | Dự án con | Trạng thái |
|---|---|---|
| 1 | **Organization · Project · Monitoring Period** | tài liệu này |
| 2 | Vai trò & phân quyền đầy đủ, Audit Log | chưa |
| 3 | QA/QC engine + Issue model | chưa |
| 4 | MRV Readiness · MRV Report · khoá phiên bản | chưa |
| 5 | VVB Portal + Findings (spec xếp P1) | chưa |

Mọi dự án con còn lại đều treo trên lớp dự án, nên nó đi trước.

## Mục tiêu

Đưa khái niệm **Dự án carbon** vào hệ thống: một đơn vị phát triển dự án tạo dự án,
gắn các hợp tác xã vào, chia thành các kỳ giám sát, và nhận dữ liệu đồng ruộng vào
đúng kỳ. Sau đợt này, câu hỏi "thửa-vụ này thuộc dự án nào" trả lời được bằng một
khoá ngoại, không phải bằng suy luận.

Ngoài phạm vi đợt này: MRV Readiness, MRV Report, QA/QC engine, Audit Log, VVB
Portal, và mô hình 8 vai trò đầy đủ.

## Hai quyết định nền

### HTX tham gia nhiều dự án (M:N), lệch ERD của spec

ERD trong spec (§29) vẽ `PROJECT → HTX → FARMER`, tức hợp tác xã nằm *trong* dự án.
Thiết kế này cố ý làm khác: hợp tác xã là thực thể độc lập, nối vào dự án qua bảng
`project_cooperatives`.

Lý do là chống double-counting. Với mô hình 1:N, một hợp tác xã tham gia dự án thứ
hai buộc phải tạo bản ghi mới và nhập lại nông hộ cùng thửa ruộng — hệ thống **tự
sinh ra trùng lặp**, đúng thứ mà FR-FAR-003 và FR-PLOT-004 đặt ra để chống. Khi VVB
hỏi "chứng minh mảnh ruộng này không được tính giảm phát thải ở hai dự án", mô hình
1:N không có câu trả lời cấu trúc.

Cái giá: RLS phải đi qua bảng tham gia thay vì lọc một tầng. Chấp nhận được, và phần
RLS bên dưới cho thấy nó nhẹ hơn dự đoán ban đầu.

### Dự án nhận dữ liệu ở mức thửa-vụ

`field_seasons` nhận thêm `monitoring_period_id`. Dự án suy ra từ kỳ giám sát, nên
chỉ một khoá ngoại chứ không phải hai cột có thể nói ngược nhau.

Hai lý do chọn mức này thay vì mức thửa hoặc mức HTX:

**Đúng chỗ con số sinh ra.** `emission_calculations` gắn vào `field_season_id`. Nói
"lượng giảm này thuộc dự án nào" ngay tại đơn vị tính toán, không suy diễn qua ba
tầng quan hệ.

**Ràng buộc thành cấu trúc, không thành quy tắc.** Một cột đơn trị tự nó bảo đảm
"thửa-vụ thuộc tối đa một kỳ giám sát, tức tối đa một dự án" — **không cần unique
index nào**. Postgres từ chối, không phải một đoạn mã có thể quên gọi. Cùng nguyên
tắc đang dùng cho phân quyền trong repo này.

Hệ quả cần biết: ràng buộc này chặn *cùng một bản ghi thửa* bị tính hai lần. Nó
**không** chặn hai hợp tác xã khác nhau vẽ ranh chồng lên cùng một mảnh ruộng thật —
chỉ hình học bắt được chuyện đó, và `check_field_overlap` đã có sẵn cho việc này.

`monitoring_period_id` để `null` là trạng thái hợp lệ: hợp tác xã ghi nhật ký trước,
dự án nhận sau.

## Lược đồ

```
organizations
  id, name, code (unique), kind ('developer' | 'vvb'), created_at

projects
  id, organization_id → organizations
  code (unique), name,
  country, province, crop, project_activity,
  crediting_program, methodology_code, methodology_version,
  start_date, status project_status,
  target_area_ha, target_farmers, target_tco2e, description,
  created_at

monitoring_periods
  id, project_id → projects  on delete cascade
  name, start_date, end_date,
  status monitoring_period_status ('planned' | 'open' | 'closed')
  unique (project_id, name)
  check (end_date > start_date)

project_cooperatives                      -- bảng tham gia M:N
  project_id → projects       on delete cascade
  cooperative_id → cooperatives on delete restrict
  agreement_ref, joined_at,
  status participation_status ('active' | 'suspended' | 'withdrawn')
  primary key (project_id, cooperative_id)

project_members                           -- ánh xạ vai trò tối thiểu
  project_id → projects  on delete cascade
  user_id → profiles     on delete cascade
  role project_role ('project_developer' | 'mrv_officer' | 'htx_manager')
  primary key (project_id, user_id)

field_seasons
  + monitoring_period_id → monitoring_periods  (nullable) on delete restrict
```

Hành vi xoá cố ý không đồng nhất. `on delete cascade` ở những chỗ bản ghi con vô
nghĩa khi cha mất (kỳ giám sát của một dự án đã xoá). `on delete restrict` ở hai chỗ
chặn mất dấu vết: không xoá được hợp tác xã đang tham gia dự án, và không xoá được kỳ
giám sát đang có thửa-vụ trỏ vào — phải gỡ thửa-vụ ra trước, một cách có chủ ý.

`project_role` là **trục thứ hai**, không thay thế `user_role` sẵn có.
`user_role` trả lời "người này là ai trong nền tảng" (`coop_manager`, `coop_staff`,
`platform_admin`); `project_role` trả lời "người này làm gì trong dự án này". Một cán
bộ hợp tác xã có thể đồng thời là `htx_manager` của một dự án. Dự án con 2 sẽ hợp
nhất hai trục nếu thấy cần; đợt này giữ tách để không đụng vào enum đang chạy.

`organizations.kind` có sẵn giá trị `'vvb'` dù VVB Portal thuộc dự án con 5 — một giá
trị enum không tốn gì và tránh một migration sau này.

`project_status` theo §7 của spec: `draft`, `setup`, `enrollment`, `monitoring`,
`qa_qc`, `mrv_preparation`, `internal_review`, `vvb_verification`, `verified`, cùng
ba trạng thái ngoại lệ `on_hold`, `cancelled`, `rejected`.

Hợp tác xã, nông hộ, thửa ruộng **giữ nguyên vị trí và cấu trúc**. Không bảng nào
đang có dữ liệu bị đổi khoá phân vùng.

### Trigger chặn chuyển dự án sau khi khoá

Thuộc dự án con 4 về mặt chức năng, nhưng phải có ngay: cấm đổi
`field_seasons.monitoring_period_id` khi thửa-vụ đó đã bị khoá (`is_locked`). Thiếu
nó thì toàn bộ cấu trúc chống double-counting vẫn hở — chuyển thửa-vụ sang dự án
khác sau khi số liệu đã phát hành là đúng kiểu gian lận cần chặn.

## RLS

Vì hợp tác xã vẫn là thực thể độc lập, mọi bảng dữ liệu đồng ruộng vẫn khoá theo
`cooperative_id`. Policy hiện có **không phải viết lại**, chỉ nới thêm một vế:

```sql
create function app_project_coop_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct pc.cooperative_id), '{}')
  from public.project_members pm
  join public.project_cooperatives pc on pc.project_id = pm.project_id
  where pm.user_id = auth.uid()
$$;
```

```sql
-- từ
using (cooperative_id = app_coop_id())
-- thành
using (cooperative_id = app_coop_id()
       or cooperative_id = any(app_project_coop_ids()))
```

Cán bộ hợp tác xã vẫn chỉ thấy hợp tác xã mình. Người thuộc dự án thấy mọi hợp tác
xã trong dự án đó. Thay đổi mang tính mở rộng và cơ học — rủi ro thấp hơn nhiều so
với đổi khoá phân vùng, nhưng vẫn phải kiểm thử từng bảng vì bỏ sót một policy là rò
dữ liệu.

Năm bảng mới viết policy riêng: đọc theo thành viên dự án (`project_members`), ghi
theo vai trò `project_developer`, và `platform_admin` giữ toàn quyền như hiện tại.

## Gỡ chợ tín chỉ

Spec §34 đặt Carbon Exchange, Marketplace, Trading và Payment Settlement ngoài phạm
vi, và §38 định vị ngược với sản phẩm marketplace. Phần bán hàng bị gỡ.

**Gỡ được ngay:** `orders`, `payments`, `revenue_shares`; màn hình `/cho`,
`/cho/[id]`, `/don-hang`; RPC `place_order` và `settle_sandbox_payment`; vai trò
`buyer`; các ca e2e tương ứng.

**Phải sửa theo:** bốn công cụ của trợ lý ảo (`lo_dang_chao_ban`,
`don_hang_cua_toi`, `chia_doanh_thu`, `liet_ke_lo_tin_chi`), dữ liệu mẫu trong
`src/lib/chat/eval/fixture.ts`, và bộ ca eval đang dùng chúng.

**Cố ý GIỮ LẠI:** `credit_batches` và `batch_items`. Đây là cơ chế khoá dữ liệu duy
nhất đang có — `build_credit_batch` khoá thửa-vụ, trigger chặn sửa nhật ký sau khi
khoá, `unlock_field_season` mở ra và làm bản tính cũ hết hiệu lực. Gỡ bây giờ thì hệ
thống mất khả năng đóng băng số liệu, trái nguyên tắc "Never Destroy History" của
spec (§37). Việc khoá sẽ chuyển sang MRV version ở dự án con 4; đổi tên và thay thế
khi đó.

## Giao diện

```
/du-an                        danh sách dự án
/du-an/moi                    tạo dự án (FR-PROJ-001)
/du-an/[id]                   bảng điều khiển dự án
/du-an/[id]/htx               gắn hợp tác xã vào dự án
/du-an/[id]/ky-giam-sat       kỳ giám sát
/du-an/[id]/thanh-vien        thành viên dự án
```

Sửa: thanh điều hướng thêm mục dự án và bỏ mục chợ; màn hình thửa-vụ thêm ô chọn kỳ
giám sát; gỡ ba màn hình chợ.

Bảng điều khiển **chỉ hiện số đếm được thật**: số hợp tác xã, nông hộ, thửa ruộng,
diện tích, số thửa-vụ đã nhận vào kỳ giám sát, số đã tính MRV. Spec §31 vẽ thêm MRV
Readiness và Blockers, nhưng hai thứ đó cần QA/QC engine và MRV engine đứng sau. Với
một sản phẩm mà toàn bộ giá trị nằm ở tính kiểm chứng được, một ô "MRV Readiness
87%" chưa có gì đứng sau là thứ tệ nhất có thể đặt lên bảng điều khiển.

## Migration

Ba tệp tách rời để lùi được từng bước:

| Tệp | Nội dung |
|---|---|
| `0013_project_layer` | Năm bảng mới, `field_seasons.monitoring_period_id`, `app_project_coop_ids()`, nới policy hiện có, trigger chặn chuyển dự án khi đã khoá |
| `0014_seed_default_project` | Đưa dữ liệu đang có vào một tổ chức và một dự án mặc định, nối qua `project_cooperatives`; `monitoring_period_id` để `null` |
| `0015_drop_marketplace` | Gỡ `orders`, `payments`, `revenue_shares`, RPC bán hàng, vai trò `buyer` |

Dữ liệu hiện có trên project phát triển: 1 hợp tác xã, 19 nông hộ, 27 thửa ruộng, 10
mùa vụ, 27 thửa-vụ, 19 bản tính. Sau `0014` toàn bộ vẫn truy cập được như trước.

## Kiểm thử

Trọng tâm là e2e, vì đây là thay đổi RLS và rò dữ liệu giữa các dự án là rủi ro lớn
nhất của đợt này. Repo đã có khuôn chạy trên cơ sở dữ liệu thật bằng tài khoản
thường, qua đúng RLS.

Các ca bắt buộc:

1. Người thuộc dự án thấy hợp tác xã trong dự án mình, **không** thấy hợp tác xã
   ngoài dự án.
2. Cán bộ hợp tác xã vẫn chỉ thấy hợp tác xã mình, không thấy dự án nào.
3. Một thửa-vụ chỉ nhận được vào **một** kỳ giám sát.
4. Thửa-vụ đã khoá thì **không** đổi được kỳ giám sát.
5. Cùng một hợp tác xã tham gia hai dự án: mỗi thửa-vụ chỉ thuộc một bên, dữ liệu
   không nhân đôi.
6. Dữ liệu cũ sau `0014` vẫn truy cập được đúng như trước.

Kiểm thử đơn vị cho phần thuần: dựng trạng thái dự án, kiểm tra hợp lệ của biểu mẫu
tạo dự án, và các hàm gom số cho bảng điều khiển.

## Rủi ro đã biết

**Bỏ sót một policy khi nới.** Mỗi bảng dữ liệu đồng ruộng phải nới đúng một lần.
Bỏ sót thì người thuộc dự án không thấy dữ liệu (lỗi nhìn thấy được, đỡ nguy hiểm);
nới nhầm phạm vi thì rò dữ liệu (không nhìn thấy được). Ca kiểm thử 1 và 2 canh việc
này, nhưng phải viết cho từng bảng chứ không chỉ một bảng đại diện.

**`app_project_coop_ids()` gọi trên mọi truy vấn.** Hàm này chạy trong mọi policy đã
nới, nên nó nằm trên đường nóng. Cần index trên `project_members(user_id)` và
`project_cooperatives(project_id)`. Với quy mô mục tiêu của spec (100 dự án, 1 000
hợp tác xã) thì mảng trả về vẫn nhỏ, nhưng phải đo lại khi dữ liệu lớn lên.

**Trợ lý ảo hỏng nếu gỡ chợ mà quên sửa công cụ.** Bốn công cụ trỏ vào bảng đã xoá sẽ
ném lỗi ở tầng handler. Bộ kiểm thử `tests/chat.test.ts` có ca canh việc dữ liệu mẫu
phải phủ đúng bộ công cụ, nên sẽ đỏ nếu quên — nhưng chỉ khi công cụ bị gỡ khỏi
`TOOLS`, không phải khi handler hỏng.
