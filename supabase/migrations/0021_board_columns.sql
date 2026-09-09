-- Cột Kanban do người dùng định nghĩa. `status` của task được giữ nguyên làm cầu tương
-- thích; `column_id` là nguồn sự thật mới của bảng Kanban.

create table public.project_board_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 60),
  position numeric not null,
  created_at timestamptz not null default now(),
  unique (project_id, name),
  unique (id, project_id)
);

-- RESTRICT cố ý chặn xoá cột còn chứa task. FK ghép giữ task và cột trong cùng dự án;
-- chỉ tham chiếu id sẽ cho phép gắn task của dự án này vào cột của dự án khác.
alter table public.project_tasks
  add column column_id uuid references public.project_board_columns(id) on delete restrict,
  add constraint project_tasks_column_project_fk
    foreign key (column_id,project_id)
    references public.project_board_columns(id,project_id) on delete restrict;

create index tasks_column_project_idx on public.project_tasks(column_id,project_id);

alter table public.project_board_columns enable row level security;

-- Cùng khuôn quyền với project_tasks: thành viên được đọc, owner/developer được ghi.
create policy project_board_columns_read on public.project_board_columns
  for select to authenticated
  using (public.app_project_role(project_id) is not null);
create policy project_board_columns_insert on public.project_board_columns
  for insert to authenticated
  with check (public.app_project_can_write(project_id));
create policy project_board_columns_update on public.project_board_columns
  for update to authenticated
  using (public.app_project_can_write(project_id))
  with check (public.app_project_can_write(project_id));
create policy project_board_columns_delete on public.project_board_columns
  for delete to authenticated
  using (public.app_project_can_write(project_id));

revoke all on public.project_board_columns from public, anon, authenticated, service_role;
grant select on public.project_board_columns to authenticated;
grant insert(project_id,name,position) on public.project_board_columns to authenticated;
grant update(name,position) on public.project_board_columns to authenticated;
grant delete on public.project_board_columns to authenticated;
grant update(column_id) on public.project_tasks to authenticated;

-- Chặn INSERT project trong khe giữa thay hàm và backfill. Runner bọc cả migration trong
-- một transaction, nên dự án đã bắt đầu tạo sẽ hoàn tất trước khi seed và dự án mới sẽ
-- chỉ được tạo sau khi bootstrap mới đã có hiệu lực.
lock table public.projects in share row exclusive mode;

-- Dự án mới nhận bốn cột trong cùng transaction với owner và bảy mục hồ sơ.
create or replace function public.project_bootstrap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members(project_id,user_id,role) values (new.id,new.created_by,'owner');
  insert into public.project_stages(project_id,ordinal,title)
    select new.id, n::smallint, title from (values
      (1,'Project Idea'),(2,'Feasibility Assessment'),(3,'Chọn Standard'),
      (4,'Chọn Methodology'),(5,'Baseline'),(6,'Additionality'),(7,'Project Design/PDD')
    ) s(n,title);
  insert into public.project_board_columns(project_id,name,position)
    select new.id, name, position from (values
      ('Chưa làm',1000::numeric),('Đang làm',2000::numeric),
      ('Xong',3000::numeric),('Vướng',4000::numeric)
    ) c(name,position);
  return new;
end;
$$;

-- Backfill mọi dự án hiện hữu.
insert into public.project_board_columns(project_id,name,position)
select p.id, c.name, c.position
from public.projects p
cross join (values
  ('Chưa làm',1000::numeric),('Đang làm',2000::numeric),
  ('Xong',3000::numeric),('Vướng',4000::numeric)
) c(name,position);

update public.project_tasks t
set column_id = c.id
from public.project_board_columns c
where c.project_id = t.project_id
  and c.name = case t.status
    when 'todo' then 'Chưa làm'
    when 'in_progress' then 'Đang làm'
    when 'done' then 'Xong'
    when 'blocked' then 'Vướng'
  end;

-- Lớp chặn DB: mọi task mới không chỉ định cột sẽ vào cột đầu tiên của chính dự án.
create function public.project_guard_task_column() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.column_id is null then
    select c.id into new.column_id
    from public.project_board_columns c
    where c.project_id = new.project_id
    order by c.position, c.id
    limit 1;
  end if;
  if new.column_id is null then
    raise exception 'Không thể tạo công việc khi dự án chưa có cột Kanban';
  end if;
  return new;
end;
$$;
create trigger project_tasks_guard_column before insert on public.project_tasks
  for each row execute function public.project_guard_task_column();

revoke all on function public.project_guard_task_column()
  from public, anon, authenticated, service_role;

-- Trigger phải tồn tại trước NOT NULL để INSERT cũ không truyền column_id vẫn được gán cột.
alter table public.project_tasks alter column column_id set not null;
