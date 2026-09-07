# Bóc tách VM0051 v1.1 thành `metric_schema`

Ngày bóc tách: 07/09/2026.

Nguồn duy nhất cho nội dung chuyên môn là
`reference/methodologies/VM0051-Improved-Management-in-Rice-Production-Systems-v1.1.pdf`,
Verra VM0051 **Improved Management in Rice Production Systems**, version 1.1, ngày
14/07/2026. Số trang dưới đây là số in trên tài liệu, trùng với trang PDF.

## Phạm vi và trạng thái

Migration `0019_vm0051.sql` là một bản bóc tách **một phần**, không phải triển khai đầy
đủ VM0051. Nó chỉ mã hóa Equation (25), khoản khấu trừ phát thải N₂O do thay đổi chế độ
tưới từ continuous flooding sang single hoặc multiple drainage.

- `is_sample = false`: tên, tham số, công thức và hệ số đến từ methodology thật.
- `professionally_validated = false`: chưa có chuyên gia đối chiếu và chịu trách nhiệm.
- `status = published` chỉ làm row bất biến và cho phép chọn trong catalog. Cờ
  `professionally_validated = false` vẫn chặn báo cáo `final` tại DB.
- Kết quả của calculation là **một khoản khấu trừ** trong Equation (29), không phải tổng
  giảm phát thải hay số tín chỉ của dự án.

## Bản đồ tài liệu

| Phần | Trang | Nội dung và cách xử lý |
|---|---:|---|
| 1 Summary Description | 5–6 | Phạm vi ALM, các thực hành chính/tùy chọn, ba quantification approach; dùng để xác định ngữ cảnh, không mã hóa thành phép tính |
| 3 Definitions | 7–9 | AWD, continuous flooding, quantification unit, schedule of activities…; dùng để hiểu ký hiệu |
| 4 Applicability Conditions | 9–11 | Mười điều kiện áp dụng và ngoại lệ; chưa mã hóa vì schema hiện không có rule engine/chứng cứ |
| 5 Project Boundary | 11–12 | Nguồn CH₄, N₂O, CO₂ bắt buộc/điều kiện; chưa mã hóa lựa chọn nguồn |
| 6 Baseline Scenario | 12–16 | Historical look-back tối thiểu ba năm, Table 2 và hierarchy nguồn ở Box 1; chưa mã hóa lịch lặp nhiều năm |
| 8.1 Summary | 18–22 | QA1 model, QA2 direct measurement, QA3 default factors và điều kiện lựa chọn; chưa mã hóa branching |
| 8.2 Baseline Emissions | 23–32 | Equations (1)–(23): nhiên liệu, vôi, CH₄, N₂O, đốt sinh khối; chưa bóc tách vào schema |
| **8.3.2 Irrigation Change** | **33–34** | **Equation (25) được bóc tách** |
| 8.4 Leakage | 34–38 | Organic amendments, yield decline, biomass diversion; chưa bóc tách |
| 8.5 Net Reductions | 38–39 | Equations (29)–(34), phụ thuộc mọi nguồn và uncertainty; chưa bóc tách |
| 8.6 Uncertainty | 39–45 | QA-specific error propagation/Monte Carlo, Equations (35)–(38); chưa bóc tách |
| 9.1 Validation parameters | 46–51 | Nguồn và đơn vị của `GWP_N2O`, `CF_N2O`; đã dùng phần liên quan Equation (25) |
| 9.2 Monitored parameters | 51–69 | Định nghĩa, tần suất, QA/QC; đã lấy `A_i` và `Q_N,i`, phần còn lại chưa bóc tách |
| 9.3 Monitoring plan | 69–72 | Yêu cầu kế hoạch, thiết bị, dữ liệu và chuyên gia; chưa mã hóa |
| Appendices 1–2 | 75–82 | Stratification và field measurement QA2; chưa bóc tách |
| **Appendix 3** | **83–84** | **Nguồn dẫn xuất và xác nhận giá trị `CF_N2O = 0.00314`** |
| Appendix 4–5 | 85–89 | DMRV và net-zero compatibility; chưa bóc tách |

## Tham số đã bóc tách

`record_key` của hệ thống nhận diện quantification unit `i` trong year `t`; ngày quan sát
được lưu ở `monitoring_data.observed_on`, nên hai giá trị này không bị lặp thành field.

| ID trong schema | Ký hiệu gốc | Ý nghĩa | Đơn vị | Scope | Bắt buộc | Nguồn |
|---|---|---|---|---|---|---|
| `gwp_n2o` | `GWP_N2O` | Global warming potential cho nitrous oxide | `tCO2e/tN2O` | `baseline` | Có | §9.1, pp. 49–50; giá trị phải theo VCS Standard mới nhất |
| `area_quantification_unit_ha` | `A_i` | Diện tích quantification unit `i` | `ha` | `observation` | Có | §9.2, pp. 51–52; giám sát mỗi mùa |
| `nitrogen_input_rate_wp_kg_n_ha` | `Q_N,i` | Lượng nitrogen đầu vào trong project scenario | `kgN/ha` | `observation` | Có | §9.2, p. 66; giám sát mỗi mùa |

Tài liệu không đưa khoảng số hợp lệ cho ba tham số này, nên schema **không tự thêm**
`minimum`, `maximum` hay precision. Việc một đại lượng vật lý thường không âm không được
dùng làm lý do sáng tác constraint chuyên môn.

`GWP_N2O` là field baseline thay vì factor seed: VM0051 không cho một giá trị số, mà yêu
cầu dùng giá trị trong phiên bản VCS Standard mới nhất (§9.1, pp. 49–50). Gán sẵn 273,
265 hay một giá trị nhớ từ nguồn khác sẽ vi phạm nguyên tắc transcription.

## Hệ số có giá trị số đã bóc tách

| Key | Giá trị | Đơn vị engine | Nguồn |
|---|---:|---|---|
| `n2o_drying_correction` | `0.00314` | `kgN2O/kgN` | §8.3.2 Eq. (25), pp. 33–34; §9.1 p. 50; Appendix 3 p. 83 |
| `kg_n2o_to_t_n2o` | `0.001` | `tN2O/kgN2O` | §8.3.2 Eq. (25), pp. 33–34: `10^-3`, conversion kilogram → tonne |

Đơn vị của hệ số chuyển đổi được viết tường minh thành `tN2O/kgN2O` để unit checker của
engine bảo toàn đại lượng. Đây là cùng phép đổi `10^-3` trong công thức, không phải một
giá trị chuyên môn bổ sung.

## Công thức đã chuyển thành AST

### Equation (25), §8.3.2, pp. 33–34

Công thức gốc:

```text
PE_Red-Irri,t = Σ_i (Q_N,i × A_i) × CF_N2O × 10^-3 × GWP_N2O
```

Trong đó kết quả là deduction do flux N₂O từ giai đoạn làm khô ruộng, đơn vị `t CO2e`.
AST cho **một** record `i` nhân đúng năm thừa số; `aggregation: sum` thực hiện `Σ_i`:

```json
{
  "op": "multiply",
  "args": [
    { "field": "nitrogen_input_rate_wp_kg_n_ha" },
    { "field": "area_quantification_unit_ha" },
    { "factor": "n2o_drying_correction" },
    { "factor": "kg_n2o_to_t_n2o" },
    { "baseline": "gwp_n2o" }
  ]
}
```

Đối chiếu đơn vị:

```text
(kgN/ha) × ha × (kgN2O/kgN) × (tN2O/kgN2O) × (tCO2e/tN2O)
= tCO2e
```

Equation (25) chỉ áp dụng cho các field đổi tưới từ continuous flooding sang AWD
(single hoặc multiple drainage), bất kể nitrogen fertilizer rate có đổi hay không
(§8.3.2 p. 33 và Appendix 3 p. 83). Schema chưa có rule engine để chứng minh điều kiện
này; người dùng không được chạy calculation cho field ngoài phạm vi chỉ vì form nhận số.

## Danh sách chưa bóc tách

Danh sách này là ranh giới chức năng, không phải backlog ngầm được phép ước lượng:

1. **Applicability và project boundary (§4–5):** cần rule engine, evidence và đánh giá
   chuyên gia; boolean đơn giản không chứng minh được điều kiện.
2. **Baseline schedule (§6, Table 2, Box 1):** là lịch theo field, mùa và chu kỳ look-back
   tối thiểu ba năm, có hierarchy nguồn và quy tắc conservative. `baseline` hiện là một
   object cấp project, không biểu diễn an toàn cấu trúc lặp này.
3. **QA1:** phụ thuộc biogeochemical model, VM0042 và VMD0053, calibration/validation và
   domain assessment ngoài PDF/schema hiện tại.
4. **QA2, Equations (9)–(16):** cần hồi quy line of best fit, tích phân chuỗi thời gian,
   replicate chambers và sampling design. DSL không có regression/integration.
5. **QA3, Equations (1)–(8), (17)–(23):** có tổng theo fuel/fertilizer/amendment type,
   lựa chọn country/region/global factor, bảng IPCC bên ngoài và điều kiện de minimis.
   Không tự chép một bộ Tier 1 khi chưa chọn địa lý và điều kiện dự án.
6. **Equation (24):** cần danh mục alternative end-use `r` và emission factor theo end
   use; VM0051 không cung cấp một bảng số cố định trong công thức.
7. **Equation (26):** có điều kiện miễn deduction và tổng theo amendment/livestock type;
   chỉ mã hóa phép nhân sẽ bỏ mất eligibility logic.
8. **Yield leakage, Equations (27)–(28):** hai đường so sánh thay thế, sau đó là quy trình
   ba bước, loại extreme weather, cửa sổ 10 năm và stratification. DSL không biểu diễn
   branching đó.
9. **Biomass energy leakage (§8.4.3):** dẫn sang CDM TOOL16, chưa có trong bộ nguồn đã
   bóc tách.
10. **Net reductions, Equations (29)–(34):** phụ thuộc mọi nguồn phát thải/leakage chưa
    triển khai và uncertainty. Ghép các input thiếu thành số 0 sẽ tạo kết quả sai nên bị
    loại toàn bộ.
11. **Uncertainty, Equations (35)–(38):** cần sampling strata, variance, square root,
    Student's t và/hoặc Monte Carlo. DSL hiện chỉ hỗ trợ lũy thừa nguyên, không đủ.
12. **Phần còn lại của Section 9 và Appendices:** data source hierarchy, frequency,
    QA/QC, monitoring plan, stratification, DMRV và safeguard chưa có mô hình dữ liệu.

Vì các phần trên chưa có, không được đặt tên output là “emission reductions”, “credits”
hay “VM0051 result”. Tên calculation cố ý là `n2o_irrigation_change_deduction`.

## Việc chuyên gia phải làm trước khi `professionally_validated = true`

1. Đối chiếu từng ký hiệu, chỉ số, đơn vị và thứ tự phép tính của Equation (25) với bản
   PDF kiểm soát; xác nhận `aggregation: sum` khớp grain của dữ liệu triển khai.
2. Chốt phiên bản VCS Standard và giá trị `GWP_N2O`, lưu nguồn/version cùng snapshot;
   kiểm tra quy tắc cập nhật GWP giữa các monitoring period.
3. Xác nhận cách tính `Q_N,i` khi có nhiều loại/phần nitrogen input và ranh giới mùa/năm;
   kiểm tra source log, receipt và QA/QC ở §9.2.
4. Xác nhận `A_i`, GIS/survey procedure, tần suất và quan hệ quantification unit ↔ season.
5. Thiết kế và kiểm tra bằng chứng rằng field thực sự chuyển từ continuous flooding sang
   single/multiple drainage trước khi áp deduction.
6. Review cách unit engine biểu diễn `10^-3`, thử bộ số độc lập và đối chiếu phép tính tay.
7. Quyết định các phần còn thiếu nào phải hoàn tất trước khi methodology được dùng trong
   MRV thật; đặc biệt không cho Equation (25) đứng riêng bị hiểu là Equation (29).
8. Ghi danh tính, năng lực, ngày review và artifact phê duyệt. Schema hiện chưa có các
   cột provenance này; cần bổ sung trước khi cờ chuyên môn mang giá trị kiểm toán.

Row 0019 đã `published` nên trigger DB không cho sửa trực tiếp. Sau review, không lật cờ
trên row này bằng cách bỏ guard; phải tạo một catalog revision mới ở trạng thái `draft`,
gắn provenance review, đặt `professionally_validated = true` trước khi publish, và giữ
row 0019 làm dấu vết của bản bóc tách tự động chưa xác nhận.
