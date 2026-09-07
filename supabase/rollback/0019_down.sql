-- Đường lui cho 0019_vm0051.sql.
-- Khối DO là một statement nguyên tử: nếu kiểm tra hoặc DELETE lỗi, việc tắt trigger
-- và mọi thay đổi dữ liệu trong khối cũng được hoàn tác.

do $$
declare
  vm0051_id constant uuid := '20000000-0000-4000-8000-000000000051';
begin
  -- Các FK trực tiếp trong 0013 đều ON DELETE RESTRICT. Không tự xoá dữ liệu thật
  -- đã chọn/dẫn VM0051; dừng trước khi đụng row seed để người vận hành xử lý riêng.
  if exists (select 1 from public.report_templates where methodology_id = vm0051_id) then
    raise exception 'Không thể rollback 0019: report_templates đang tham chiếu VM0051';
  end if;
  if exists (select 1 from public.projects where methodology_id = vm0051_id) then
    raise exception 'Không thể rollback 0019: projects đang chọn VM0051';
  end if;
  if exists (select 1 from public.monitoring_periods where methodology_id = vm0051_id) then
    raise exception 'Không thể rollback 0019: monitoring_periods đang tham chiếu VM0051';
  end if;

  -- methodologies_guard (0013, dòng 493–494) chặn mọi DELETE methodology và chặn
  -- UPDATE khi row cũ đã published.
  -- methodology_factors_guard (0013, dòng 508–509) cũng chặn DELETE factor của
  -- methodology published. Chỉ tắt hai trigger trong phạm vi statement nguyên tử này.
  alter table public.methodologies disable trigger methodologies_guard;
  alter table public.methodology_factors disable trigger methodology_factors_guard;

  delete from public.methodology_factors
  where methodology_id = vm0051_id;

  delete from public.methodologies
  where id = vm0051_id;

  alter table public.methodology_factors enable trigger methodology_factors_guard;
  alter table public.methodologies enable trigger methodologies_guard;
end
$$;

-- Không xoá standard VCS: 0014 cũng seed row này và dữ liệu khác có thể phụ thuộc nó.
