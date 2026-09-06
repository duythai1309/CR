-- Seed minh hoạ khả năng tổng quát của metric_schema, KHÔNG phải tài liệu Standard chính thức.
-- DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.
-- Published chỉ nghĩa bất biến kỹ thuật; is_sample=true, professionally_validated=false.
-- Repo không có template PDF/Word thật: placeholder có object_path/checksum NULL.
-- Runner bọc transaction bằng psql -X -1 -v ON_ERROR_STOP=1 -f <file>, đồng nhất 0001–0013.

-- Hai Standard được hỗ trợ; không gán mã methodology thật cho dữ liệu tự soạn.
insert into public.standards(id,code,name) values
 ('10000000-0000-4000-8000-000000000001','VCS','Verra — Verified Carbon Standard (VCS)'),
 ('10000000-0000-4000-8000-000000000002','GS','Gold Standard');

-- DEMO-VCS-FOREST: DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.
insert into public.methodologies(id,standard_id,code,version,name,project_type,status,is_sample,professionally_validated,disclaimer,metric_schema)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','DEMO-VCS-FOREST','demo-1.0','MẪU VCS — thay đổi trữ lượng carbon rừng','afolu','draft',true,false,'DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.',
$metric${
  "schema_version": 1,
  "disclaimer": "DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.",
  "record_grain": "Một đối tượng quan sát trong kỳ; record_key ổn định và observed_on ISO.",
  "decimal_encoding": "ASCII decimal string; không dùng ký pháp exponent",
  "fields": [
    {
      "id": "baseline_stock_tc_ha",
      "label": {
        "vi": "Trữ lượng carbon nền"
      },
      "type": "decimal",
      "unit": "tC/ha",
      "scope": "baseline",
      "required": true,
      "ui": {
        "group": "baseline",
        "order": 1
      },
      "import": {
        "aliases": [
          "baseline_stock_tc_ha",
          "Trữ lượng carbon nền"
        ],
        "accepted_units": [
          "tC/ha"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4
      }
    },
    {
      "id": "plot_code",
      "label": {
        "vi": "Mã ô đo"
      },
      "type": "text",
      "unit": "1",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 2
      },
      "import": {
        "aliases": [
          "plot_code",
          "Mã ô đo"
        ],
        "accepted_units": [
          "1"
        ]
      }
    },
    {
      "id": "area_ha",
      "label": {
        "vi": "Diện tích ô đo"
      },
      "type": "decimal",
      "unit": "ha",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 3
      },
      "import": {
        "aliases": [
          "area_ha",
          "Diện tích ô đo"
        ],
        "accepted_units": [
          "ha",
          "m2"
        ]
      },
      "validation": {
        "exclusive_minimum": 0,
        "scale": 4
      }
    },
    {
      "id": "stock_tc_ha",
      "label": {
        "vi": "Trữ lượng carbon đo được"
      },
      "type": "decimal",
      "unit": "tC/ha",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 4
      },
      "import": {
        "aliases": [
          "stock_tc_ha",
          "Trữ lượng carbon đo được"
        ],
        "accepted_units": [
          "tC/ha"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4
      }
    }
  ],
  "factor_requirements": [
    {
      "key": "carbon_to_co2",
      "unit": "tCO2e/tC",
      "scope_selectors": []
    }
  ],
  "calculations": [
    {
      "id": "stock_change_tc",
      "unit": "tC",
      "aggregation": "sum",
      "expression": {
        "op": "multiply",
        "args": [
          {
            "op": "subtract",
            "args": [
              {
                "field": "stock_tc_ha"
              },
              {
                "baseline": "baseline_stock_tc_ha"
              }
            ]
          },
          {
            "field": "area_ha"
          }
        ]
      }
    },
    {
      "id": "estimated_change_tco2e",
      "unit": "tCO2e",
      "aggregation": "sum",
      "expression": {
        "op": "multiply",
        "args": [
          {
            "calculation": "stock_change_tc"
          },
          {
            "factor": "carbon_to_co2"
          }
        ]
      }
    }
  ],
  "runtime": {
    "dsl_version": 1,
    "precision_digits": 28,
    "rounding": "half_even",
    "output_scale": 4,
    "on_missing": "error",
    "on_division_by_zero": "error"
  }
}$metric$::jsonb);

-- Hệ số MẪU riêng, không đọc/ghi emission_factors legacy.
insert into public.methodology_factors(methodology_id,key,value,unit,source) values
 ('20000000-0000-4000-8000-000000000001','carbon_to_co2',3.6666666667,'tCO2e/tC','DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.');
update public.methodologies set status='published' where id='20000000-0000-4000-8000-000000000001';

-- Placeholder cho cả PDF/DOCX; thay bằng bản ready có file thật ở bước triển khai sau.
insert into public.report_templates(standard_id,methodology_id,version,format,status,disclaimer) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','demo-template-1.0','pdf','placeholder','PLACEHOLDER — chưa có tệp template chính thức. DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','demo-template-1.0','docx','placeholder','PLACEHOLDER — chưa có tệp template chính thức. DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.');

-- DEMO-VCS-ENERGY: DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.
insert into public.methodologies(id,standard_id,code,version,name,project_type,status,is_sample,professionally_validated,disclaimer,metric_schema)
values ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','DEMO-VCS-ENERGY','demo-1.0','MẪU VCS — điện năng thay thế','energy','draft',true,false,'DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.',
$metric${
  "schema_version": 1,
  "disclaimer": "DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.",
  "record_grain": "Một đối tượng quan sát trong kỳ; record_key ổn định và observed_on ISO.",
  "decimal_encoding": "ASCII decimal string; không dùng ký pháp exponent",
  "fields": [
    {
      "id": "baseline_intensity",
      "label": {
        "vi": "Cường độ phát thải nền"
      },
      "type": "decimal",
      "unit": "tCO2e/MWh",
      "scope": "baseline",
      "required": true,
      "ui": {
        "group": "baseline",
        "order": 1
      },
      "import": {
        "aliases": [
          "baseline_intensity",
          "Cường độ phát thải nền"
        ],
        "accepted_units": [
          "tCO2e/MWh"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4
      }
    },
    {
      "id": "meter_code",
      "label": {
        "vi": "Mã công tơ"
      },
      "type": "text",
      "unit": "1",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 2
      },
      "import": {
        "aliases": [
          "meter_code",
          "Mã công tơ"
        ],
        "accepted_units": [
          "1"
        ]
      }
    },
    {
      "id": "electricity_mwh",
      "label": {
        "vi": "Điện năng đo được"
      },
      "type": "decimal",
      "unit": "MWh",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 3
      },
      "import": {
        "aliases": [
          "electricity_mwh",
          "Điện năng đo được"
        ],
        "accepted_units": [
          "MWh"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4
      }
    },
    {
      "id": "meter_checked",
      "label": {
        "vi": "Đã kiểm tra công tơ"
      },
      "type": "boolean",
      "unit": "1",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 4
      },
      "import": {
        "aliases": [
          "meter_checked",
          "Đã kiểm tra công tơ"
        ],
        "accepted_units": [
          "1"
        ]
      }
    }
  ],
  "factor_requirements": [
    {
      "key": "project_intensity",
      "unit": "tCO2e/MWh",
      "scope_selectors": []
    }
  ],
  "calculations": [
    {
      "id": "estimated_reduction_tco2e",
      "unit": "tCO2e",
      "aggregation": "sum",
      "expression": {
        "op": "multiply",
        "args": [
          {
            "field": "electricity_mwh"
          },
          {
            "op": "subtract",
            "args": [
              {
                "baseline": "baseline_intensity"
              },
              {
                "factor": "project_intensity"
              }
            ]
          }
        ]
      }
    }
  ],
  "runtime": {
    "dsl_version": 1,
    "precision_digits": 28,
    "rounding": "half_even",
    "output_scale": 4,
    "on_missing": "error",
    "on_division_by_zero": "error"
  }
}$metric$::jsonb);

-- Hệ số MẪU riêng, không đọc/ghi emission_factors legacy.
insert into public.methodology_factors(methodology_id,key,value,unit,source) values
 ('20000000-0000-4000-8000-000000000002','project_intensity',0.0200,'tCO2e/MWh','DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.');
update public.methodologies set status='published' where id='20000000-0000-4000-8000-000000000002';

-- Placeholder cho cả PDF/DOCX; thay bằng bản ready có file thật ở bước triển khai sau.
insert into public.report_templates(standard_id,methodology_id,version,format,status,disclaimer) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','demo-template-1.0','pdf','placeholder','PLACEHOLDER — chưa có tệp template chính thức. DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.'),
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','demo-template-1.0','docx','placeholder','PLACEHOLDER — chưa có tệp template chính thức. DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.');

-- DEMO-GS-FOREST: DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.
insert into public.methodologies(id,standard_id,code,version,name,project_type,status,is_sample,professionally_validated,disclaimer,metric_schema)
values ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','DEMO-GS-FOREST','demo-1.0','MẪU GS — thay đổi trữ lượng carbon rừng','afolu','draft',true,false,'DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.',
$metric${
  "schema_version": 1,
  "disclaimer": "DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.",
  "record_grain": "Một đối tượng quan sát trong kỳ; record_key ổn định và observed_on ISO.",
  "decimal_encoding": "ASCII decimal string; không dùng ký pháp exponent",
  "fields": [
    {
      "id": "baseline_stock_tc_ha",
      "label": {
        "vi": "Trữ lượng carbon nền"
      },
      "type": "decimal",
      "unit": "tC/ha",
      "scope": "baseline",
      "required": true,
      "ui": {
        "group": "baseline",
        "order": 1
      },
      "import": {
        "aliases": [
          "baseline_stock_tc_ha",
          "Trữ lượng carbon nền"
        ],
        "accepted_units": [
          "tC/ha"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4
      }
    },
    {
      "id": "plot_code",
      "label": {
        "vi": "Mã ô đo"
      },
      "type": "text",
      "unit": "1",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 2
      },
      "import": {
        "aliases": [
          "plot_code",
          "Mã ô đo"
        ],
        "accepted_units": [
          "1"
        ]
      }
    },
    {
      "id": "area_ha",
      "label": {
        "vi": "Diện tích ô đo"
      },
      "type": "decimal",
      "unit": "ha",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 3
      },
      "import": {
        "aliases": [
          "area_ha",
          "Diện tích ô đo"
        ],
        "accepted_units": [
          "ha",
          "m2"
        ]
      },
      "validation": {
        "exclusive_minimum": 0,
        "scale": 4
      }
    },
    {
      "id": "stock_tc_ha",
      "label": {
        "vi": "Trữ lượng carbon đo được"
      },
      "type": "decimal",
      "unit": "tC/ha",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 4
      },
      "import": {
        "aliases": [
          "stock_tc_ha",
          "Trữ lượng carbon đo được"
        ],
        "accepted_units": [
          "tC/ha"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4
      }
    }
  ],
  "factor_requirements": [
    {
      "key": "carbon_to_co2",
      "unit": "tCO2e/tC",
      "scope_selectors": []
    }
  ],
  "calculations": [
    {
      "id": "stock_change_tc",
      "unit": "tC",
      "aggregation": "sum",
      "expression": {
        "op": "multiply",
        "args": [
          {
            "op": "subtract",
            "args": [
              {
                "field": "stock_tc_ha"
              },
              {
                "baseline": "baseline_stock_tc_ha"
              }
            ]
          },
          {
            "field": "area_ha"
          }
        ]
      }
    },
    {
      "id": "estimated_change_tco2e",
      "unit": "tCO2e",
      "aggregation": "sum",
      "expression": {
        "op": "multiply",
        "args": [
          {
            "calculation": "stock_change_tc"
          },
          {
            "factor": "carbon_to_co2"
          }
        ]
      }
    }
  ],
  "runtime": {
    "dsl_version": 1,
    "precision_digits": 28,
    "rounding": "half_even",
    "output_scale": 4,
    "on_missing": "error",
    "on_division_by_zero": "error"
  }
}$metric$::jsonb);

-- Hệ số MẪU riêng, không đọc/ghi emission_factors legacy.
insert into public.methodology_factors(methodology_id,key,value,unit,source) values
 ('20000000-0000-4000-8000-000000000003','carbon_to_co2',3.6666666667,'tCO2e/tC','DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.');
update public.methodologies set status='published' where id='20000000-0000-4000-8000-000000000003';

-- Placeholder cho cả PDF/DOCX; thay bằng bản ready có file thật ở bước triển khai sau.
insert into public.report_templates(standard_id,methodology_id,version,format,status,disclaimer) values
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','demo-template-1.0','pdf','placeholder','PLACEHOLDER — chưa có tệp template chính thức. DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','demo-template-1.0','docx','placeholder','PLACEHOLDER — chưa có tệp template chính thức. DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.');

-- DEMO-GS-BIOGAS: DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.
insert into public.methodologies(id,standard_id,code,version,name,project_type,status,is_sample,professionally_validated,disclaimer,metric_schema)
values ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','DEMO-GS-BIOGAS','demo-1.0','MẪU GS — thu hồi khí sinh học','biogas','draft',true,false,'DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.',
$metric${
  "schema_version": 1,
  "disclaimer": "DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.",
  "record_grain": "Một đối tượng quan sát trong kỳ; record_key ổn định và observed_on ISO.",
  "decimal_encoding": "ASCII decimal string; không dùng ký pháp exponent",
  "fields": [
    {
      "id": "baseline_capture_fraction",
      "label": {
        "vi": "Tỷ lệ thu hồi nền"
      },
      "type": "decimal",
      "unit": "1",
      "scope": "baseline",
      "required": true,
      "ui": {
        "group": "baseline",
        "order": 1
      },
      "import": {
        "aliases": [
          "baseline_capture_fraction",
          "Tỷ lệ thu hồi nền"
        ],
        "accepted_units": [
          "1"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4,
        "maximum": 1
      }
    },
    {
      "id": "digester_code",
      "label": {
        "vi": "Mã hầm khí"
      },
      "type": "text",
      "unit": "1",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 2
      },
      "import": {
        "aliases": [
          "digester_code",
          "Mã hầm khí"
        ],
        "accepted_units": [
          "1"
        ]
      }
    },
    {
      "id": "biogas_m3",
      "label": {
        "vi": "Thể tích khí sinh học"
      },
      "type": "decimal",
      "unit": "m3",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 3
      },
      "import": {
        "aliases": [
          "biogas_m3",
          "Thể tích khí sinh học"
        ],
        "accepted_units": [
          "m3"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4
      }
    },
    {
      "id": "methane_fraction",
      "label": {
        "vi": "Tỷ phần methane"
      },
      "type": "decimal",
      "unit": "1",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 4
      },
      "import": {
        "aliases": [
          "methane_fraction",
          "Tỷ phần methane"
        ],
        "accepted_units": [
          "1"
        ]
      },
      "validation": {
        "minimum": 0,
        "scale": 4,
        "maximum": 1
      }
    },
    {
      "id": "equipment_type",
      "label": {
        "vi": "Loại thiết bị"
      },
      "type": "enum",
      "unit": "1",
      "scope": "observation",
      "required": true,
      "ui": {
        "group": "observation",
        "order": 5
      },
      "import": {
        "aliases": [
          "equipment_type",
          "Loại thiết bị"
        ],
        "accepted_units": [
          "1"
        ]
      },
      "options": [
        {
          "value": "flare",
          "label": {
            "vi": "Đốt khí"
          }
        },
        {
          "value": "generator",
          "label": {
            "vi": "Máy phát"
          }
        }
      ]
    }
  ],
  "factor_requirements": [
    {
      "key": "methane_density",
      "unit": "tCH4/m3_CH4",
      "scope_selectors": []
    },
    {
      "key": "methane_gwp",
      "unit": "tCO2e/tCH4",
      "scope_selectors": []
    }
  ],
  "calculations": [
    {
      "id": "recovered_methane_t",
      "unit": "tCH4",
      "aggregation": "sum",
      "expression": {
        "op": "multiply",
        "args": [
          {
            "field": "biogas_m3"
          },
          {
            "field": "methane_fraction"
          },
          {
            "factor": "methane_density"
          }
        ]
      }
    },
    {
      "id": "estimated_reduction_tco2e",
      "unit": "tCO2e",
      "aggregation": "sum",
      "expression": {
        "op": "multiply",
        "args": [
          {
            "calculation": "recovered_methane_t"
          },
          {
            "op": "subtract",
            "args": [
              {
                "constant": 1
              },
              {
                "baseline": "baseline_capture_fraction"
              }
            ]
          },
          {
            "factor": "methane_gwp"
          }
        ]
      }
    }
  ],
  "runtime": {
    "dsl_version": 1,
    "precision_digits": 28,
    "rounding": "half_even",
    "output_scale": 4,
    "on_missing": "error",
    "on_division_by_zero": "error"
  }
}$metric$::jsonb);

-- Hệ số MẪU riêng, không đọc/ghi emission_factors legacy.
insert into public.methodology_factors(methodology_id,key,value,unit,source) values
 ('20000000-0000-4000-8000-000000000004','methane_density',0.00067,'tCH4/m3_CH4','DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.'),
 ('20000000-0000-4000-8000-000000000004','methane_gwp',27.0,'tCO2e/tCH4','DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.');
update public.methodologies set status='published' where id='20000000-0000-4000-8000-000000000004';

-- Placeholder cho cả PDF/DOCX; thay bằng bản ready có file thật ở bước triển khai sau.
insert into public.report_templates(standard_id,methodology_id,version,format,status,disclaimer) values
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','demo-template-1.0','pdf','placeholder','PLACEHOLDER — chưa có tệp template chính thức. DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','demo-template-1.0','docx','placeholder','PLACEHOLDER — chưa có tệp template chính thức. DỮ LIỆU MẪU DO NHÓM TỰ SOẠN, CHƯA ĐƯỢC THẨM ĐỊNH CHUYÊN MÔN; không phải trích dẫn hay methodology được Verra/Gold Standard công nhận.');
