# Module B — lõi TypeScript

## Trạng thái và phạm vi

Đã tạo kiểu cho 16 bảng, meta-schema, AST compiler/evaluator, bộ sinh mô tả form, CSV/import adapter và MRV estimate. Chỉ viết trong danh sách cho phép của brief. `src/types/project-platform.ts` được ghi đầu tiên để worker-claude import. Không sửa database.ts, auth/middleware/navigation, migration 0015, chat hoặc bốn file MRV cũ. Không cài package, không đọc credential/.env.local, không kết nối Supabase hoặc chạy e2e. Không áp SQL, kể cả Docker, trong nhiệm vụ này.

Các test đọc trực tiếp bốn envelope `$metric$` và hệ số mẫu từ migration 0014; không chép lại công thức để thay thế seed. Đây vẫn là methodology **MẪU chưa thẩm định**, không có tín chỉ đã phát hành.

## API công khai

| File | API | Hợp đồng |
| --- | --- | --- |
| `src/types/project-platform.ts` | `ProjectPlatformTables`, `Row<T>`, `Insert<T>`, `Update<T>`; `Project`, `ProjectMember`, `ProjectRole`, `ProjectMemberRole`, `TaskStatus`, `MonitoringPeriod`, `MonitoringData`, `MrvReport`/`MRVReport`, các tên bảng PascalCase còn lại | 16 bảng 0013. Cột mặc định/nullable là optional khi Insert; schema_hash/mapping_hash generated bị loại khỏi ghi. Đây là kiểu hình dạng SQL, **không phải quyền ghi**. Các bảng snapshot vẫn cần RPC. numeric/bigint dùng number theo JSON thông thường; ứng dụng phải tránh vượt safe integer, hệ số tính nên lấy chuỗi từ factors_snapshot. |
| `methodology/schema.ts` | `parseMetricSchema(unknown)`, `MetricSchema`, `MetricField`, `MetricValues`, `Expression` | Zod strict envelope v1, trả schema đã parse hoặc ném lỗi. Kiểm type, scope, ID duy nhất, nhãn đa ngôn ngữ, bounds, scale, enum code-label, conditions và runtime. Không âm thầm bỏ thuộc tính lạ. |
| cùng file | `validateValues(schema, values, scope)`, `validateField(field, value)`, `isISODate(text)` | Lỗi `{field,message}[]`; decimal là chuỗi ASCII không exponent, integer là safe integer, boolean thật, enum theo code; unknown field/sai scope/required/bounds/precision/ngày lịch không hợp lệ bị chặn. `validateField` không quyết định required; `validateValues` xử lý required/condition. |
| `methodology/expression.ts` | `compileMethodology(unknown)` | Parse schema rồi kiểm toàn đồ thị, tham chiếu numeric tồn tại, chu trình, đơn vị, arity/depth/node count; trả `{schema,order}`. Dùng API này khi duyệt methodology, không chỉ gọi meta-schema. |
| cùng file | `evaluateMethodology(schema, baseline, observations, factors)`, `FactorInput`, `Observation`, `Evaluation`, `ENGINE_VERSION`, `LIMITS` | `observations = [{record_key,values}]`; hệ số `{key,value,unit,scope,source}`. Trả results dạng chuỗi thập phân, đơn vị, aggregation và trace có nguồn hệ số, toán hạng, giá trị trung gian. Lỗi fail-closed, không trả report một phần. |
| `methodology/decimal.ts` | `Decimal.parse`, `add/sub/mul/div/pow/compare/fixed/toString` | Số học bigint thập phân có giới hạn; chi tiết bên dưới. Chủ yếu là primitive nội bộ, không thay cho validator trường. |
| `methodology/form.ts` | `buildMethodologyForm(schema, locale='vi', values={})` | Trả `{baseline,observation}` gồm id, label, control, unit, required/required_if, constraints, enum options, group/order, aliases/accepted_units; UI không cần switch project_type. |
| `monitoring/import.ts` | `parseCSV(text, delimiter=',')` | State machine CSV; trả header, rows có số dòng vật lý và lỗi cấu trúc, không thực thi nội dung ô. |
| cùng file | `previewCSV`, `previewTable`, `ImportOptions`, `ImportPreview`, `ParsedTable`, `Cell` | Map bằng id/alias hoặc mapping tường minh, chuyển đơn vị cho phép, validate bằng cùng schema, trả lỗi dòng/cột/field và records để preview. `valid=false` nghĩa không được commit bất cứ dòng nào. |
| cùng file | `prepareImportRecords(schema, table, options)` | Parse/validate lại từ bảng nguồn, không tin cờ valid đã sửa trên preview; trả `SaveMonitoringRecord[]` hoặc ném lỗi. **Payload RPC dùng `values`, preview/Row dùng `metric_values`**. Hàm không ghi DB. |
| cùng file | `SpreadsheetParser`, `previewExcel(schema, bytes, sheet, parser, options)` | Adapter XLSX tách rời; thiếu adapter ném `XLSX parser not installed`. Chưa có implementation đọc ZIP/XLSX, test chỉ dùng adapter giả. |
| cùng file | `canonicalNumber`, `excelDate`, `UNIT_CONVERSIONS` | Xử lý dấu thập phân/nghìn tường minh, Excel date-only 1900/1904 và danh sách conversion đóng. |
| `mrv/report.ts` | `estimateMrvReport(period, data, outputCalculation)` | Nhận MonitoringPeriod đã khóa + đúng MonitoringData của snapshot, chọn tường minh calculation có unit tCO2e và aggregation sum. Trả preview/`mrv_estimate`, estimated_credit, toàn bộ calculations, snapshot đầu vào/baseline/hệ số/schema, revisions, engine_version và calculation_trace. Không có template/PDF/Word, không tạo dòng mrv_reports. |

## Ngữ nghĩa AST, số học và đơn vị

Chỉ cho phép leaf `constant`, `field`, `baseline`, `factor`, `calculation`; node `op,args` với add/subtract/multiply/divide/min/max/pow. `op:null`, extra keys, JS/SQL nhúng và tên tham chiếu không nằm trong schema bị từ chối. Không eval/new Function. `pow` chỉ hỗ trợ exponent literal integer từ -32 đến 32; không hỗ trợ căn/lũy thừa phân số. `0^0=1` theo tích rỗng của implementation; methodology cần nghĩa khác phải bị chặn trước khi duyệt chuyên môn.

DAG được sort topo, lỗi chu trình kể cả self-reference. Mỗi observation tính toàn bộ calculations theo topo; `calculation` leaf đọc kết quả **chưa aggregate** của cùng observation. Sau đó sum/mean/min/max theo từng calculation. Sort record_key theo thứ tự chuỗi trước khi tính/aggregate, nên cùng snapshot có trace tái lập được bất kể thứ tự đầu vào. Không aggregate rồi nhân lần nữa. Trace có path node, phép toán, input strings, output, đơn vị, nguồn và scope hệ số; aggregation có danh sách giá trị đầu vào. `engine_version=project-mrv/1.0.0`, precision/rounding/output_scale ghi trong trace.

Bigint base-10, 28 chữ số có nghĩa và half-even sau mỗi phép cộng/trừ/nhân/chia; min/max chỉ so sánh. Phép nhiều toán hạng fold trái; pow nhân lặp theo thứ tự, exponent âm nghịch đảo sau tích. Không chuyển số liệu decimal sang IEEE-754 để tính. Đầu vào chuỗi giữ chính xác; AST constant/SQL factor dạng number đã qua JS nên không thể khôi phục precision bị mất trước lúc gọi engine. Ưu tiên factors_snapshot do SQL tạo `value::text`. Kết quả aggregate làm tròn output_scale (seed là 4); import không tự làm tròn dữ liệu quá scale.

Giới hạn: input decimal tối đa 100 ký tự; coefficient/scale trung gian tối đa 600; pow tối đa 32; AST depth 24 và 10.000 nodes; preflight object 20.000 values/depth 64 để chống object JS vòng lặp hoặc cây quá lớn trước Zod. Mỗi evaluation tối đa 10.000 observations, 10.000 candidate factors và 100.000 lượt thăm node/phép toán (kể cả phép nhân trong pow và aggregation). Báo lỗi thay cho Infinity/NaN hoặc chia 0. Một tập 10.000 rows với công thức phức tạp có thể vượt budget; không cam kết mọi file đạt row limit đều tính được trong một report.

Unit algebra phân biệt hoa/thường, cho tích/chia/lũy thừa nguyên của tên đơn vị. Add/subtract/min/max phải đồng nhất dimensions; constant là dimensionless. Không ngầm đổi ha thành m2 hoặc MWh thành kWh trong AST. Conversion số chỉ xảy ra ở import qua bảng đóng.

**Quy ước seed biogas cần chuyên gia xác nhận:** `m3_CH4` được chuẩn hóa thành chiều thể tích `m3` trong unit algebra (tỷ lệ 1), vì `methane_fraction` riêng biểu diễn thành phần methane. Không bỏ tCH4/tC/tCO2e thành cùng một loại khối lượng. Nhờ đó `m3 × fraction × tCH4/m3_CH4` ra tCH4; trace hiển thị đơn vị đã chuẩn hóa nhưng snapshots vẫn giữ tên gốc. Đây là phép kiểm chiều vật lý, chưa phải hệ thống kiểu ngữ nghĩa đầy đủ cho mọi chất/dòng khí.

Factor scope: mỗi requirement phải khớp **đúng một** factor cùng key/unit, có tập keys scope đúng bằng scope_selectors và giá trị đúng bằng field baseline/observation tương ứng. Không tự chọn hệ số đầu tiên, không fallback từ scope thiếu, không suy đoán vùng/loại thiết bị. Chuỗi scope dùng equality chính xác ("2" khác "2.0"). Không khớp hoặc nhiều khớp đều là lỗi.

## Form và import dùng từ UI

1. Lấy metric_schema hoặc schema_snapshot đáng tin cậy; gọi `buildMethodologyForm`. Render decimal bằng text input/inputMode decimal để giữ chuỗi; boolean checkbox, enum select theo value/label. Render nhãn như text, không HTML. Khi values thay đổi, tính lại required hoặc dùng required_if. Conditions chỉ đổi requiredness, không tự ẩn/xóa dữ liệu.
2. Đọc CSV thành chuỗi Unicode (caller chịu trách nhiệm giải mã UTF-8); gọi `previewCSV` với delimiter và locale người dùng chọn. Không suy đoán dấu `,` là thập phân hay ngăn cột. Comma decimal trong CSV comma delimiter phải được quote. Hỗ trợ BOM, quote escaped, delimiter/newline trong quote, LF/CRLF/CR, trailing empty cell. Không âm thầm bỏ dòng trắng ở giữa file; chúng phải được người dùng sửa.
3. Mỗi observation cần hai cột metadata `record_key`, `observed_on` bên cạnh fields scope observation. Chọn `scope:'baseline'` cho bảng baseline riêng. Alias trim theo header nhưng case-sensitive; alias mơ hồ, cột lạ, trùng tên, hai alias cùng field, mapping typo và cột required thiếu đều thành lỗi. Column 0 nghĩa cột cần có nhưng đang thiếu. Số dòng là dòng vật lý bắt đầu record (multiline CSV vẫn giữ source_row đúng).
4. Cấu hình `columns: {'Diện tích ô đo': {field:'area_ha',unit:'m2'}}`, `delimiter:';'`, `decimalSeparator:','`, `thousandsSeparator:'.'` cho ví dụ `20.000,00` m2 → `2` ha. Group nghìn phải đúng nhóm 3; exponent/NaN/Infinity/bad grouping bị chặn. Ô rỗng/whitespace thành null, required báo lỗi. Boolean nhận true/false/1/0; enum chỉ nhận code.
5. Conversion đóng: m2→ha 0.0001, ha→m2 10000, kWh→MWh 0.001, MWh→kWh 1000, kg→t 0.001, t→kg 1000. Còn phải có source unit trong field.import.accepted_units. Identity không đổi. Các conversion là dịch dấu thập phân chính xác, không làm tròn; nếu vượt scale thì báo lỗi. Không đoán unit từ chuỗi header/cell.
6. Preview hiển thị **mọi lỗi** theo dòng/cột trước khi xác nhận. `prepareImportRecords` trả JSON có record_key/observed_on/**values**/raw_input/source_row. Backend phải lấy lại schema/period thật, xác thực quyền/revision và reparse/revalidate; UI preview không phải ranh giới tin cậy. Đường tích hợp sau này gọi `save_monitoring_records` với p_file_id và p_mapping là object chứa columns cùng locale/conversion settings; không truyền array mapping thẳng vào p_mapping (SQL yêu cầu object). Chưa có commit handler trong bước này.

XLSX adapter trả scalar hoặc ô tag `formula`, `excel-date`, `error`. Formula tag bị từ chối, kể cả có cached result ở parser; không chạy công thức/macro hoặc dereference external link. CSV có tiền tố formula phổ biến cũng bị từ chối. ISO date kiểm cả lịch; serial Excel chấp nhận date-only nguyên, phân biệt hệ 1900/1904, từ chối serial 60 của 1900 (ngày 1900-02-29 giả), số âm/fraction/non-finite. Không đoán serial từ chuỗi CSV; adapter phải trả số hoặc tag date. Chưa parse file Excel thật.

CSV cap 10 Mi ký tự và 10.000 records/202 columns. XLSX input cap 10 MiB; interface truyền adapter limit 50 MiB sau giải nén, max rows/columns và worksheet chọn tường minh. Enforcement ZIP bomb/macro/encryption phải thuộc adapter/worker tương lai, **chưa được chứng minh** bởi interface này. Không export CSV trong module này; raw_input không được tái xuất rồi mở spreadsheet mà bỏ qua chính sách escape của exporter tương lai.

## Report và ranh giới DB

`estimateMrvReport` yêu cầu kỳ locked, có locked_at và data_snapshot, đúng project/period, ngày trong kỳ, revisions an toàn, dữ liệu truyền vào bằng snapshot (so sánh thứ tự key JSON ổn định, bỏ qua thứ tự rows). Chọn outputCalculation tường minh vì schema chưa có thuộc tính “credit output”; không suy theo tên hoặc lấy calculation cuối một cách ngầm định. Giữ số âm nếu công thức ra âm, không clamp thành 0 hay tuyên bố cấp tín chỉ.

Snapshot được clone, kết quả JSON-serializable, caller sửa input sau đó không đổi report đã tính. schema_hash được **mang theo từ DB**, không giả vờ băm JSON.stringify giống PostgreSQL JSONB. Hàm thuần này không xác minh hash/chữ ký hay quyền và không thể ngăn caller giả cả period lẫn snapshot; backend phải nạp dữ liệu đáng tin cậy rồi gọi. Chưa có kiểm chứng HTTP/RPC tích hợp. Engine không tạo final, output file hay template snapshot; backend xuất tài liệu và create_mrv_report nằm ở bước sau.

## Khác biệt cần biết với validator SQL 0013

TS kiểm chặt hơn SQL ở nhiều điểm: enum uniqueness, bounds logic, units, safe integer, conditions, runtime và resource budget. `required_if:{field,equals}` là extension TS cho conditional required, chưa được SQL 0013 thực thi. SQL vẫn kiểm required tĩnh; trước khi nhận methodology có condition cần server dùng validator này, và bổ sung kiểm DB trong nhiệm vụ migration được duyệt riêng nếu cần chống bypass RPC. Không sửa SQL trong bước này.

TS compiler chấp nhận forward calculation references rồi sort topo theo yêu cầu brief. SQL 0013 chỉ cho tham chiếu calculation đứng trước. Khi lưu catalog mới, backend phải sắp calculations theo `compileMethodology(...).order`; seed hiện tại đã đúng thứ tự. TS cũng giới hạn pow integer literal; SQL whitelist trước đây chưa có hạn chế này. Không khẳng định mọi schema pass SQL đều pass TS hoặc ngược lại.

## Đề xuất XLSX và rủi ro

Đề xuất **ExcelJS** làm adapter ở bước được người dùng duyệt phụ thuộc, vì API đọc XLSX phân loại formula/value rõ và không tự tính kết quả công thức. Dùng scalar/formula tags, tuyệt đối không dùng cached formula result như dữ liệu nhập. Nguồn: [ExcelJS README — Formula Value](https://github.com/exceljs/exceljs#formula-value).

Rủi ro đã biết: ExcelJS trước 1.6.0 từng có XSS khi dữ liệu XLSX chứa HTML được hiển thị trong browser (CVE-2018-16459, đã vá từ 1.6.0). Đây là lỗi lịch sử, không khẳng định bản hiện tại còn lỗi đó. Nguồn: [GitHub advisory](https://github.com/advisories/GHSA-2j2j-8rrv-264g). Maintainer repo còn có [issue báo dependency uuid của 4.4.0](https://github.com/exceljs/exceljs/issues/3041); đây là báo cáo issue, chưa được kiểm chứng khả năng khai thác trong ứng dụng này. Trước khi chọn version phải kiểm dependency tree/lockfile và bản vá thực tế; hiện chưa cài hay audit package này.

Rủi ro thiết kế khi parse file không tin cậy: ZIP bomb, CPU/memory exhaustion, external relationships, formula/cached result, macro/embedded objects và rendering HTML. Adapter nên chạy worker có timeout/memory cap, kiểm tổng kích thước giải nén, từ chối macro/encrypted workbook, không truy cập link ngoài, render text và reject formula. Giới hạn interface không tự bảo đảm thư viện thực thi chúng.

Phương án thay thế là SheetJS CE từ bản phân phối chính thức đã vá: [CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533) ảnh hưởng qua 0.19.2 (prototype pollution); [CVE-2024-22363](https://cdn.sheetjs.com/advisories/CVE-2024-22363) ảnh hưởng qua 0.20.1 (ReDoS), advisory yêu cầu từ 0.20.2. Không coi gói npm `xlsx` cũ là lựa chọn an toàn mặc định. Chưa chọn/pin hoặc tải thư viện nào; người dùng quyết phụ thuộc.

## Kiểm chứng và điều chưa chắc

Lệnh kiểm tra: `npm run types -- --incremental false` (cùng tsc --noEmit, tắt cache để không ghi tsbuildinfo ngoài allowlist) và `npm run test`. Kết quả lượt đầu: types sạch; **204/204 tests, 9 files pass** = **107 test Module B mới** (55 methodology, 40 monitoring-import, 12 mrv-report) + **88 tests cũ** + **9 tests auth-role của worker-claude đang làm song song**. Không nhận công phần auth; không sửa các test đó. Kết quả cuối sau đối chiếu payload RPC/format source được cập nhật bên dưới.

Các kết quả tính tay so với toàn bộ seed 0014:

| Seed | Input minh họa | Kỳ vọng tCO2e |
| --- | --- | --- |
| DEMO-VCS-FOREST | (12−10) tC/ha × 2 ha × 3.6666666667 | 14.6667 |
| DEMO-VCS-ENERGY | 100 MWh × (0.5−0.0200) tCO2e/MWh | 48.0000 |
| DEMO-GS-FOREST | cùng công thức mẫu rừng | 14.6667 |
| DEMO-GS-BIOGAS | 100 × 0.5 × 0.00067 × (1−0.1) × 27 | 0.8140 (half-even từ 0.81405) |

Test phủ riêng op:null và invalid ops, dependency cycles/forward references, sai scope/tham chiếu/type, chia 0, đơn vị, pow và giới hạn, NaN/Infinity, số >53-bit, half-even dương/âm, bốn aggregations, scoped factors, form cho cả bốn seed, CSV quote/multiline/malformed/cột thiếu-thừa-trùng/aliases/locale/unit/precision/date/formula, Excel date systems bằng ô giả, snapshot consistency/isolation và replay trace. Không gọi DB hoặc API để chạy các test engine này.

Chưa kiểm chứng: **parser XLSX thật và sandbox ZIP/macro**, browser/UI/commit RPC, precision oracle toàn miền bằng thư viện decimal độc lập, semantic units/chuyên môn methodology, nghiệp vụ phát hành credit, PDF/Word/template. Tests số học là kỳ vọng tính tay với các ca giới hạn; không thay kiểm toán numerical/scientific độc lập. Những điểm này không được ghi là đã pass.

**Kết quả cuối:** sau sửa payload `values`, đếm phép toán pow và kiểm giới hạn/revision report, rồi format source bằng TypeScript printer có sẵn: `npm run types -- --incremental false` exit 0; `npm run test` exit 0, **204/204 tests, 9/9 files pass** (lượt Vitest bắt đầu 14:50:13). Không test bị skip trong bộ unit này. Cảnh báo Vite CJS và stderr thiếu cấu hình từ test negative có sẵn không làm fail; không phải bằng chứng đã truy cập Supabase. Scan source engine không có eval/new Function/fetch/process.env/Supabase client. Các diff tracked auth trong workspace thuộc worker-claude, không bị engine ghi đè.
