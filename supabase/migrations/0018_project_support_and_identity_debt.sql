-- Ba khoản nợ thiết kế sau khi nền tảng chỉ còn sản phẩm dự án Carbon:
--   1. đọc tên người đã duyệt stage qua một RPC hẹp;
--   2. ngừng nhận các vai trò toàn cục legacy khi đăng ký mới, nhưng KHÔNG thay enum;
--   3. phiên hỗ trợ chỉ đọc, có lý do, hết hạn và có dấu vết cho platform_admin.
--
-- Không BEGIN/COMMIT: migration runner sở hữu transaction. File này chỉ là đề xuất;
-- không tự áp lên Supabase production.

-- ---------------------------------------------------------------- hỗ trợ vận hành

-- Một dòng là một lần admin chủ động mở cửa xem hộ. Không cấp INSERT/UPDATE/DELETE
-- trực tiếp cho client: bản ghi chỉ được tạo qua begin_project_support(), và không có
-- đường sửa/xoá từ API. `expires_at` bị giới hạn ở 60 phút ngay tại constraint.
create table public.project_support_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  admin_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 10 and 1000),
  opened_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > opened_at),
  check (expires_at <= opened_at + interval '60 minutes')
);

create index project_support_sessions_active_idx
  on public.project_support_sessions(admin_id, project_id, expires_at desc);

alter table public.project_support_sessions enable row level security;

-- Mọi platform_admin đọc được toàn bộ audit để một admin khác cũng có thể kiểm tra
-- dấu vết. Người dùng thường không thấy cả bản ghi của chính họ.
create policy project_support_sessions_read on public.project_support_sessions
  for select to authenticated using (public.app_is_admin());

revoke all on public.project_support_sessions from public, anon, authenticated, service_role;
grant select on public.project_support_sessions to authenticated;

-- Helper nội bộ. Không cấp EXECUTE cho client; app_project_role() gọi nó dưới quyền
-- owner của SECURITY DEFINER. Kiểm lại app_is_admin ở MỖI lần đọc nên tài khoản vừa bị
-- hạ quyền mất cửa hỗ trợ ngay, dù phiên chưa hết hạn.
create function public.app_project_support_active(p_project_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_is_admin()
    and exists (
      select 1
      from public.project_support_sessions s
      where s.project_id = p_project_id
        and s.admin_id = auth.uid()
        and s.opened_at <= statement_timestamp()
        and s.expires_at > statement_timestamp()
    )
$$;

-- Chỉ platform_admin mở được phiên, phải nêu lý do, và chỉ được chọn 5–60 phút.
-- Dòng audit được INSERT trước khi quyền đọc có hiệu lực.
create function public.begin_project_support(
  p_project_id uuid,
  p_reason text,
  p_duration_minutes integer default 60
) returns table (support_session_id uuid, expires_at timestamptz)
language plpgsql volatile security definer set search_path = public as $$
declare
  normalized_reason text := trim(coalesce(p_reason, ''));
  opened timestamptz := clock_timestamp();
  new_id uuid;
  new_expiry timestamptz;
begin
  if not public.app_is_admin() then
    raise exception 'Chỉ quản trị nền tảng được mở phiên hỗ trợ';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id) then
    raise exception 'Không tìm thấy dự án';
  end if;
  if length(normalized_reason) not between 10 and 1000 then
    raise exception 'Lý do hỗ trợ phải dài từ 10 đến 1000 ký tự';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 5 and 60 then
    raise exception 'Phiên hỗ trợ phải dài từ 5 đến 60 phút';
  end if;

  new_expiry := opened + make_interval(mins => p_duration_minutes);
  insert into public.project_support_sessions(project_id, admin_id, reason, opened_at, expires_at)
  values (p_project_id, auth.uid(), normalized_reason, opened, new_expiry)
  returning id into new_id;

  return query select new_id, new_expiry;
end;
$$;

-- RLS của toàn bộ bảng dự án đã hội tụ vào app_project_role(). Phiên hỗ trợ chỉ được
-- ánh xạ thành viewer; các policy UPDATE và mọi RPC ghi vẫn đòi owner/developer hoặc
-- app_project_can_write(), mà helper đó chỉ đọc membership thật.
create or replace function public.app_project_role(p_project_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.role
       from public.project_members m
      where m.project_id = p_project_id and m.user_id = auth.uid()),
    case when public.app_project_support_active(p_project_id) then 'viewer' end
  )
$$;

-- Storage 0013 kiểm membership trực tiếp nên cần hội tụ về cùng helper. Thay đúng policy
-- đọc của bucket dự án; không mở bucket template và không thay policy ghi.
drop policy if exists project_documents_objects_read on storage.objects;
create policy project_documents_objects_read on storage.objects for select to authenticated
  using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(objects.name))[1]
        and public.app_project_role(p.id) is not null
    )
  );

-- ---------------------------------------------------------------- tên người duyệt

-- LEFT JOIN profiles theo approved_by, không theo membership hiện tại: người duyệt đã
-- rời dự án vẫn còn tên. Member thật và admin đang có phiên hỗ trợ đều được đọc; các
-- caller khác nhận tập rỗng, không được dùng RPC này làm oracle dò project/profile.
create function public.project_stage_approval_directory(p_project_id uuid)
returns table (
  stage_id uuid,
  ordinal smallint,
  approved_at timestamptz,
  approved_by uuid,
  approver_name text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.ordinal, s.approved_at, s.approved_by, p.full_name
  from public.project_stages s
  left join public.profiles p on p.id = s.approved_by
  where s.project_id = p_project_id
    and public.app_project_role(p_project_id) is not null
  order by s.ordinal
$$;

-- ---------------------------------------------------------------- user_role legacy

-- Không tái tạo enum: thay type sẽ ép rewrite profiles.role cùng default/trigger/types
-- sinh tự động, trong khi ba giá trị legacy hiện đều không có đặc quyền. Nhẹ và an toàn
-- hơn là cố định mọi đăng ký tự phục vụ ở giá trị unprivileged đang dùng làm tài khoản
-- nền tảng. platform_admin tiếp tục chỉ được cấp bằng đường quản trị DB tin cậy.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    'coop_staff'::public.user_role,
    new.raw_user_meta_data ->> 'company_name'
  );
  return new;
end;
$$;

comment on type public.user_role is
  'Legacy compatibility type. Only platform_admin is privileged; coop_manager, coop_staff and buyer are equivalent unprivileged platform accounts after migration 0016.';

-- ---------------------------------------------------------------- quyền hàm

revoke all on function public.app_project_support_active(uuid),
  public.begin_project_support(uuid, text, integer),
  public.app_project_role(uuid),
  public.project_stage_approval_directory(uuid),
  public.handle_new_user()
  from public, anon, authenticated, service_role;

grant execute on function public.begin_project_support(uuid, text, integer),
  public.app_project_role(uuid),
  public.project_stage_approval_directory(uuid)
  to authenticated;
