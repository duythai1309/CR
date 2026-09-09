-- Placeholder cho bản dựng nội bộ VM0051; không có tệp biểu mẫu Verra nên tuyệt đối
-- không đánh dấu ready và không mở đường sinh báo cáo final.
insert into public.report_templates(
  standard_id,
  methodology_id,
  version,
  format,
  status,
  disclaimer
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000051',
    'vm0051-internal-1.0',
    'pdf',
    'placeholder',
    'PLACEHOLDER — chưa có tệp biểu mẫu chính thức của Verra. Artifact sinh ra chỉ phục vụ rà soát nội bộ; không phải hồ sơ nộp cho tổ chức chứng nhận.'
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000051',
    'vm0051-internal-1.0',
    'docx',
    'placeholder',
    'PLACEHOLDER — chưa có tệp biểu mẫu chính thức của Verra. Artifact sinh ra chỉ phục vụ rà soát nội bộ; không phải hồ sơ nộp cho tổ chức chứng nhận.'
  );
