# Kiểm chứng PostgreSQL cục bộ — bước 2b

Ngày 06/09/2026. Phạm vi: PostgreSQL trong Docker cục bộ, shim auth/storage, migration 0001–0014. **Không kết nối Supabase thật, không đọc `.env.local` hoặc credential Supabase, không chạy `npm run test:e2e`.**

## Kết luận và mức độ bằng chứng

- **Áp migration: ĐẠT 14/14** trên container sạch `cr-pgtest-fixed`, theo thứ tự và dừng khi lỗi.
- **SQL: ĐẠT 78/78 ca đã chạy** (bao gồm setup/fixture, kiểm hậu điều kiện, và 9/9 ca C18). Đây không phải 78 ca end-to-end của ứng dụng.
- **C13-HTTP: CHƯA CHẠY ĐƯỢC**, không nằm trong 78 ca đạt. Kế hoạch có 78 ca SQL đã chạy và một hạng mục Storage API chưa kiểm được.
- Tìm và sửa **2 lỗi SQL thật**: policy storage bind nhầm tên và validator cho qua AST `op=null`. C8 đã thống nhất runner sở hữu transaction; C21 đã kiểm và bổ sung tài liệu. C5 **không triển khai**, vẫn thuộc Module A.

Bằng chứng máy đọc: [results.json](../../tests/db/runs/fixed/results.json). Mỗi ca có SQL và log nguyên văn trong [tests/db/runs/fixed](../../tests/db/runs/fixed); danh mục kết quả bên dưới dẫn tới từng log. Hash cả 14 migration tại thời điểm chạy được lưu trong results.json và đã đối chiếu lại với file nguồn sau kiểm thử.

## Môi trường thực tế

| Thành phần | Đã dùng / khác đích |
|---|---|
| Docker daemon | 29.6.2; ban đầu sandbox chặn docker.sock, đã xin và nhận quyền truy cập Docker cục bộ. |
| Image | `postgis/postgis:17-3.4`, ép `linux/amd64`; digest `postgis/postgis@sha256:d0b5a6ecab18997637f55a83cb4a9467391de5645916cfa1b6f2a8d19eee7be5`. |
| PostgreSQL thực tế | **17.0**, Debian 17.0-1.pgdg110+1, x86_64. **Khác patch version đích 17.6**; không tuyên bố kiểm đúng 17.6. |
| PostGIS thực tế | **3.4.3**, schema **public**. Đích audit ghi **3.3.7/public**; namespace khớp, extension version lệch. |
| Extension kèm ảnh | fuzzystrmatch 1.2/public, postgis_tiger_geocoder 3.4.3/tiger, postgis_topology 3.4.3/topology, plpgsql 1.0/pg_catalog. Không giả định bộ extension khớp production. |
| Cách ly | `--network none`, không publish port (`PortBindings={}`), không mount repo/secret. Mọi SQL qua `docker exec … psql`, kết nối Unix socket bên trong container. |
| Dữ liệu | `--tmpfs /var/lib/postgresql/data:rw`; inspect trả `Mounts=[]`, **không tạo named/anonymous Docker volume**. Auth trust chỉ trong container cô lập, không dùng mật khẩu/credential thật. |
| Container đã tạo | `cr-pgtest-initial`, `cr-pgtest-baseline`, `cr-pgtest-fixed`; đều có label `cr-pgtest=true`. Các run diagnosis chỉ đọc container sẵn có, không tạo container khác. |

Version/namespace và cấu hình Docker được ghi tại [extensions.log](../../tests/db/runs/final-inspection/extensions.log), [isolation.log](../../tests/db/runs/final-inspection/isolation.log); chuỗi `version()`/`postgis_full_version()` nằm trong results.json. Chưa kiểm patch 17.6/PostGIS 3.3.7 thật, query plan/load hoặc tương thích mọi extension đích.

## Shim giả lập gì — và không giả lập gì

[tests/db/shim.sql](../../tests/db/shim.sql) là file riêng, **không nằm trong migrations sản phẩm**:

- Schema auth; bảng auth.users tối giản chỉ id/email/raw_user_meta_data. Các trigger 0001/0012 thật sinh profiles từ user giả.
- Role anon/authenticated/service_role; service_role có BYPASSRLS nhưng vẫn chịu GRANT quyền bảng/hàm. SQL case chạy `SET LOCAL ROLE authenticated` và đặt GUC `request.jwt.claim.sub`; không chạy toàn bộ suite bằng superuser rồi gọi đó là test RLS.
- `auth.uid()` đọc GUC; grants schema và default table/sequence grants mô phỏng điều kiện Supabase mà migration dựa vào. Migration 0013 tự REVOKE/GRANT lại như sản phẩm.
- Schema storage; buckets/objects tối giản và `storage.foldername`. objects có RLS và UNIQUE bucket/name. Có đủ cột để tạo policy và thử INSERT/UPDATE/upsert/DELETE SQL.

**Không có** JWT signature/session validation, GoTrue/Auth Admin API, PostgREST, Storage HTTP server, S3/local object bytes, TUS/resumable hooks, metadata/version lifecycle, MIME/size enforcement của Storage API, signed URL hoặc SDK `supabase-js`. GUC do test đặt không chứng minh hệ thống auth thật không bị giả mạo. Metadata file/checksum trong ca SQL là fixture, không chứng minh tệp tồn tại.

Để kiểm riêng restrictive UPDATE, ca C13RF thêm **policy permissive probe chỉ trong DB test** vào storage.objects rồi thử UPDATE dưới authenticated: vẫn 0 row. Policy probe không nằm trong migration sản phẩm. Không dùng kết quả probe để suy diễn Storage server thực dùng role hay chuỗi SQL nào.

## Các lần chạy và lỗi thực tế

| Lần | Kết quả thực tế |
|---|---|
| `initial` | Dừng ngay migration 0001 dòng 3; 0 ca chức năng chạy. Runner bắt nhầm PostgreSQL tạm khi image đang cài PostGIS. Đây là lỗi readiness của harness, không vá migration cũ. |
| `baseline` | Sau sửa readiness, 14/14 migration bản gốc áp được; harness báo 68/70, lỗi C13I (INSERT object) và C13V (viewer thấy 0 thay vì 1 do INSERT trước thất bại). Những ca UPDATE/upsert phụ thuộc object lúc này **chưa chứng minh thao tác trên object tồn tại**; không dùng chúng làm bằng chứng C13 đạt. |
| `diagnosis`, `diagnosis-null` | Đọc binding policy đã được PostgreSQL resolve: `foldername(p.name)` và `foldername(m.name)`. Probe AST null đáng lẽ lỗi nhưng trả thành công: xác nhận lỗi thứ hai. Không áp lại migration trong các run chẩn đoán. |
| `fixed` | Container mới hoàn toàn; áp lại 0001–0014 với `psql -1`; **78/78** ca SQL đạt. C13I/C13TI là prerequisite, không cho ca phụ thuộc tiếp tục nếu object chưa tạo thành công. |
| `final-inspection` | Đọc lại binding đã là `foldername(objects.name)`, extension namespace/isolation; lặp probe AST null và thấy P0001. Probe lặp không cộng thêm vào tổng 78. |

Lỗi đầu tiên nguyên văn ([initial log](../../tests/db/runs/initial/0001_core_schema.sql.log), `<stdin>:3` tương ứng `supabase/migrations/0001_core_schema.sql:3`):

```text
ERROR: 23505: duplicate key value violates unique constraint "pg_extension_name_index"
DETAIL: Key (extname)=(postgis) already exists.
```

Image có PostgreSQL tạm để init extension rồi restart. `pg_isready` đơn lẻ thấy server tạm sẵn sàng nên runner đua `CREATE EXTENSION IF NOT EXISTS` với init script. Sửa runner đợi log `PostgreSQL init process complete; ready for start up.` **và** pg_isready của server sau init. Dựng container baseline mới, không tiếp tục trên DB initial. Không sửa 0001–0012; byte file cũ đã được đối chiếu với snapshot lần baseline.

Lỗi nghiệp vụ đầu tiên ([C13I baseline](../../tests/db/runs/baseline/C13I.log), `<stdin>:5` là statement INSERT trong file case, **không phải dòng migration bị lỗi compile**):

```text
ERROR: 42501: new row violates row-level security policy for table "objects"
```

Migration áp thành công không chứng minh function/policy đúng khi gọi. Không có lỗi compile ở 0013/0014 trong baseline; các lỗi tìm được nằm ở hành vi thực thi.

## Kết quả áp từng migration trên container sạch sau sửa

| File | Kết quả thật |
|---|---|
| `0001_core_schema.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0001_core_schema.sql.log) |
| `0002_mrv_and_market.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0002_mrv_and_market.sql.log) |
| `0003_rls.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0003_rls.sql.log) |
| `0004_functions_storage_factors.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0004_functions_storage_factors.sql.log) |
| `0005_business_rpc.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0005_business_rpc.sql.log) |
| `0006_fields_api.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0006_fields_api.sql.log) |
| `0007_harden.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0007_harden.sql.log) |
| `0008_vietnam_regional_factors.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0008_vietnam_regional_factors.sql.log) |
| `0009_coop_two_tier.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0009_coop_two_tier.sql.log) |
| `0010_chat.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0010_chat.sql.log) |
| `0011_chat_settings.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0011_chat_settings.sql.log) |
| `0012_signup_role_guard.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0012_signup_role_guard.sql.log) |
| `0013_project_platform.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0013_project_platform.sql.log) |
| `0014_project_platform_samples.sql` | ĐẠT — psql exit 0; [log](../../tests/db/runs/fixed/0014_project_platform_samples.sql.log) |

## Kết quả từng ca SQL đã chạy

Kỳ vọng có SQLSTATE nghĩa là **tấn công/lệnh không hợp lệ phải bị từ chối**, nên nhận đúng lỗi là ĐẠT. UPDATE bị RLS lọc trả 0 row cũng phải kiểm đúng 0; không gộp “query không lỗi” thành thành công ghi. C18.5 có một ca dùng DB owner để thử **FK thật phía sau grant**, cùng ca authenticated riêng xác nhận không có DML trực tiếp. MRV happy path tạo **preview với kết quả fixture do test truyền**, không thực thi evaluator hay xuất PDF/Word.

| Mã | Mô tả | Kỳ vọng | Kết quả thực tế | Đánh giá / bằng chứng |
|---|---|---|---|---|
| F01 | Tạo 8 user giả, trigger signup sinh profile | 8 | 8 | ĐẠT — [log](../../tests/db/runs/fixed/F01.log) |
| H01 | Tạo project A bằng RPC | SQL thành công | 4170faf0-c91c-4bfe-9ee9-45b2e5d735c9 | ĐẠT — [log](../../tests/db/runs/fixed/H01.log) |
| H02 | Tạo project B độc lập | SQL thành công | 5623a2a1-ee58-4f1f-b24e-db078bdbd5a8 | ĐẠT — [log](../../tests/db/runs/fixed/H02.log) |
| H03 | Project có đúng owner và 7 stage đúng tên/thứ tự | t | t | ĐẠT — [log](../../tests/db/runs/fixed/H03.log) |
| F02 | Lấy stage A bằng phiên owner A | SQL thành công | 54b6419e-eaa9-4c8e-86c6-c6f0d5435b1d | ĐẠT — [log](../../tests/db/runs/fixed/F02.log) |
| F03 | Lấy stage B bằng phiên owner B | SQL thành công | a9ffb3fe-688f-477c-acfa-c03755f1be50 | ĐẠT — [log](../../tests/db/runs/fixed/F03.log) |
| H04 | Owner thêm developer/viewer, đọc membership không đệ quy | 3 | 3 | ĐẠT — [log](../../tests/db/runs/fixed/H04.log) |
| F04 | Thêm developer riêng B | 2 | 2 | ĐẠT — [log](../../tests/db/runs/fixed/F04.log) |
| H05 | Tạo task, gán developer cùng project, đổi status | in_progress | in_progress | ĐẠT — [log](../../tests/db/runs/fixed/H05.log) |
| A01 | C18.1 Task A trỏ stage B | SQLSTATE 23503 / project_tasks_stage_id_project_id_fkey | 23503: insert or update on table "project_tasks" violates foreign key constraint "project_tasks_stage_id_project_id_fkey" | ĐẠT — [log](../../tests/db/runs/fixed/A01.log) |
| A02 | C18.2 Assignee không là thành viên | SQLSTATE 23503 / project_tasks_project_id_assignee_id_assignee_role_fkey | 23503: insert or update on table "project_tasks" violates foreign key constraint "project_tasks_project_id_assignee_id_assignee_role_fkey" | ĐẠT — [log](../../tests/db/runs/fixed/A02.log) |
| A03 | C18.3 Assignee là viewer | SQLSTATE 23503 / project_tasks_project_id_assignee_id_assignee_role_fkey | 23503: insert or update on table "project_tasks" violates foreign key constraint "project_tasks_project_id_assignee_id_assignee_role_fkey" | ĐẠT — [log](../../tests/db/runs/fixed/A03.log) |
| A04 | C18.4 Assignee developer của B | SQLSTATE 23503 / project_tasks_project_id_assignee_id_assignee_role_fkey | 23503: insert or update on table "project_tasks" violates foreign key constraint "project_tasks_project_id_assignee_id_assignee_role_fkey" | ĐẠT — [log](../../tests/db/runs/fixed/A04.log) |
| A08 | C18.8 Đổi project_id của task A sang B | SQLSTATE 42501 / permission denied | 42501: permission denied for table project_tasks | ĐẠT — [log](../../tests/db/runs/fixed/A08.log) |
| A08P | Sau tấn công task vẫn thuộc A | t | t | ĐẠT — [log](../../tests/db/runs/fixed/A08P.log) |
| A09 | C18.9 Outsider tự INSERT membership owner | SQLSTATE 42501 / project_members | 42501: permission denied for table project_members | ĐẠT — [log](../../tests/db/runs/fixed/A09.log) |
| R01 | Outsider SELECT projects/members/tasks rỗng, không đệ quy | 0 | 0 | ĐẠT — [log](../../tests/db/runs/fixed/R01.log) |
| R02 | Outsider INSERT task bị RLS chặn | SQLSTATE 42501 / row-level security | 42501: new row violates row-level security policy for table "project_tasks" | ĐẠT — [log](../../tests/db/runs/fixed/R02.log) |
| R03 | Outsider gọi RPC member không được | SQLSTATE P0001 / Chỉ owner | P0001: Chỉ owner được quản lý thành viên | ĐẠT — [log](../../tests/db/runs/fixed/R03.log) |
| R04 | Viewer đọc membership được, không đệ quy | 3 | 3 | ĐẠT — [log](../../tests/db/runs/fixed/R04.log) |
| R05 | Viewer INSERT task bị chặn | SQLSTATE 42501 / row-level security | 42501: new row violates row-level security policy for table "project_tasks" | ĐẠT — [log](../../tests/db/runs/fixed/R05.log) |
| R06 | Viewer UPDATE task không sửa row nào | 0 | 0 | ĐẠT — [log](../../tests/db/runs/fixed/R06.log) |
| R07 | Developer DELETE project bị chặn quyền bảng | SQLSTATE 42501 / permission denied | 42501: permission denied for table projects | ĐẠT — [log](../../tests/db/runs/fixed/R07.log) |
| R08 | Developer xoá mềm project không sửa được row | 0 | 0 | ĐẠT — [log](../../tests/db/runs/fixed/R08.log) |
| R09 | Anon không có quyền đọc projects | SQLSTATE 42501 / permission denied | 42501: permission denied for table projects | ĐẠT — [log](../../tests/db/runs/fixed/R09.log) |
| O01 | Không demote owner cuối cùng | SQLSTATE P0001 / owner cuối cùng | P0001: Không được mất owner cuối cùng | ĐẠT — [log](../../tests/db/runs/fixed/O01.log) |
| O02 | Không xóa owner cuối cùng | SQLSTATE P0001 / owner cuối cùng | P0001: Không được mất owner cuối cùng | ĐẠT — [log](../../tests/db/runs/fixed/O02.log) |
| O03 | Không đổi developer còn được giao task sang viewer | SQLSTATE 23503 / project_tasks_project_id_assignee_id_assignee_role_fkey | 23503: update or delete on table "project_members" violates foreign key constraint "project_tasks_project_id_assignee_id_assignee_role_fkey" on table "project_tasks" | ĐẠT — [log](../../tests/db/runs/fixed/O03.log) |
| S01 | Không thêm stage tuỳ ý | SQLSTATE 42501 / permission denied | 42501: permission denied for table project_stages | ĐẠT — [log](../../tests/db/runs/fixed/S01.log) |
| S02 | Không xoá stage | SQLSTATE 42501 / permission denied | 42501: permission denied for table project_stages | ĐẠT — [log](../../tests/db/runs/fixed/S02.log) |
| F05 | Đăng ký metadata file A bằng owner A | SQL thành công | exit 0, không có row trả về | ĐẠT — [log](../../tests/db/runs/fixed/F05.log) |
| F06 | Đăng ký metadata file B bằng owner B | SQL thành công | exit 0, không có row trả về | ĐẠT — [log](../../tests/db/runs/fixed/F06.log) |
| A07 | C18.7 Đính file B vào task A | SQLSTATE 23503 / task_attachments_file_id_project_id_fkey | 23503: insert or update on table "task_attachments" violates foreign key constraint "task_attachments_file_id_project_id_fkey" | ĐẠT — [log](../../tests/db/runs/fixed/A07.log) |
| C13I | C13 SQL shim: authenticated INSERT storage.objects | 1 | 1 | ĐẠT — [log](../../tests/db/runs/fixed/C13I.log) |
| C13U | C13 SQL shim: metadata UPDATE trả 0 row | 0 | 0 | ĐẠT — [log](../../tests/db/runs/fixed/C13U.log) |
| C13UPS | C13 SQL shim: upsert trên path có sẵn bị chặn | SQLSTATE 42501 / row-level security | 42501: new row violates row-level security policy (USING expression) for table "objects" | ĐẠT — [log](../../tests/db/runs/fixed/C13UPS.log) |
| C13V | Viewer đọc object được nhưng không upload | 1 | 1 | ĐẠT — [log](../../tests/db/runs/fixed/C13V.log) |
| C13VW | Viewer upload SQL shim bị chặn | SQLSTATE 42501 / row-level security | 42501: new row violates row-level security policy for table "objects" | ĐẠT — [log](../../tests/db/runs/fixed/C13VW.log) |
| C13O | Outsider không đọc object project A | 0 | 0 | ĐẠT — [log](../../tests/db/runs/fixed/C13O.log) |
| FADMIN | Thiết lập global admin giả chỉ trên DB local | SQL thành công | exit 0, không có row trả về | ĐẠT — [log](../../tests/db/runs/fixed/FADMIN.log) |
| C13TI | C13 SQL shim: admin INSERT template object đúng path | 1 | 1 | ĐẠT — [log](../../tests/db/runs/fixed/C13TI.log) |
| C13RF | Kiểm restrictive UPDATE ngay cả khi có permissive UPDATE shim | 0 | 0 | ĐẠT — [log](../../tests/db/runs/fixed/C13RF.log) |
| FCOOP | Tạo HTX local để kiểm evidence không bị ảnh hưởng | SQL thành công | 49997bf8-3e57-4f1b-afb7-b5833d76227d | ĐẠT — [log](../../tests/db/runs/fixed/FCOOP.log) |
| C13E | Evidence vẫn INSERT và DELETE được qua policy legacy | 1 | 1 | ĐẠT — [log](../../tests/db/runs/fixed/C13E.log) |
| H06 | Owner chọn/khóa Standard+Methodology, nhập baseline | 1 | 1 | ĐẠT — [log](../../tests/db/runs/fixed/H06.log) |
| H07 | Tạo kỳ với snapshot schema/baseline/hệ số | SQL thành công | 42f8262b-49fd-4bc5-bfdf-7f049be64ec6 | ĐẠT — [log](../../tests/db/runs/fixed/H07.log) |
| H08 | Developer ghi observation qua RPC | 1 | 1 | ĐẠT — [log](../../tests/db/runs/fixed/H08.log) |
| A05 | C18.5 FK monitoring_data sai project, kiểm dưới DB owner để đi qua lớp grant | SQLSTATE 23503 / monitoring_data_period_id_project_id_fkey | 23503: insert or update on table "monitoring_data" violates foreign key constraint "monitoring_data_period_id_project_id_fkey" | ĐẠT — [log](../../tests/db/runs/fixed/A05.log) |
| A05AUTH | C18.5 authenticated không được INSERT monitoring_data trực tiếp | SQLSTATE 42501 / permission denied | 42501: permission denied for table monitoring_data | ĐẠT — [log](../../tests/db/runs/fixed/A05AUTH.log) |
| M01 | Sai expected_revision không ghi được | SQLSTATE P0001 / revision | P0001: Kỳ khóa hoặc revision đã thay đổi | ĐẠT — [log](../../tests/db/runs/fixed/M01.log) |
| M02 | Batch có row sai bounds rollback toàn bộ | SQLSTATE P0001 / ngoài phạm vi | P0001: Giá trị ngoài phạm vi/precision: area_ha | ĐẠT — [log](../../tests/db/runs/fixed/M02.log) |
| M03 | Sau lỗi batch còn đúng 1 observation và revision=1 | t | t | ĐẠT — [log](../../tests/db/runs/fixed/M03.log) |
| M04 | Viewer không gọi được RPC ghi monitoring | SQLSTATE P0001 / Không có quyền | P0001: Không có quyền nhập monitoring | ĐẠT — [log](../../tests/db/runs/fixed/M04.log) |
| M05 | Import file cùng project thành công nguyên tử | 2 | 2 | ĐẠT — [log](../../tests/db/runs/fixed/M05.log) |
| M06 | Retry import không tăng revision | true | true | ĐẠT — [log](../../tests/db/runs/fixed/M06.log) |
| H09 | Owner khóa kỳ và snapshot dữ liệu | locked:2 | locked:2 | ĐẠT — [log](../../tests/db/runs/fixed/H09.log) |
| L01 | Kỳ đã khóa không ghi qua RPC | SQLSTATE P0001 / Kỳ khóa | P0001: Kỳ khóa hoặc revision đã thay đổi | ĐẠT — [log](../../tests/db/runs/fixed/L01.log) |
| L02 | Kỳ khóa chặn UPDATE dữ liệu kể cả DB owner | SQLSTATE P0001 / Kỳ không mở | P0001: Kỳ không mở | ĐẠT — [log](../../tests/db/runs/fixed/L02.log) |
| L03 | Kỳ khóa chặn xóa observation qua RPC | SQLSTATE P0001 / Kỳ khóa | P0001: Kỳ khóa hoặc revision đã thay đổi | ĐẠT — [log](../../tests/db/runs/fixed/L03.log) |
| F07 | Lấy template placeholder đúng methodology | SQL thành công | b09d597c-d01d-4eab-a891-2c6019da6a3f | ĐẠT — [log](../../tests/db/runs/fixed/F07.log) |
| F08 | Lấy template khác Standard/methodology | SQL thành công | e4f211a1-8342-4880-9df3-18900819ea8d | ĐẠT — [log](../../tests/db/runs/fixed/F08.log) |
| H10 | Backend service_role sinh MRV preview từ kỳ khóa | SQL thành công | f8382439-ffd6-4d58-b300-47075a9e38d1 | ĐẠT — [log](../../tests/db/runs/fixed/H10.log) |
| H11 | Report giữ nguyên snapshot/hash/revision của kỳ | t | t | ĐẠT — [log](../../tests/db/runs/fixed/H11.log) |
| A06 | C18.6 RPC từ chối template khác methodology/Standard | SQLSTATE P0001 / Template khác | P0001: Template khác methodology/standard của kỳ | ĐẠT — [log](../../tests/db/runs/fixed/A06.log) |
| M07 | Authenticated không được gọi RPC kết quả report | SQLSTATE 42501 / permission denied | 42501: permission denied for function create_mrv_report | ĐẠT — [log](../../tests/db/runs/fixed/M07.log) |
| M08 | Sample + placeholder không được tạo final | SQLSTATE P0001 / Final cần | P0001: Final cần methodology đã thẩm định, template thật và tệp xuất; dữ liệu MẪU chỉ preview | ĐẠT — [log](../../tests/db/runs/fixed/M08.log) |
| M09 | Report bất biến cả với DB owner | SQLSTATE P0001 / bất biến | P0001: Bản ghi mrv_reports bất biến; thêm bản/version mới | ĐẠT — [log](../../tests/db/runs/fixed/M09.log) |
| M10 | Methodology published bất biến | SQLSTATE P0001 / published bất biến | P0001: Methodology published bất biến | ĐẠT — [log](../../tests/db/runs/fixed/M10.log) |
| M11 | Factors published bất biến | SQLSTATE P0001 / draft | P0001: Chỉ sửa factors của methodology draft | ĐẠT — [log](../../tests/db/runs/fixed/M11.log) |
| ASTNULL | AST op=null phải bị từ chối | SQLSTATE P0001 / Toán tử AST | P0001: Toán tử AST không hợp lệ | ĐẠT — [log](../../tests/db/runs/fixed/ASTNULL.log) |
| ASTCODE | AST chứa mã lạ phải bị từ chối | SQLSTATE P0001 / Toán tử AST | P0001: Toán tử AST không hợp lệ | ĐẠT — [log](../../tests/db/runs/fixed/ASTCODE.log) |
| ASTCYCLE | AST tham chiếu calculation chưa có phải bị từ chối | SQLSTATE P0001 / đứng trước | P0001: Calc phải tham chiếu calc đứng trước | ĐẠT — [log](../../tests/db/runs/fixed/ASTCYCLE.log) |
| M12 | Đổi baseline project không làm đổi baseline report cũ | 10 | 10 | ĐẠT — [log](../../tests/db/runs/fixed/M12.log) |
| C21 | Xóa auth.users bị RESTRICT và rollback toàn bộ | SQLSTATE 23503 / profiles | 23503: update or delete on table "profiles" violates foreign key constraint "projects_created_by_fkey" on table "projects" | ĐẠT — [log](../../tests/db/runs/fixed/C21.log) |
| C21P | User và profile vẫn còn sau lệnh DELETE lỗi | t | t | ĐẠT — [log](../../tests/db/runs/fixed/C21P.log) |
| O04 | Thêm owner thứ hai để thử race | 2 | 2 | ĐẠT — [log](../../tests/db/runs/fixed/O04.log) |
| O05 | Hai owner đồng thời tự demote: đúng một thành công, một bị chặn | first success; second SQLSTATE P0001 owner cuối cùng | Phiên 1 commit; phiên 2 P0001 “Không được mất owner cuối cùng” | ĐẠT — [phiên 1](../../tests/db/runs/fixed/O05-first.log), [phiên 2](../../tests/db/runs/fixed/O05-second.log) |
| O06 | Sau race còn đúng 1 owner | 1 | 1 | ĐẠT — [log](../../tests/db/runs/fixed/O06.log) |

Ca O05 sử dụng hai tiến trình psql/connection thật: transaction thứ nhất demote rồi giữ khóa thêm 2 giây; phiên thứ hai bắt đầu sau 0,5 giây. Kết quả một commit/một P0001 và hậu điều kiện một owner. Chưa đo wait_event hoặc phủ mọi lịch xen kẽ/isolation level; không tuyên bố đã chứng minh mọi race. SQL thử tuần tự nằm trong các file case; đoạn hai kết nối nằm cuối `tests/db/cases.py`.

## Lỗi đã sửa và ý nghĩa diff

Diff đầy đủ bản baseline so với file đã kiểm: [migration-changes.diff](../../tests/db/runs/fixed/migration-changes.diff).

1. **Binding policy storage sai — lỗi thật ảnh hưởng INSERT hợp lệ.** Trong EXISTS của project_documents_objects_insert, `name` bị resolve thành `projects p.name`; trong methodology_templates_objects_insert thành `methodologies m.name`. `pg_get_expr` xác nhận thực tế, không chỉ đọc mã. Đã dùng `objects.name` tường minh cho các tham chiếu path trong policy mới (`0013:956`, `0013:958`, `0013:959`, `0013:963`, `0013:966`). Sau dựng sạch: C13I và C13TI insert được; viewer đọc object tồn tại được. [Binding trước](../../tests/db/runs/diagnosis/storage-bindings.log), [sau](../../tests/db/runs/final-inspection/storage-bindings.log).
2. **Whitelist AST bỏ lọt null — lỗi thật của validator.** Với `{"op":null,"args":[{"constant":1},{"constant":2}]}`, biểu thức `op NOT IN (...)` trả SQL NULL; IF không vào nhánh raise. Probe baseline trả thành công. Thay bằng `NOT COALESCE(op IN (...), false)` ở `0013:351`; sau dựng sạch ASTNULL trả P0001 đúng yêu cầu. ASTCODE và ASTCYCLE cũng chạy thật và bị từ chối. Không có JS/SQL evaluator nhúng được bổ sung.
3. **C8 — thống nhất transaction:** bỏ BEGIN/COMMIT khỏi 0013/0014, đồng nhất 0001–0012; runner duy nhất bọc từng file với `psql -X -1 -v ON_ERROR_STOP=1 -f`. Đây là chỉnh theo review, không khai là lỗi cú pháp đã xảy ra ở baseline (baseline dùng chế độ cũ tương ứng nên không có BEGIN lồng). Runner hiện không còn tùy chọn chạy migration không transaction. Chưa áp qua Supabase CLI hay kiểm ledger thật.
4. **Harness readiness:** sửa đợi image init hoàn tất, như lịch sử lỗi ở trên. Không thuộc migration sản phẩm. Harness cũng yêu cầu object INSERT thành công trước các probe phụ thuộc, tránh “UPDATE 0 row” trên bảng rỗng bị hiểu sai.

Mọi sửa SQL sản phẩm đều có trước run fixed; hash file hiện hành đã khớp file run fixed áp. Không sửa migration 0001–0012, auth/chat source, types hoặc C5 directory.

## C21: xóa tài khoản — kết quả và quy trình thay thế

Ca C21 chạy DELETE auth.users của owner có project, dưới DB owner để không bị quyền API che kết quả. Lệnh lỗi **23503** tại FK `projects_created_by_fkey`; C21P xác nhận auth.users và profiles còn nguyên. Chuỗi thật: auth.users DELETE → profiles CASCADE → new project FK RESTRICT → **toàn bộ statement rollback**. Tính nguyên tử vẫn giữ; không phải xóa dở một phần rồi mới báo lỗi.

Giữ RESTRICT để giữ chứng cứ. Trước vận hành cần workflow riêng: vô hiệu đăng nhập và thu hồi phiên, chuyển owner/gỡ assignee nếu phù hợp, giữ UUID các dòng còn được tham chiếu và ẩn danh trường định danh/liên hệ qua backend được kiểm soát. Cần kiểm cả auth, nội dung chat, snapshot và file — chỉ sửa full_name/phone không làm sạch toàn bộ dữ liệu cá nhân. **Chưa triển khai/chưa thực hiện** workflow này, và chưa thử GoTrue DELETE API. Đã cập nhật điểm bất định C21 trong tài liệu thiết kế.

## Những việc CHƯA kiểm chứng được

| Hạng mục | Trạng thái thực tế / lý do / cách kiểm tiếp |
|---|---|
| **C13 upload HTTP thường, upsert, resumable/TUS** | **CHƯA CHẠY ĐƯỢC.** Chỉ có shim SQL, không có Storage server/SDK phiên thật/object bytes. INSERT SQL đã đạt; UPDATE authenticated bị restrictive policy chặn ngay cả khi thêm permissive probe. Không biết đường upload/metadata update của phiên bản Storage đích có dùng thao tác đó hay role khác. Giữ P1 C13 mở; không tự bỏ no_update dựa trên suy đoán. |
| PostgreSQL 17.6 + PostGIS 3.3.7 đúng đích | Chưa có ảnh đúng cặp đó trong lần chạy; đã dùng 17.0/3.4.3 và công khai độ lệch. Cần chạy lại cùng suite trên bản khớp đích trước khi coi là chứng nhận môi trường sản xuất. |
| GoTrue, JWT, PostgREST và Storage thật | Không nằm trong shim; GUC giả không kiểm token/session/role mapping thật. |
| Engine tính toán MRV, kết quả chuyên môn và PDF/DOCX | H10 chỉ lưu preview với results/trace fixture; không chạy evaluator. Sample chưa thẩm định, không có template file thật. Final bị chặn đúng chính sách, chưa có đường final hợp lệ được kiểm. |
| Mọi nhánh RPC/concurrency/load | Đã kiểm 78 ca cụ thể, gồm một race hai owner READ COMMITTED; chưa phủ REPEATABLE READ/SERIALIZABLE, mọi lịch xen kẽ, race writer/lock kỳ, nhiều triệu observation, timeout/giới hạn upload. |
| C5 danh tính/mời thành viên | **Chưa làm theo brief**, không thêm directory/invite RPC hoặc nới profiles_select. Module A vẫn cần giải quyết. |
| Auth/chat/landing qua HTTP/browser | Không chạy UI/build/e2e production. Các migration cũ dựng được không đồng nghĩa mọi route/chat handler đã được kiểm end-to-end. |

Đề xuất kiểm C13 tiếp theo: dựng stack Supabase **hoàn toàn cục bộ/cô lập** có Storage service, S3-compatible backend và phiên bản cấu hình rõ ràng; dùng user/JWT test thật gọi `supabase-js upload(..., {upsert:false})`, download, metadata update, upsert cùng path và TUS nếu sản phẩm dùng; thử owner/developer/viewer/outsider, đồng thời hồi quy bucket evidence. Ghi lại HTTP status/error và SQL/role thực thi. Chỉ khi có bằng chứng upload hợp lệ bị no_update chặn mới thiết kế thay policy hoặc luồng upload; metadata UNIQUE tự nó không ngăn việc bytes object bị ghi đè nên không coi là giải pháp bất biến đầy đủ.

## Chạy lại và dọn môi trường

Điều kiện: Docker daemon hoạt động, Python 3. Script không cần psql cài trên máy, không dùng dotenv/DSN/key. Mỗi `run-id` phải mới; runner không tái sử dụng/xóa DB đang tồn tại và giữ log cả khi fail.

```sh
docker pull --platform linux/amd64 postgis/postgis@sha256:d0b5a6ecab18997637f55a83cb4a9467391de5645916cfa1b6f2a8d19eee7be5
python3 -B tests/db/run.py --run-id repro-01 --image postgis/postgis@sha256:d0b5a6ecab18997637f55a83cb4a9467391de5645916cfa1b6f2a8d19eee7be5
```

Runner áp shim riêng, rồi từng file 0001–0014 đúng thứ tự bằng psql `-X -1 -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f -`; file SQL nguyên bản và output có số dòng được lưu dưới `tests/db/runs/repro-01`. SQLSTATE phải đúng kỳ vọng; lệnh tấn công thất bại sai nguyên nhân không được đánh ĐẠT. Nếu prerequisite hỏng, runner dừng và ghi `fatal_error`/`not_run`, không bịa kết quả các ca sau.

Đã để lại ba container đã nêu để kiểm tra tiếp; chỉ dữ liệu giả cục bộ. Có thể dọn bằng đúng danh sách này sau khi xem log:

```sh
docker rm -f cr-pgtest-initial cr-pgtest-baseline cr-pgtest-fixed
# Nếu chạy thêm lần repro-01:
docker rm -f cr-pgtest-repro-01
```

**Không có Docker volume nào được tạo**, nên không có volume phải xóa. Tmpfs mất khi container dừng/xóa; log/SQL/JSON dưới tests/db vẫn giữ để review. Không dùng volume prune hoặc xóa container khác. Không có lệnh áp Supabase thật trong quy trình này.
