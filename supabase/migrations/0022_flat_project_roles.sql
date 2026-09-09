-- Mọi thành viên đều có quyền ghi trong dự án còn hoạt động. Membership vẫn là ranh
-- giới tenant; người không thuộc dự án không được mở quyền.

create or replace function public.app_project_can_write(p_project_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p join public.project_members m on m.project_id = p.id
    where p.id = p_project_id and p.deleted_at is null and m.user_id = auth.uid())
$$;

create or replace function public.set_project_member(p_project_id uuid, p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.projects where id = p_project_id and deleted_at is null for update;
  if not found or public.app_project_role(p_project_id) is null then raise exception 'Chỉ thành viên dự án được quản lý thành viên'; end if;
  if p_role is null then
    delete from public.project_members where project_id = p_project_id and user_id = p_user_id;
  else
    if p_role not in ('owner','developer','viewer') then raise exception 'Role không hợp lệ'; end if;
    insert into public.project_members(project_id,user_id,role) values(p_project_id,p_user_id,p_role)
      on conflict(project_id,user_id) do update set role = excluded.role;
  end if;
end;
$$;

create or replace function public.approve_project_stage(p_project_id uuid, p_ordinal smallint) returns void
language plpgsql security definer set search_path = public as $$
declare p public.projects;
begin
  select * into p from public.projects where id = p_project_id and deleted_at is null for update;
  if not found or public.app_project_role(p_project_id) is null then raise exception 'Chỉ thành viên dự án được duyệt stage'; end if;
  if p_ordinal not between 1 and 7 or p_ordinal is null then raise exception 'Stage không hợp lệ'; end if;
  if exists(select 1 from public.project_stages where project_id = p.id and ordinal < p_ordinal and approved_at is null) then
    raise exception 'Cần duyệt các stage trước';
  end if;
  if p_ordinal >= 3 and p.standard_locked_at is null then raise exception 'Chưa khóa Standard'; end if;
  if p_ordinal >= 4 and p.methodology_locked_at is null then raise exception 'Chưa khóa Methodology'; end if;
  if p_ordinal >= 5 then
    perform public.project_validate_values((select metric_schema from public.methodologies where id=p.methodology_id),p.baseline,'baseline');
  end if;
  update public.project_stages set approved_at=now(),approved_by=auth.uid()
    where project_id=p.id and ordinal=p_ordinal and approved_at is null;
end;
$$;

create or replace function public.create_mrv_report(
  p_period_id uuid,p_template_id uuid,p_results jsonb,p_trace jsonb,p_engine_version text,
  p_requested_by uuid,p_status text default 'preview',p_output_file_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare p public.monitoring_periods; t public.report_templates; m public.methodologies;
  project_uuid uuid; result uuid; report_version integer;
begin
  select project_id into project_uuid from public.monitoring_periods where id=p_period_id;
  perform 1 from public.projects where id=project_uuid and deleted_at is null for update;
  if not found or not exists(select 1 from public.project_members where project_id=project_uuid
    and user_id=p_requested_by) then raise exception 'Người yêu cầu không có quyền tạo report'; end if;
  select * into p from public.monitoring_periods where id=p_period_id for update;
  if p.status is distinct from 'locked' then raise exception 'Chỉ tạo report từ kỳ đã khóa'; end if;
  select * into t from public.report_templates where id=p_template_id for share;
  if not found or t.methodology_id <> p.methodology_id or t.standard_id <> p.standard_id then raise exception 'Template khác methodology/standard của kỳ'; end if;
  select * into m from public.methodologies where id=p.methodology_id;
  if p_status = 'final' and (t.status <> 'ready' or m.is_sample or not m.professionally_validated or p_output_file_id is null) then
    raise exception 'Final cần methodology đã thẩm định, template thật và tệp xuất; dữ liệu MẪU chỉ preview';
  end if;
  select coalesce(max(version),0)+1 into report_version from public.mrv_reports where period_id=p.id;
  insert into public.mrv_reports(project_id,period_id,methodology_id,standard_id,template_id,version,status,
    schema_hash,schema_snapshot,baseline_snapshot,baseline_revision,factors_snapshot,data_revision,input_snapshot,
    template_snapshot,results,calculation_trace,engine_version,output_file_id,requested_by)
    values(p.project_id,p.id,p.methodology_id,p.standard_id,t.id,report_version,p_status,
      p.schema_hash,p.schema_snapshot,p.baseline_snapshot,p.baseline_revision,p.factors_snapshot,p.data_revision,p.data_snapshot,
      to_jsonb(t),p_results,p_trace,p_engine_version,p_output_file_id,p_requested_by) returning id into result;
  return result;
end;
$$;
