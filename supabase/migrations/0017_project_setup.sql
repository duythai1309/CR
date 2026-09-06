-- Luồng khởi tạo dự án có AI hỗ trợ: ý tưởng → mô tả → đánh giá khả thi → chọn
-- Standard/Methodology.
--
-- Bốn bước đó khớp đúng stage 1–4 đã có trong 0013; migration này KHÔNG đổi bảy stage,
-- không đổi `approve_project_stage`, không đổi bất cứ policy nào. Nó chỉ thêm một chỗ
-- để lưu dữ liệu khởi tạo mà trước đây không có nhà: mô tả có cấu trúc của ý tưởng, kết
-- quả phiên đánh giá khả thi, và gợi ý lựa chọn do trợ lý sinh ra.
--
-- Vì sao là một cột JSONB chứ không phải bảng riêng: dữ liệu này là 1–1 với dự án, chỉ
-- đọc/ghi trọn gói theo dự án, và hình dạng còn thay đổi khi luồng được hoàn thiện. Tách
-- bảng lúc này chỉ thêm FK và join mà không mua được gì.

alter table public.projects
  add column setup jsonb not null default '{}'::jsonb
    check (jsonb_typeof(setup) = 'object');

comment on column public.projects.setup is
  'Dữ liệu khởi tạo dự án: idea, description, feasibility, selection_advice. '
  'Không chứa kết luận khả thi có/không — xem project_validate_setup().';

-- Validator: chặn hai thứ ở tầng DB thay vì tin vào giao diện.
--
-- 1. Kích thước — JSONB không tự giới hạn, một client hỏng có thể nhồi hàng MB.
-- 2. **Kết luận khả thi**. Đây mới là lý do thật sự của hàm này. Trợ lý AI hỗ trợ soạn
--    phần đánh giá khả thi, và một phán quyết "dự án này KHẢ THI" do mô hình sinh ra,
--    nằm trong hồ sơ tín chỉ carbon, là thứ có thể gây hậu quả ngoài phần mềm. Cấu trúc
--    được phép chỉ gồm: điều đã biết, điều còn thiếu, và bằng chứng cần thu thập.
--    Ai muốn kết luận thì tự ghi trong `notes` với tư cách con người, không phải một
--    trường máy đọc được để giao diện tô xanh.
create function public.project_validate_setup(p_setup jsonb) returns void
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

-- Gắn validator vào chính đường ghi. Trigger cũ `project_guard_project` giữ nguyên vai
-- trò của nó; đây là trigger riêng để hai mối quan tâm không lẫn vào nhau.
create function public.project_guard_setup() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.setup is distinct from old.setup then
    perform public.project_validate_setup(new.setup);
  end if;
  return new;
end;
$$;
create trigger projects_guard_setup before insert or update on public.projects
  for each row execute function public.project_guard_setup();

-- 0013 cấp UPDATE theo từng cột; cột mới phải được cấp riêng, nếu không giao diện ghi
-- vào sẽ nhận "permission denied for table projects" thay vì lỗi nói đúng nguyên nhân.
grant update(setup) on public.projects to authenticated;

revoke all on function public.project_validate_setup(jsonb), public.project_guard_setup()
  from public, anon, authenticated, service_role;
