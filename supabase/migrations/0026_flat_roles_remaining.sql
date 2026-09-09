-- 0026 — Bốn chốt `owner` mà 0022 bỏ sót.
--
-- 0022 gỡ vai trò khỏi `app_project_can_write`, `approve_project_stage`,
-- `set_project_member` và `create_mrv_report`. Quét lại `pg_proc` cho thấy còn bốn hàm
-- nữa vẫn so `app_project_role(...) = 'owner'`, và cả bốn đều chặn thật:
--
--   create_monitoring_period  → thành viên không phải owner không tạo được kỳ giám sát
--   lock_monitoring_period    → ... và không khoá được kỳ, nên không sinh được báo cáo
--   project_lookup_invitee    → raise exception, nên không mời được ai vào dự án
--   project_member_directory  → giấu cột email của đồng đội
--
-- Điều kiện thay thế là `app_project_can_write` (là thành viên VÀ dự án chưa xoá mềm) —
-- đúng cùng một hàm mà mọi policy ghi đã dùng, nên tầng hàm và tầng RLS không lệch nhau.
--
-- KHÔNG đụng tới `project_guard_member`: chốt "không được mất owner cuối cùng" vẫn sống
-- và vẫn là lý do cột `project_members.role` còn tồn tại.

create or replace function public.create_monitoring_period(
  p_project_id uuid, p_name text, p_start_date date, p_end_date date, p_version integer default 1
) returns uuid language plpgsql security definer set search_path = public as $$
declare p public.projects; m public.methodologies; fs jsonb; result uuid;
begin
  select * into p from public.projects where id=p_project_id for update;
  if not found or not public.app_project_can_write(p_project_id) then
    raise exception 'Chỉ thành viên của dự án đang hoạt động được tạo kỳ';
  end if;
  if p.methodology_locked_at is null then raise exception 'Phải khóa lựa chọn methodology trước khi monitoring'; end if;
  select * into m from public.methodologies where id=p.methodology_id;
  perform public.project_validate_values(m.metric_schema,p.baseline,'baseline');
  select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value::text,'unit',unit,'scope',scope,'source',source)
    order by key,scope::text),'[]'::jsonb) into fs from public.methodology_factors where methodology_id=m.id;
  insert into public.monitoring_periods(project_id,methodology_id,standard_id,name,start_date,end_date,version,
    schema_snapshot,schema_hash,baseline_snapshot,baseline_revision,factors_snapshot,created_by)
    values(p.id,m.id,m.standard_id,p_name,p_start_date,p_end_date,p_version,
      m.metric_schema,m.schema_hash,p.baseline,p.baseline_revision,fs,auth.uid()) returning id into result;
  return result;
end;
$$;

create or replace function public.lock_monitoring_period(p_period_id uuid, p_expected_revision bigint)
returns void language plpgsql security definer set search_path = public as $$
declare p public.monitoring_periods; project_uuid uuid; snapshot jsonb;
begin
  select project_id into project_uuid from public.monitoring_periods where id=p_period_id;
  perform 1 from public.projects where id=project_uuid for update;
  select * into p from public.monitoring_periods where id=p_period_id for update;
  if not found or not public.app_project_can_write(p.project_id) then
    raise exception 'Chỉ thành viên của dự án đang hoạt động được khóa kỳ';
  end if;
  if p.status <> 'open' or p_expected_revision is distinct from p.data_revision then raise exception 'Kỳ khóa hoặc revision đã thay đổi'; end if;
  select jsonb_agg(to_jsonb(d) order by record_key) into snapshot from public.monitoring_data d where period_id=p.id;
  if snapshot is null then raise exception 'Kỳ chưa có dữ liệu'; end if;
  update public.monitoring_periods set status='locked',locked_at=now(),data_snapshot=snapshot where id=p.id;
end;
$$;

-- Tra người để mời. Vẫn khớp email TUYỆT ĐỐI và vẫn chỉ trả về khi người gọi là thành
-- viên của chính dự án đó, nên nó không trở thành công cụ dò xem ai có tài khoản.
create or replace function public.project_lookup_invitee(p_project_id uuid, p_email text)
returns table(user_id uuid, full_name text, already_member boolean)
language plpgsql stable security definer set search_path = public as $$
declare normalized text := lower(trim(coalesce(p_email, '')));
begin
  if public.app_project_role(p_project_id) is null then
    raise exception 'Chỉ thành viên của dự án được tra cứu người để mời';
  end if;
  if normalized = '' or length(normalized) > 320 then
    raise exception 'Email không hợp lệ';
  end if;

  return query
    select p.id,
           p.full_name,
           exists (select 1 from public.project_members m
                   where m.project_id = p_project_id and m.user_id = p.id)
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = normalized;
end;
$$;

-- Danh bạ thành viên: email hiện cho mọi thành viên, không riêng owner. Cột `role` vẫn
-- được trả về để không phải sinh lại `src/types/database.ts`; giao diện không đọc nó nữa.
-- Thứ tự chuyển sang theo tên vì thứ tự theo vai trò cũ nay không còn nghĩa gì.
create or replace function public.project_member_directory(p_project_id uuid)
returns table(user_id uuid, full_name text, role text, email text)
language sql stable security definer set search_path = public as $$
  select m.user_id,
         p.full_name,
         m.role,
         u.email
  from public.project_members m
  join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.project_id = p_project_id
    and public.app_project_role(p_project_id) is not null
  order by p.full_name
$$;
