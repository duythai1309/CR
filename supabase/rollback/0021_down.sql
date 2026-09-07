-- Rollback này làm mất tên cột Kanban do người dùng đã đặt.

drop trigger project_tasks_guard_column on public.project_tasks;
drop function public.project_guard_task_column();
alter table public.project_tasks drop column column_id;
drop table public.project_board_columns;

-- Khôi phục NGUYÊN VĂN public.project_bootstrap() từ
-- supabase/migrations/0013_project_platform.sql dòng 577-588.
create or replace function public.project_bootstrap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members(project_id,user_id,role) values (new.id,new.created_by,'owner');
  insert into public.project_stages(project_id,ordinal,title)
    select new.id, n::smallint, title from (values
      (1,'Project Idea'),(2,'Feasibility Assessment'),(3,'Chọn Standard'),
      (4,'Chọn Methodology'),(5,'Baseline'),(6,'Additionality'),(7,'Project Design/PDD')
    ) s(n,title);
  return new;
end;
$$;
