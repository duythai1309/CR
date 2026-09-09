-- Khôi phục nguyên logic public.project_validate_setup() từ
-- supabase/migrations/0017_project_setup.sql dòng 30-72.
--
-- Rollback này KHÔNG xoá dữ liệu baseline_draft đã ghi. Phải dọn các khoá baseline_draft
-- trước khi hạ cấp nếu không muốn dữ liệu đó bị validator cũ chặn ở lần UPDATE tiếp theo.

create or replace function public.project_validate_setup(p_setup jsonb) returns void
language plpgsql immutable set search_path = public as $$
declare k text;
begin
  if jsonb_typeof(p_setup) is distinct from 'object' then
    raise exception 'setup phải là object';
  end if;
  if length(p_setup::text) > 200000 then
    raise exception 'setup vượt 200KB';
  end if;

  for k in select jsonb_object_keys(p_setup) loop
    if k not in ('idea','description','feasibility','selection_advice') then
      raise exception 'Khoá setup không nằm trong whitelist: %', k;
    end if;
  end loop;

  if p_setup ? 'feasibility' then
    if jsonb_typeof(p_setup->'feasibility') is distinct from 'object' then
      raise exception 'feasibility phải là object';
    end if;
    -- Không nhận bất kỳ trường phán quyết máy đọc nào.
    for k in select jsonb_object_keys(p_setup->'feasibility') loop
      if k in ('verdict','feasible','is_feasible','score','rating','conclusion','decision') then
        raise exception
          'feasibility.% không được phép: đánh giá khả thi do AI hỗ trợ chỉ ghi nhận '
          'điều đã biết, điều còn thiếu và bằng chứng cần thu thập; kết luận là việc '
          'của chuyên gia, ghi trong notes', k;
      end if;
    end loop;
  end if;

  if p_setup ? 'selection_advice' and jsonb_typeof(p_setup->'selection_advice') is distinct from 'object' then
    raise exception 'selection_advice phải là object';
  end if;
  if p_setup ? 'idea' and jsonb_typeof(p_setup->'idea') is distinct from 'object' then
    raise exception 'idea phải là object';
  end if;
  if p_setup ? 'description' and jsonb_typeof(p_setup->'description') is distinct from 'string' then
    raise exception 'description phải là chuỗi';
  end if;
end;
$$;
