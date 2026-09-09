-- Partial transcription of the official Verra methodology:
-- VM0051 Improved Management in Rice Production Systems, v1.1 (14 July 2026).
-- Source file: reference/methodologies/VM0051-Improved-Management-in-Rice-Production-Systems-v1.1.pdf
--
-- IMPORTANT: This is not a complete implementation of VM0051. It transcribes only
-- Equation (25), the N2O deduction due to irrigation change. See the disclaimer in the
-- methodology row and docs/design/vm0051-extraction.md for the explicit exclusion list.
-- `professionally_validated` remains false. This file is a proposal and has not been
-- applied to any Supabase database.

-- 0014 normally creates VCS. Keep this migration rebuild-safe if that sample seed is
-- omitted in another environment, without assuming that VCS has the same UUID there.
insert into public.standards(id, code, name)
values (
  '10000000-0000-4000-8000-000000000001',
  'VCS',
  'Verra — Verified Carbon Standard (VCS)'
)
on conflict (code) do nothing;

insert into public.methodologies(
  id,
  standard_id,
  code,
  version,
  name,
  project_type,
  status,
  is_sample,
  professionally_validated,
  disclaimer,
  metric_schema
)
select
  '20000000-0000-4000-8000-000000000051',
  s.id,
  'VM0051',
  '1.1',
  'Improved Management in Rice Production Systems',
  'agricultural_land_management',
  'draft',
  false,
  false,
  'BÓC TÁCH TỰ ĐỘNG MỘT PHẦN từ tài liệu gốc Verra VM0051 v1.1, CHƯA ĐƯỢC CHUYÊN GIA ĐỐI CHIẾU. Schema này chỉ triển khai Equation (25): khoản khấu trừ N2O do thay đổi tưới. Chưa bóc tách: điều kiện áp dụng; lịch hoạt động baseline; QA1; QA2; các phương trình QA3 và nguồn phát thải khác; phát thải do chuyển hướng rơm; leakage hữu cơ, năng suất và sinh khối; net reductions; uncertainty; giá trị GWP_N2O do VCS Standard hiện hành quy định; toàn bộ quy trình monitoring/QA-QC và các appendix ngoài hệ số N2O được dẫn chiếu. Không được hiểu kết quả là tổng giảm phát thải VM0051.',
  $metric${
    "schema_version": 1,
    "disclaimer": "BÓC TÁCH TỰ ĐỘNG MỘT PHẦN từ VM0051 v1.1, chưa được chuyên gia đối chiếu. Chỉ tính Equation (25), khoản khấu trừ N2O do thay đổi tưới; không tính tổng giảm phát thải VM0051. GWP_N2O phải lấy từ phiên bản VCS Standard hiện hành, tài liệu VM0051 không cung cấp giá trị số.",
    "record_grain": "Một quantification unit i trong year t cho Equation (25); Ai và QN,i được giám sát mỗi mùa theo Section 9.2.",
    "decimal_encoding": "ASCII decimal string; không dùng ký pháp exponent",
    "fields": [
      {
        "id": "gwp_n2o",
        "label": {
          "en": "Global warming potential for nitrous oxide (GWP_N2O)",
          "vi": "Tiềm năng nóng lên toàn cầu của nitrous oxide (GWP_N2O)"
        },
        "type": "decimal",
        "unit": "tCO2e/tN2O",
        "scope": "baseline",
        "required": true,
        "ui": {
          "group": "parameters_available_at_validation",
          "order": 1
        },
        "import": {
          "aliases": [
            "gwp_n2o",
            "GWPN2O"
          ],
          "accepted_units": [
            "tCO2e/tN2O"
          ]
        }
      },
      {
        "id": "area_quantification_unit_ha",
        "label": {
          "en": "Area of quantification unit i (A_i)",
          "vi": "Diện tích quantification unit i (A_i)"
        },
        "type": "decimal",
        "unit": "ha",
        "scope": "observation",
        "required": true,
        "ui": {
          "group": "parameters_monitored",
          "order": 2
        },
        "import": {
          "aliases": [
            "area_quantification_unit_ha",
            "Ai",
            "area_ha"
          ],
          "accepted_units": [
            "ha"
          ]
        }
      },
      {
        "id": "nitrogen_input_rate_wp_kg_n_ha",
        "label": {
          "en": "Application rate of nitrogen input in the project scenario (Q_N,i)",
          "vi": "Lượng nitrogen đầu vào trong kịch bản dự án (Q_N,i)"
        },
        "type": "decimal",
        "unit": "kgN/ha",
        "scope": "observation",
        "required": true,
        "ui": {
          "group": "parameters_monitored",
          "order": 3
        },
        "import": {
          "aliases": [
            "nitrogen_input_rate_wp_kg_n_ha",
            "QN_i",
            "QN,i"
          ],
          "accepted_units": [
            "kgN/ha"
          ]
        }
      }
    ],
    "factor_requirements": [
      {
        "key": "n2o_drying_correction",
        "unit": "kgN2O/kgN",
        "scope_selectors": []
      },
      {
        "key": "kg_n2o_to_t_n2o",
        "unit": "tN2O/kgN2O",
        "scope_selectors": []
      }
    ],
    "calculations": [
      {
        "id": "n2o_irrigation_change_deduction",
        "unit": "tCO2e",
        "aggregation": "sum",
        "expression": {
          "op": "multiply",
          "args": [
            {
              "field": "nitrogen_input_rate_wp_kg_n_ha"
            },
            {
              "field": "area_quantification_unit_ha"
            },
            {
              "factor": "n2o_drying_correction"
            },
            {
              "factor": "kg_n2o_to_t_n2o"
            },
            {
              "baseline": "gwp_n2o"
            }
          ]
        }
      }
    ],
    "runtime": {
      "dsl_version": 1,
      "precision_digits": 28,
      "rounding": "half_even",
      "output_scale": 6,
      "on_missing": "error",
      "on_division_by_zero": "error"
    }
  }$metric$::jsonb
from public.standards s
where s.code = 'VCS';

-- VM0051 v1.1, Section 8.3.2, Equation (25), pages 33–34; repeated as the
-- monitored parameter CFN2O on page 50 and derived in Appendix 3, page 83.
insert into public.methodology_factors(methodology_id, key, value, unit, source)
values (
  '20000000-0000-4000-8000-000000000051',
  'n2o_drying_correction',
  0.00314,
  'kgN2O/kgN',
  'VM0051 v1.1, Section 8.3.2, Equation (25), pp. 33–34; Section 9.1, CFN2O, p. 50; Appendix 3, p. 83. Value applied: 0.00314 kg N2O/kg N-input.'
), (
  '20000000-0000-4000-8000-000000000051',
  'kg_n2o_to_t_n2o',
  0.001,
  'tN2O/kgN2O',
  'VM0051 v1.1, Section 8.3.2, Equation (25), pp. 33–34. The equation specifies 10^-3 as the unit conversion from kilogram to tonne.'
);

-- `published` means technically immutable/selectable, not professionally approved.
-- `professionally_validated=false` deliberately prevents final MRV reports.
update public.methodologies
set status = 'published'
where id = '20000000-0000-4000-8000-000000000051';
