-- Đường lui cho 0018_project_support_and_identity_debt.sql.
-- Chạy file này trong một transaction và dừng ngay khi có lỗi.

-- RPC này được tạo mới trong 0018 nên không có định nghĩa cũ để khôi phục.
drop function public.project_stage_approval_directory(uuid);

-- khôi phục nguyên văn từ supabase/migrations/0013_project_platform.sql, dòng 323–326
create or replace function public.app_project_role(p_project_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = p_project_id and user_id = auth.uid()
$$;

drop policy project_documents_objects_read on storage.objects;
-- khôi phục nguyên văn từ supabase/migrations/0013_project_platform.sql, dòng 954–956
create policy project_documents_objects_read on storage.objects for select to authenticated
  using (bucket_id='project-documents' and exists(select 1 from public.project_members m
    where m.project_id::text=(storage.foldername(objects.name))[1] and m.user_id=auth.uid()));

-- Gỡ hàm trước khi gỡ bảng vì cả hai hàm đều phụ thuộc bảng audit.
drop function public.begin_project_support(uuid, text, integer);
drop function public.app_project_support_active(uuid);

-- Index, policy RLS, grant và mọi row audit trong bảng cùng mất theo bảng.
drop table public.project_support_sessions;

-- khôi phục nguyên văn từ supabase/migrations/0012_signup_role_guard.sql, dòng 27–50
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  assigned user_role;
begin
  assigned := case requested
    when 'coop_manager' then 'coop_manager'::user_role
    when 'coop_staff' then 'coop_staff'::user_role
    when 'buyer' then 'buyer'::user_role
    else 'coop_staff'::user_role
  end;

  insert into public.profiles (id, full_name, phone, role, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    assigned,
    new.raw_user_meta_data ->> 'company_name'
  );
  return new;
end;
$$;

-- Không migration nào trước 0018 đặt comment cho type này.
comment on type public.user_role is null;

-- Khôi phục quyền của app_project_role từ 0013, dòng 977–993.
revoke all on function public.app_project_role(uuid) from public, anon, authenticated, service_role;
grant execute on function public.app_project_role(uuid) to authenticated;

-- Khôi phục quyền của handle_new_user từ 0012, dòng 52.
revoke all on function public.handle_new_user() from public, anon, authenticated;
