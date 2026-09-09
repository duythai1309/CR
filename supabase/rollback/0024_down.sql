-- Xoá đúng hai placeholder PDF/DOCX do migration 0024 thêm; không đụng template khác.
delete from public.report_templates
where methodology_id = '20000000-0000-4000-8000-000000000051'
  and version = 'vm0051-internal-1.0'
  and format in ('pdf', 'docx');
