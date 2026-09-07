-- Mở chỗ chứa riêng cho bản nháp baseline do trợ lý sinh. Bản nháp này không phải
-- projects.baseline, không mang trạng thái thẩm định, và không được dùng làm hồ sơ chính thức.

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
    if k not in ('idea','description','feasibility','selection_advice','baseline_draft') then
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

  if p_setup ? 'baseline_draft' then
    if jsonb_typeof(p_setup->'baseline_draft') is distinct from 'object' then
      raise exception 'baseline_draft phải là object';
    end if;
    if length((p_setup->'baseline_draft')::text) > 20000 then
      raise exception 'baseline_draft vượt giới hạn 20000 ký tự';
    end if;
    if jsonb_typeof(p_setup->'baseline_draft'->'generated_at') is distinct from 'string' then
      raise exception 'baseline_draft.generated_at bắt buộc phải là chuỗi để giữ nguồn gốc bản nháp';
    end if;
    if jsonb_typeof(p_setup->'baseline_draft'->'generated_by') is distinct from 'string' then
      raise exception 'baseline_draft.generated_by bắt buộc phải là chuỗi để bản nháp không trở thành nội dung vô chủ';
    end if;
    if jsonb_typeof(p_setup->'baseline_draft'->'disclaimer') is distinct from 'string'
       or btrim(p_setup->'baseline_draft'->>'disclaimer') = '' then
      raise exception 'baseline_draft.disclaimer bắt buộc phải là chuỗi không rỗng: nội dung do máy sinh phải ghi rõ chưa được thẩm định';
    end if;
    if p_setup->'baseline_draft' ? 'values'
       and jsonb_typeof(p_setup->'baseline_draft'->'values') is distinct from 'object' then
      raise exception 'baseline_draft.values phải là object';
    end if;
    -- Bản nháp không được mang bất kỳ trường phán quyết hay trạng thái thẩm định máy đọc nào.
    for k in select jsonb_object_keys(p_setup->'baseline_draft') loop
      if k in ('verdict','feasible','is_feasible','score','rating','conclusion','decision',
               'approved','validated','final') then
        raise exception
          'baseline_draft.% không được phép: trợ lý chỉ soạn giá trị nháp để con người '
          'tự chép và tự lưu baseline; kết luận, phê duyệt và thẩm định là việc của '
          'chuyên gia, không phải trạng thái do máy sinh', k;
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
