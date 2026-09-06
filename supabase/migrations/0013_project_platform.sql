-- Nền tảng dự án theo PLAN.md. CHỈ LÀ FILE ĐỀ XUẤT, chưa áp lên DB.
-- Chỉ thêm đối tượng mới; không đổi user_role/auth/chat/legacy/evidence.
-- Runner phải bọc toàn bộ file trong một transaction, sau 0012, khi đã được duyệt.
-- Đường kiểm chứng chuẩn: psql -X -1 -v ON_ERROR_STOP=1 -f <file>; không BEGIN/COMMIT lồng.

-- Hàm băm snapshot: quy ước JSONB chuẩn hoá của PostgreSQL, SHA-256 UTF-8.
create function public.project_json_hash(p_value jsonb) returns text
language sql immutable strict set search_path = public as $$
  select encode(sha256(convert_to(p_value::text, 'UTF8')), 'hex')
$$;

-- Catalog: một dòng methodology là một phiên bản, không sửa bản published.
create table public.standards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
create table public.methodologies (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.standards(id) on delete restrict,
  code text not null,
  version text not null,
  name text not null,
  project_type text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  is_sample boolean not null default true,
  professionally_validated boolean not null default false,
  disclaimer text not null,
  metric_schema jsonb not null,
  schema_hash text generated always as (public.project_json_hash(metric_schema)) stored,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (standard_id, code, version),
  unique (id, standard_id),
  check (jsonb_typeof(metric_schema) = 'object'),
  check ((status = 'published') = (published_at is not null)),
  check (not is_sample or not professionally_validated)
);
create table public.methodology_factors (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references public.methodologies(id) on delete restrict,
  key text not null,
  value numeric not null check (value::text not in ('NaN','Infinity','-Infinity')),
  unit text not null,
  scope jsonb not null default '{}'::jsonb check (jsonb_typeof(scope) = 'object'),
  source text not null,
  unique (methodology_id, key, scope)
);
create table public.report_templates (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.standards(id) on delete restrict,
  methodology_id uuid not null,
  version text not null,
  format text not null check (format in ('pdf','docx')),
  status text not null default 'placeholder' check (status in ('placeholder','ready')),
  bucket_id text not null default 'methodology-templates' check (bucket_id = 'methodology-templates'),
  object_path text,
  checksum text check (checksum ~ '^[0-9a-f]{64}$'),
  mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(mapping) = 'object'),
  disclaimer text not null,
  created_at timestamptz not null default now(),
  foreign key (methodology_id, standard_id) references public.methodologies(id, standard_id) on delete restrict,
  unique (methodology_id, version, format),
  unique (id, methodology_id, standard_id),
  unique (bucket_id, object_path),
  check ((status = 'ready' and object_path is not null and checksum is not null)
    or (status = 'placeholder' and object_path is null and checksum is null)),
  check (object_path is null or split_part(object_path, '/', 1) = methodology_id::text)
);

-- Dự án và thành viên: quyền theo dự án, không suy từ vai trò HTX/buyer/admin.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  description text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  standard_id uuid references public.standards(id) on delete restrict,
  methodology_id uuid,
  standard_locked_at timestamptz,
  methodology_locked_at timestamptz,
  baseline jsonb not null default '{}'::jsonb check (jsonb_typeof(baseline) = 'object'),
  baseline_revision bigint not null default 0 check (baseline_revision >= 0),
  membership_revision bigint not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (methodology_id, standard_id) references public.methodologies(id, standard_id) on delete restrict,
  unique (id, methodology_id, standard_id),
  check (methodology_id is null or standard_id is not null),
  check (standard_locked_at is null or standard_id is not null),
  check (methodology_locked_at is null or (methodology_id is not null and standard_locked_at is not null))
);
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('owner','developer','viewer')),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id),
  unique (project_id, user_id, role)
);
create table public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  ordinal smallint not null check (ordinal between 1 and 7),
  title text not null,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  unique (project_id, ordinal),
  unique (id, project_id),
  check ((approved_at is null) = (approved_by is null))
);
create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  stage_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 300),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','in_progress','done','blocked')),
  assignee_id uuid,
  -- Cột hằng cho FK: chỉ member có role developer mới được giao task.
  assignee_role text not null default 'developer' check (assignee_role = 'developer'),
  due_at timestamptz,
  position numeric not null default 0 check (position::text not in ('NaN','Infinity','-Infinity')),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id),
  foreign key (stage_id, project_id) references public.project_stages(id, project_id) on delete restrict,
  foreign key (project_id, assignee_id, assignee_role)
    references public.project_members(project_id, user_id, role) on delete restrict
);

-- Metadata tệp bất biến: nội dung object dùng tên mới mỗi lần, không ghi đè.
create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  bucket_id text not null default 'project-documents' check (bucket_id = 'project-documents'),
  object_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (id, project_id),
  unique (bucket_id, object_path),
  check (split_part(object_path, '/', 1) = project_id::text),
  check (split_part(object_path, '/', 2) = uploaded_by::text),
  check (length(split_part(object_path, '/', 3)) > 0)
);
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  task_id uuid not null,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 20000),
  created_at timestamptz not null default now(),
  foreign key (task_id, project_id) references public.project_tasks(id, project_id) on delete restrict
);
create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  task_id uuid not null,
  file_id uuid not null,
  created_at timestamptz not null default now(),
  unique (task_id, file_id),
  foreign key (task_id, project_id) references public.project_tasks(id, project_id) on delete restrict,
  foreign key (file_id, project_id) references public.project_files(id, project_id) on delete restrict
);
create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  stage_id uuid not null,
  file_id uuid not null,
  kind text not null check (kind in ('feasibility','baseline','additionality','pdd','other')),
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  unique (project_id, kind, version),
  foreign key (stage_id, project_id) references public.project_stages(id, project_id) on delete restrict,
  foreign key (file_id, project_id) references public.project_files(id, project_id) on delete restrict
);

-- Kỳ giám sát: chụp methodology/baseline/hệ số khi tạo, đóng băng dữ liệu khi khoá.
create table public.monitoring_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  methodology_id uuid not null,
  standard_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  version integer not null default 1 check (version > 0),
  status text not null default 'open' check (status in ('open','locked')),
  schema_snapshot jsonb not null,
  schema_hash text not null check (schema_hash = public.project_json_hash(schema_snapshot)),
  baseline_snapshot jsonb not null,
  baseline_revision bigint not null,
  factors_snapshot jsonb not null,
  data_revision bigint not null default 0 check (data_revision >= 0),
  data_snapshot jsonb,
  locked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, project_id),
  unique (id, project_id, methodology_id, standard_id),
  unique (project_id, start_date, end_date, version),
  foreign key (methodology_id, standard_id) references public.methodologies(id, standard_id) on delete restrict,
  foreign key (project_id, methodology_id, standard_id)
    references public.projects(id, methodology_id, standard_id) on delete restrict,
  check ((status = 'open' and locked_at is null and data_snapshot is null)
    or (status = 'locked' and locked_at is not null and data_snapshot is not null and jsonb_typeof(data_snapshot) = 'array'))
);
create table public.monitoring_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  period_id uuid not null,
  file_id uuid not null,
  mapping jsonb not null check (jsonb_typeof(mapping) = 'object'),
  mapping_hash text generated always as (public.project_json_hash(mapping)) stored,
  schema_hash text not null,
  imported_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, period_id, project_id),
  unique (period_id, file_id, mapping_hash),
  foreign key (period_id, project_id) references public.monitoring_periods(id, project_id) on delete restrict,
  foreign key (file_id, project_id) references public.project_files(id, project_id) on delete restrict
);
create table public.monitoring_data (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  period_id uuid not null,
  record_key text not null check (length(trim(record_key)) between 1 and 200),
  observed_on date not null,
  metric_values jsonb not null check (jsonb_typeof(metric_values) = 'object'),
  raw_input jsonb not null default '{}'::jsonb,
  import_id uuid,
  source_row integer check (source_row > 0),
  entered_by uuid not null references public.profiles(id) on delete restrict,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now(),
  unique (period_id, record_key),
  foreign key (period_id, project_id) references public.monitoring_periods(id, project_id) on delete restrict,
  foreign key (import_id, period_id, project_id) references public.monitoring_imports(id, period_id, project_id) on delete restrict,
  check ((import_id is null) = (source_row is null))
);
create table public.mrv_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  period_id uuid not null,
  methodology_id uuid not null,
  standard_id uuid not null,
  template_id uuid not null,
  version integer not null check (version > 0),
  status text not null check (status in ('preview','final')),
  schema_hash text not null,
  schema_snapshot jsonb not null,
  baseline_snapshot jsonb not null,
  baseline_revision bigint not null,
  factors_snapshot jsonb not null,
  data_revision bigint not null,
  input_snapshot jsonb not null,
  template_snapshot jsonb not null,
  results jsonb not null check (jsonb_typeof(results) = 'object'),
  calculation_trace jsonb not null check (jsonb_typeof(calculation_trace) = 'object'),
  engine_version text not null check (length(trim(engine_version)) > 0),
  output_file_id uuid,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  generated_at timestamptz not null default now(),
  unique (period_id, version),
  foreign key (period_id, project_id, methodology_id, standard_id)
    references public.monitoring_periods(id, project_id, methodology_id, standard_id) on delete restrict,
  foreign key (template_id, methodology_id, standard_id)
    references public.report_templates(id, methodology_id, standard_id) on delete restrict,
  foreign key (output_file_id, project_id) references public.project_files(id, project_id) on delete restrict,
  check (status <> 'final' or output_file_id is not null),
  check (schema_hash = public.project_json_hash(schema_snapshot))
);

-- Index mọi FK: PK/UNIQUE có tiền tố phù hợp đã bao một phần; dưới đây là phần còn lại.
create index methodologies_standard_idx on public.methodologies(standard_id);
create index templates_standard_idx on public.report_templates(standard_id);
create index templates_method_standard_idx on public.report_templates(methodology_id, standard_id);
create index projects_creator_idx on public.projects(created_by);
create index projects_standard_idx on public.projects(standard_id);
create index projects_method_standard_idx on public.projects(methodology_id, standard_id);
create index members_user_idx on public.project_members(user_id);
create index stages_approver_idx on public.project_stages(approved_by);
create index tasks_project_idx on public.project_tasks(project_id);
create index tasks_stage_project_idx on public.project_tasks(stage_id, project_id);
create index tasks_assignee_idx on public.project_tasks(project_id, assignee_id, assignee_role);
create index tasks_creator_idx on public.project_tasks(created_by);
create index files_project_idx on public.project_files(project_id);
create index files_uploader_idx on public.project_files(uploaded_by);
create index comments_project_idx on public.task_comments(project_id);
create index comments_task_project_idx on public.task_comments(task_id, project_id);
create index comments_author_idx on public.task_comments(author_id);
create index attachments_project_idx on public.task_attachments(project_id);
create index attachments_task_project_idx on public.task_attachments(task_id, project_id);
create index attachments_file_project_idx on public.task_attachments(file_id, project_id);
create index documents_stage_project_idx on public.project_documents(stage_id, project_id);
create index documents_file_project_idx on public.project_documents(file_id, project_id);
create index periods_project_method_idx on public.monitoring_periods(project_id, methodology_id, standard_id);
create index periods_method_standard_idx on public.monitoring_periods(methodology_id, standard_id);
create index periods_creator_idx on public.monitoring_periods(created_by);
create index imports_project_idx on public.monitoring_imports(project_id);
create index imports_period_project_idx on public.monitoring_imports(period_id, project_id);
create index imports_file_project_idx on public.monitoring_imports(file_id, project_id);
create index imports_user_idx on public.monitoring_imports(imported_by);
create index data_project_idx on public.monitoring_data(project_id);
create index data_period_project_idx on public.monitoring_data(period_id, project_id);
create index data_import_period_project_idx on public.monitoring_data(import_id, period_id, project_id);
create index data_user_idx on public.monitoring_data(entered_by);
create index reports_project_idx on public.mrv_reports(project_id);
create index reports_period_scope_idx on public.mrv_reports(period_id, project_id, methodology_id, standard_id);
create index reports_template_scope_idx on public.mrv_reports(template_id, methodology_id, standard_id);
create index reports_file_project_idx on public.mrv_reports(output_file_id, project_id);
create index reports_user_idx on public.mrv_reports(requested_by);

-- PHẦN HÀM, TRIGGER, RLS VÀ QUYỀN TIẾP THEO NẰM TRONG CÙNG TRANSACTION.

-- Helper SECURITY DEFINER đọc membership không đi qua policy của chính bảng đó.
create function public.app_project_role(p_project_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = p_project_id and user_id = auth.uid()
$$;
create function public.app_project_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select project_id from public.project_members where user_id = auth.uid()
$$;
create function public.app_project_can_write(p_project_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p join public.project_members m on m.project_id = p.id
    where p.id = p_project_id and p.deleted_at is null and m.user_id = auth.uid()
      and m.role in ('owner','developer'))
$$;

-- Kiểm tra AST thuần dữ liệu; chỉ cho phép tham chiếu hợp lệ và toán tử whitelist.
-- Calc chỉ được tham chiếu các calc trước nó, nên không thể tạo chu kỳ.
create function public.project_validate_expression(
  p_node jsonb, p_fields text[], p_baseline text[], p_factors text[], p_calcs text[], p_depth integer default 0
) returns void language plpgsql set search_path = public as $$
declare k text; child jsonb; n integer;
begin
  if p_depth > 24 or jsonb_typeof(p_node) is distinct from 'object' then
    raise exception 'AST phải là object, độ sâu không quá 24';
  end if;
  select count(*) into n from jsonb_object_keys(p_node);
  if p_node ? 'op' then
    if n <> 2 or jsonb_typeof(p_node->'args') is distinct from 'array'
      or not coalesce((p_node->>'op') in ('add','subtract','multiply','divide','min','max','pow'), false) then
      raise exception 'Toán tử AST không hợp lệ';
    end if;
    n := jsonb_array_length(p_node->'args');
    if n not between 2 and 16 or ((p_node->>'op') in ('subtract','divide','pow') and n <> 2) then
      raise exception 'Số toán hạng AST không hợp lệ';
    end if;
    for child in select value from jsonb_array_elements(p_node->'args') loop
      perform public.project_validate_expression(child,p_fields,p_baseline,p_factors,p_calcs,p_depth+1);
    end loop;
  else
    if n <> 1 then raise exception 'AST leaf phải có đúng một khóa'; end if;
    select key into k from jsonb_each(p_node);
    if k = 'constant' then
      if jsonb_typeof(p_node->k) is distinct from 'number' then raise exception 'Constant phải là số'; end if;
    elsif k = 'field' then
      if not coalesce(p_node->>k = any(p_fields),false) then raise exception 'Field AST không tồn tại'; end if;
    elsif k = 'baseline' then
      if not coalesce(p_node->>k = any(p_baseline),false) then raise exception 'Baseline AST không tồn tại'; end if;
    elsif k = 'factor' then
      if not coalesce(p_node->>k = any(p_factors),false) then raise exception 'Factor AST không tồn tại'; end if;
    elsif k = 'calculation' then
      if not coalesce(p_node->>k = any(p_calcs),false) then raise exception 'Calc phải tham chiếu calc đứng trước'; end if;
    else raise exception 'AST leaf không nằm trong whitelist';
    end if;
  end if;
end;
$$;

-- Meta-schema v1: trường scalar + nhiều observation, dùng chung cho form/import.
create function public.project_validate_metric_schema(p_schema jsonb) returns void
language plpgsql set search_path = public as $$
declare f jsonb; ids text[] := '{}'; obs text[] := '{}'; base text[] := '{}';
  factors text[] := '{}'; calcs text[] := '{}'; key text;
begin
  if jsonb_typeof(p_schema) is distinct from 'object' or p_schema->'schema_version' is distinct from '1'::jsonb
    or jsonb_typeof(p_schema->'fields') is distinct from 'array'
    or jsonb_typeof(p_schema->'factor_requirements') is distinct from 'array'
    or jsonb_typeof(p_schema->'calculations') is distinct from 'array' then
    raise exception 'metric_schema phải là envelope v1 với fields/factor_requirements/calculations';
  end if;
  if jsonb_array_length(p_schema->'fields') not between 1 and 200
    or jsonb_array_length(p_schema->'calculations') not between 1 and 100 then
    raise exception 'Schema vượt giới hạn kích thước';
  end if;
  for f in select value from jsonb_array_elements(p_schema->'fields') loop
    key := f->>'id';
    if key is null or key !~ '^[a-z][a-z0-9_]{0,63}$' or key = any(ids)
      or not coalesce(f->>'type' in ('decimal','integer','text','boolean','date','enum'),false)
      or not coalesce(f->>'scope' in ('observation','baseline'),false)
      or jsonb_typeof(f->'required') is distinct from 'boolean'
      or jsonb_typeof(f->'label') is distinct from 'object'
      or jsonb_typeof(f->'unit') is distinct from 'string' then
      raise exception 'Field metric không hợp lệ hoặc trùng id: %',key;
    end if;
    if f->>'type' = 'enum' and (jsonb_typeof(f->'options') is distinct from 'array'
      or jsonb_array_length(f->'options') = 0) then raise exception 'Enum cần options'; end if;
    ids := array_append(ids,key);
    if f->>'scope' = 'baseline' then base := array_append(base,key); else obs := array_append(obs,key); end if;
  end loop;
  for f in select value from jsonb_array_elements(p_schema->'factor_requirements') loop
    key := f->>'key';
    if key is null or key !~ '^[a-z][a-z0-9_]{0,63}$' or key = any(factors)
      or jsonb_typeof(f->'unit') is distinct from 'string' then raise exception 'Factor requirement không hợp lệ'; end if;
    factors := array_append(factors,key);
  end loop;
  for f in select value from jsonb_array_elements(p_schema->'calculations') loop
    key := f->>'id';
    if key is null or key !~ '^[a-z][a-z0-9_]{0,63}$' or key = any(calcs) or key = any(ids)
      or not coalesce(f->>'aggregation' in ('sum','mean','min','max'),false)
      or jsonb_typeof(f->'unit') is distinct from 'string' then raise exception 'Calculation không hợp lệ'; end if;
    perform public.project_validate_expression(f->'expression',obs,base,factors,calcs);
    calcs := array_append(calcs,key);
  end loop;
end;
$$;

-- Validator dữ liệu canonical tại DB: không cho caller bỏ qua type/required/bounds/enum.
-- Decimal là chuỗi ASCII chuẩn; import locale/unit phải chuyển đổi trước khi gọi RPC.
create function public.project_validate_values(p_schema jsonb, p_values jsonb, p_scope text) returns void
language plpgsql set search_path = public as $$
declare f jsonb; v jsonb; k text; s text; x numeric; allowed text[]; d date;
begin
  if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Values phải là object'; end if;
  select coalesce(array_agg(value->>'id'),'{}'::text[]) into allowed
    from jsonb_array_elements(p_schema->'fields') where value->>'scope' = p_scope;
  for k in select jsonb_object_keys(p_values) loop
    if not k = any(allowed) then raise exception 'Field không thuộc schema/scope: %',k; end if;
  end loop;
  for f in select value from jsonb_array_elements(p_schema->'fields') where value->>'scope' = p_scope loop
    k := f->>'id'; v := p_values->k; s := p_values->>k;
    if v is null or v = 'null'::jsonb then
      if (f->>'required')::boolean then raise exception 'Thiếu field %',k; end if;
      continue;
    end if;
    if f->>'type' in ('decimal','integer') then
      if (f->>'type' = 'decimal' and (jsonb_typeof(v) <> 'string' or s !~ '^-?[0-9]+(\.[0-9]+)?$'))
        or (f->>'type' = 'integer' and (jsonb_typeof(v) <> 'number' or s !~ '^-?[0-9]+$'))
        or length(s) > 100 then raise exception 'Số canonical không hợp lệ: %',k; end if;
      x := s::numeric;
      if (f#>>'{validation,minimum}' is not null and x < (f#>>'{validation,minimum}')::numeric)
        or (f#>>'{validation,maximum}' is not null and x > (f#>>'{validation,maximum}')::numeric)
        or (f#>>'{validation,exclusive_minimum}' is not null and x <= (f#>>'{validation,exclusive_minimum}')::numeric)
        or (f#>>'{validation,scale}' is not null and scale(x) > (f#>>'{validation,scale}')::integer) then
        raise exception 'Giá trị ngoài phạm vi/precision: %',k;
      end if;
    elsif f->>'type' = 'boolean' then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'Field % phải là boolean',k; end if;
    else
      if jsonb_typeof(v) <> 'string' or length(s) > 20000 then raise exception 'Field % phải là chuỗi',k; end if;
      if f->>'type' = 'enum' and not exists (select 1 from jsonb_array_elements(f->'options') o where o->>'value' = s) then
        raise exception 'Giá trị enum không hợp lệ: %',k;
      end if;
      if f->>'type' = 'date' then
        if s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Ngày phải là ISO: %',k; end if;
        d := s::date;
      end if;
    end if;
  end loop;
end;
$$;

-- Catalog bất biến sau publish/ready; chốt schema và bộ hệ số trong cùng khóa row.
create function public.project_guard_methodology() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Không xoá methodology; tạo version mới'; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then raise exception 'Methodology published bất biến'; end if;
  perform public.project_validate_metric_schema(new.metric_schema);
  if new.status = 'published' then
    if tg_op = 'INSERT' then raise exception 'Tạo draft, thêm factors rồi mới publish'; end if;
    if exists (select 1 from jsonb_array_elements(new.metric_schema->'factor_requirements') r
      where not exists (select 1 from public.methodology_factors f
        where f.methodology_id = new.id and f.key = r->>'key' and f.unit = r->>'unit')) then
      raise exception 'Chưa đủ hệ số/đơn vị để publish';
    end if;
    new.published_at := now();
  else new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger methodologies_guard before insert or update or delete on public.methodologies
  for each row execute function public.project_guard_methodology();

create function public.project_guard_factor() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid; s text;
begin
  if tg_op = 'UPDATE' and new.methodology_id <> old.methodology_id then raise exception 'Không chuyển factor sang methodology khác'; end if;
  target := case when tg_op = 'DELETE' then old.methodology_id else new.methodology_id end;
  select status into s from public.methodologies where id = target for update;
  if s is distinct from 'draft' then raise exception 'Chỉ sửa factors của methodology draft'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger methodology_factors_guard before insert or update or delete on public.methodology_factors
  for each row execute function public.project_guard_factor();

create function public.project_guard_template() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Không xoá template; tạo version mới'; end if;
  if tg_op = 'UPDATE' and (old.status = 'ready' or new.id <> old.id
    or new.methodology_id <> old.methodology_id or new.standard_id <> old.standard_id
    or new.version <> old.version or new.format <> old.format) then
    raise exception 'Template ready/định danh version bất biến';
  end if;
  return new;
end;
$$;
create trigger report_templates_guard before update or delete on public.report_templates
  for each row execute function public.project_guard_template();

-- Khóa lựa chọn ở bước 3/4; baseline thay đổi có revision, kỳ cũ giữ snapshot riêng.
create function public.project_guard_project() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Chỉ xoá mềm dự án bằng deleted_at'; end if;
  if new.id <> old.id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Không sửa định danh dự án';
  end if;
  if old.standard_locked_at is not null and (new.standard_id is distinct from old.standard_id
    or new.standard_locked_at is distinct from old.standard_locked_at) then raise exception 'Standard đã khóa'; end if;
  if old.methodology_locked_at is not null and (new.methodology_id is distinct from old.methodology_id
    or new.methodology_locked_at is distinct from old.methodology_locked_at) then raise exception 'Methodology đã khóa'; end if;
  if old.standard_locked_at is null and new.standard_locked_at is not null then new.standard_locked_at := now(); end if;
  if old.methodology_locked_at is null and new.methodology_locked_at is not null then new.methodology_locked_at := now(); end if;
  if new.methodology_id is not null and not exists (select 1 from public.methodologies
    where id = new.methodology_id and standard_id = new.standard_id and status = 'published') then
    raise exception 'Project chỉ chọn methodology published đúng Standard';
  end if;
  if new.baseline is distinct from old.baseline then new.baseline_revision := old.baseline_revision + 1; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger projects_guard before update or delete on public.projects
  for each row execute function public.project_guard_project();

-- Mỗi thay đổi membership ghi row dự án để tuần tự hóa và gây serialization failure ở RR.
-- FK assignee có role=developer tự chặn đổi role/xoá thành viên còn đang được giao task.
create function public.project_guard_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  target := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.user_id <> old.user_id) then
    raise exception 'Không sửa khóa thành viên';
  end if;
  update public.projects set membership_revision = membership_revision + 1 where id = target;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role <> 'owner') then
    if old.role = 'owner' and not exists (select 1 from public.project_members
      where project_id = target and user_id <> old.user_id and role = 'owner') then
      raise exception 'Không được mất owner cuối cùng';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger project_members_guard before insert or update or delete on public.project_members
  for each row execute function public.project_guard_member();

-- Tạo owner và đúng bảy stage ngay sau INSERT project, cùng transaction của caller.
create function public.project_bootstrap() returns trigger
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
create trigger projects_bootstrap after insert on public.projects
  for each row execute function public.project_bootstrap();

create function public.project_guard_stage() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Không xoá stage'; end if;
  if new.id <> old.id or new.project_id <> old.project_id or new.ordinal <> old.ordinal or new.title <> old.title then
    raise exception 'Bảy stage cố định';
  end if;
  return new;
end;
$$;
create trigger project_stages_guard before update or delete on public.project_stages
  for each row execute function public.project_guard_stage();

-- Thời điểm cập nhật task do DB ghi, không nhận timestamp sửa từ client.
create function public.project_touch_task() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger project_tasks_touch before update on public.project_tasks
  for each row execute function public.project_touch_task();

-- Bản ghi chứng cứ/báo cáo append-only để đường dẫn/checksum và trace không đổi.
create function public.project_reject_mutation() returns trigger
language plpgsql set search_path = public as $$
begin raise exception 'Bản ghi % bất biến; thêm bản/version mới',tg_table_name; end;
$$;
create trigger project_files_immutable before update or delete on public.project_files
  for each row execute function public.project_reject_mutation();
create trigger project_documents_immutable before update or delete on public.project_documents
  for each row execute function public.project_reject_mutation();
create trigger monitoring_imports_immutable before update or delete on public.monitoring_imports
  for each row execute function public.project_reject_mutation();
create trigger mrv_reports_immutable before update or delete on public.mrv_reports
  for each row execute function public.project_reject_mutation();

-- Khóa kỳ là một chiều; sửa sai bằng kỳ version mới, không làm đổi báo cáo đã sinh.
create function public.project_guard_period() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Không xoá kỳ giám sát'; end if;
  if old.status = 'locked' then raise exception 'Kỳ đã khóa, tạo version kỳ mới để hiệu chỉnh'; end if;
  if (to_jsonb(new) - array['status','data_revision','data_snapshot','locked_at'])
    is distinct from (to_jsonb(old) - array['status','data_revision','data_snapshot','locked_at']) then
    raise exception 'Thông tin/snapshot kỳ bất biến';
  end if;
  if new.data_revision < old.data_revision then raise exception 'Không giảm data_revision'; end if;
  return new;
end;
$$;
create trigger monitoring_periods_guard before update or delete on public.monitoring_periods
  for each row execute function public.project_guard_period();

-- Khóa cùng row kỳ cho mỗi ghi, không cho đổi scope; RPC tăng revision theo cả batch.
create function public.project_guard_monitoring_data() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.monitoring_periods;
begin
  select * into p from public.monitoring_periods
    where id = case when tg_op = 'DELETE' then old.period_id else new.period_id end for update;
  if p.status is distinct from 'open' then raise exception 'Kỳ không mở'; end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.project_id <> old.project_id or new.period_id <> old.period_id
    or new.record_key <> old.record_key) then raise exception 'Không chuyển observation sang scope khác'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.observed_on not between p.start_date and p.end_date then raise exception 'Ngày đo ngoài kỳ'; end if;
  perform public.project_validate_values(p.schema_snapshot,new.metric_values,'observation');
  if new.revision <> p.data_revision then raise exception 'Revision observation không khớp kỳ'; end if;
  return new;
end;
$$;
create trigger monitoring_data_guard before insert or update or delete on public.monitoring_data
  for each row execute function public.project_guard_monitoring_data();

-- RPC tạo project: mọi tài khoản đã có profile được tạo, không cần gia nhập HTX.
create function public.create_project(p_name text, p_description text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare result uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Cần tài khoản có profile';
  end if;
  insert into public.projects(name,description,created_by)
    values (p_name,coalesce(p_description,''),auth.uid()) returning id into result;
  return result;
end;
$$;

-- Chủ dự án thêm/đổi/xoá thành viên bằng UUID đã biết; không mở SELECT toàn bộ profiles.
-- p_role=null là xoá membership. Khóa project trước kiểm quyền, tránh owner bị thu hồi đồng thời.
create function public.set_project_member(p_project_id uuid, p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.projects where id = p_project_id and deleted_at is null for update;
  if not found or public.app_project_role(p_project_id) is distinct from 'owner' then raise exception 'Chỉ owner được quản lý thành viên'; end if;
  if p_role is null then
    delete from public.project_members where project_id = p_project_id and user_id = p_user_id;
  else
    if p_role not in ('owner','developer','viewer') then raise exception 'Role không hợp lệ'; end if;
    insert into public.project_members(project_id,user_id,role) values(p_project_id,p_user_id,p_role)
      on conflict(project_id,user_id) do update set role = excluded.role;
  end if;
end;
$$;

-- Duyệt stage tuần tự, yêu cầu standard/methodology đã chọn và khóa tại bước tương ứng.
create function public.approve_project_stage(p_project_id uuid, p_ordinal smallint) returns void
language plpgsql security definer set search_path = public as $$
declare p public.projects;
begin
  select * into p from public.projects where id = p_project_id and deleted_at is null for update;
  if not found or public.app_project_role(p_project_id) is distinct from 'owner' then raise exception 'Chỉ owner được duyệt stage'; end if;
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

-- Tạo kỳ: lấy snapshot từ DB, không nhận schema/hệ số/baseline do client tự gán.
create function public.create_monitoring_period(
  p_project_id uuid, p_name text, p_start_date date, p_end_date date, p_version integer default 1
) returns uuid language plpgsql security definer set search_path = public as $$
declare p public.projects; m public.methodologies; fs jsonb; result uuid;
begin
  select * into p from public.projects where id=p_project_id for update;
  if not found or public.app_project_role(p_project_id) is distinct from 'owner' or p.deleted_at is not null then
    raise exception 'Chỉ owner của project hoạt động được tạo kỳ';
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

-- Nhập tay/import dùng cùng RPC: tối đa 10.000 row, tất cả cùng thành công hoặc rollback.
-- File/mapping cùng kỳ được nhận diện trước revision check để retry trả lại kết quả ổn định.
create function public.save_monitoring_records(
  p_period_id uuid, p_records jsonb, p_expected_revision bigint,
  p_file_id uuid default null, p_mapping jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.monitoring_periods; r jsonb; import_uuid uuid; prior uuid; project_uuid uuid; next_rev bigint;
begin
  select project_id into project_uuid from public.monitoring_periods where id=p_period_id;
  -- Thứ tự khóa thống nhất: project trước, period sau.
  perform 1 from public.projects where id=project_uuid for update;
  select * into p from public.monitoring_periods where id=p_period_id for update;
  if not found or not public.app_project_can_write(p.project_id) then raise exception 'Không có quyền nhập monitoring'; end if;
  if p_file_id is not null then
    select id into prior from public.monitoring_imports where period_id=p.id and file_id=p_file_id
      and mapping_hash=public.project_json_hash(p_mapping);
    if prior is not null then return jsonb_build_object('import_id',prior,'already_imported',true,'data_revision',p.data_revision); end if;
  end if;
  if p.status <> 'open' or p_expected_revision is distinct from p.data_revision then raise exception 'Kỳ khóa hoặc revision đã thay đổi'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Records phải là array'; end if;
  if jsonb_array_length(p_records) not between 1 and 10000 then raise exception 'Cần 1–10000 records'; end if;
  if (select count(distinct value->>'record_key') from jsonb_array_elements(p_records)) <> jsonb_array_length(p_records) then
    raise exception 'Record key thiếu hoặc trùng trong batch';
  end if;
  if p_file_id is not null then
    insert into public.monitoring_imports(project_id,period_id,file_id,mapping,schema_hash,imported_by)
      values(p.project_id,p.id,p_file_id,p_mapping,p.schema_hash,auth.uid()) returning id into import_uuid;
  end if;
  next_rev := p.data_revision+1;
  update public.monitoring_periods set data_revision=next_rev where id=p.id;
  for r in select value from jsonb_array_elements(p_records) loop
    insert into public.monitoring_data(project_id,period_id,record_key,observed_on,metric_values,raw_input,
      import_id,source_row,entered_by,revision)
      values(p.project_id,p.id,r->>'record_key',(r->>'observed_on')::date,r->'values',coalesce(r->'raw_input','{}'::jsonb),
        import_uuid,case when import_uuid is not null then (r->>'source_row')::integer end,auth.uid(),next_rev)
      on conflict(period_id,record_key) do update set observed_on=excluded.observed_on,metric_values=excluded.metric_values,
        raw_input=excluded.raw_input,import_id=excluded.import_id,source_row=excluded.source_row,
        entered_by=excluded.entered_by,revision=excluded.revision,updated_at=now();
  end loop;
  return jsonb_build_object('import_id',import_uuid,'already_imported',false,'data_revision',next_rev);
end;
$$;

-- Xoá observation chỉ khi kỳ mở, tăng revision ngay trong transaction.
create function public.delete_monitoring_record(p_period_id uuid,p_record_key text,p_expected_revision bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare p public.monitoring_periods; project_uuid uuid;
begin
  select project_id into project_uuid from public.monitoring_periods where id=p_period_id;
  perform 1 from public.projects where id=project_uuid for update;
  select * into p from public.monitoring_periods where id=p_period_id for update;
  if not found or not public.app_project_can_write(p.project_id) then raise exception 'Không có quyền'; end if;
  if p.status <> 'open' or p_expected_revision is distinct from p.data_revision then raise exception 'Kỳ khóa hoặc revision đã thay đổi'; end if;
  delete from public.monitoring_data where period_id=p.id and record_key=p_record_key;
  if found then update public.monitoring_periods set data_revision=data_revision+1 where id=p.id returning data_revision into p.data_revision; end if;
  return p.data_revision;
end;
$$;

-- Chốt dữ liệu kỳ: snapshot có thứ tự ổn định, không cho khóa kỳ rỗng.
create function public.lock_monitoring_period(p_period_id uuid,p_expected_revision bigint) returns void
language plpgsql security definer set search_path = public as $$
declare p public.monitoring_periods; project_uuid uuid; snapshot jsonb;
begin
  select project_id into project_uuid from public.monitoring_periods where id=p_period_id;
  perform 1 from public.projects where id=project_uuid for update;
  select * into p from public.monitoring_periods where id=p_period_id for update;
  if not found or public.app_project_role(p.project_id) is distinct from 'owner'
    or not public.app_project_can_write(p.project_id) then raise exception 'Chỉ owner được khóa kỳ'; end if;
  if p.status <> 'open' or p_expected_revision is distinct from p.data_revision then raise exception 'Kỳ khóa hoặc revision đã thay đổi'; end if;
  select jsonb_agg(to_jsonb(d) order by record_key) into snapshot from public.monitoring_data d where period_id=p.id;
  if snapshot is null then raise exception 'Kỳ chưa có dữ liệu'; end if;
  update public.monitoring_periods set status='locked',locked_at=now(),data_snapshot=snapshot where id=p.id;
end;
$$;

-- Chỉ backend tin cậy được ghi kết quả tính: không cấp RPC này cho authenticated.
-- Backend phải lấy requested_by từ phiên đã xác thực, không từ body tùy ý của browser.
create function public.create_mrv_report(
  p_period_id uuid,p_template_id uuid,p_results jsonb,p_trace jsonb,p_engine_version text,
  p_requested_by uuid,p_status text default 'preview',p_output_file_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare p public.monitoring_periods; t public.report_templates; m public.methodologies;
  project_uuid uuid; result uuid; report_version integer;
begin
  select project_id into project_uuid from public.monitoring_periods where id=p_period_id;
  perform 1 from public.projects where id=project_uuid and deleted_at is null for update;
  if not found or not exists(select 1 from public.project_members where project_id=project_uuid
    and user_id=p_requested_by and role in ('owner','developer')) then raise exception 'Người yêu cầu không có quyền tạo report'; end if;
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

-- RLS tường minh trên TẤT CẢ bảng mới. Không mở rộng bất cứ policy legacy nào.
alter table public.standards enable row level security;
alter table public.methodologies enable row level security;
alter table public.methodology_factors enable row level security;
alter table public.report_templates enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_stages enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_files enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.project_documents enable row level security;
alter table public.monitoring_periods enable row level security;
alter table public.monitoring_imports enable row level security;
alter table public.monitoring_data enable row level security;
alter table public.mrv_reports enable row level security;

-- Catalog công khai cho tài khoản đăng nhập; chỉ platform_admin quản lý draft/catalog.
create policy standards_read on public.standards for select to authenticated using (true);
create policy standards_insert on public.standards for insert to authenticated with check (public.app_is_admin());
create policy standards_update on public.standards for update to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy methodologies_read on public.methodologies for select to authenticated using (status='published' or public.app_is_admin());
create policy methodologies_insert on public.methodologies for insert to authenticated with check (public.app_is_admin() and status='draft');
create policy methodologies_update on public.methodologies for update to authenticated using (public.app_is_admin() and status='draft') with check (public.app_is_admin());
create policy methodology_factors_read on public.methodology_factors for select to authenticated
  using (exists(select 1 from public.methodologies m where m.id=methodology_id and (m.status='published' or public.app_is_admin())));
create policy methodology_factors_insert on public.methodology_factors for insert to authenticated
  with check (public.app_is_admin() and exists(select 1 from public.methodologies m where m.id=methodology_id and m.status='draft'));
create policy methodology_factors_update on public.methodology_factors for update to authenticated
  using (public.app_is_admin() and exists(select 1 from public.methodologies m where m.id=methodology_id and m.status='draft'))
  with check (public.app_is_admin() and exists(select 1 from public.methodologies m where m.id=methodology_id and m.status='draft'));
create policy methodology_factors_delete on public.methodology_factors for delete to authenticated
  using (public.app_is_admin() and exists(select 1 from public.methodologies m where m.id=methodology_id and m.status='draft'));
create policy report_templates_read on public.report_templates for select to authenticated
  using (exists(select 1 from public.methodologies m where m.id=methodology_id and (m.status='published' or public.app_is_admin())));
create policy report_templates_insert on public.report_templates for insert to authenticated with check (public.app_is_admin());
create policy report_templates_update on public.report_templates for update to authenticated using (public.app_is_admin() and status='placeholder') with check (public.app_is_admin());

-- Project/member/stage: đọc theo membership; ghi tạo/member/duyệt stage chỉ qua RPC.
create policy projects_read on public.projects for select to authenticated using (public.app_project_role(id) is not null);
create policy projects_update on public.projects for update to authenticated using (public.app_project_role(id)='owner') with check (public.app_project_role(id)='owner');
create policy project_members_read on public.project_members for select to authenticated using (public.app_project_role(project_id) is not null);
create policy project_stages_read on public.project_stages for select to authenticated using (public.app_project_role(project_id) is not null);

-- Task/comments: viewer chỉ đọc; owner/developer ghi trong project còn hoạt động.
create policy project_tasks_read on public.project_tasks for select to authenticated using (public.app_project_role(project_id) is not null);
create policy project_tasks_insert on public.project_tasks for insert to authenticated with check (public.app_project_can_write(project_id) and created_by=auth.uid());
create policy project_tasks_update on public.project_tasks for update to authenticated using (public.app_project_can_write(project_id)) with check (public.app_project_can_write(project_id));
create policy project_tasks_delete on public.project_tasks for delete to authenticated using (public.app_project_can_write(project_id));
create policy task_comments_read on public.task_comments for select to authenticated using (public.app_project_role(project_id) is not null);
create policy task_comments_insert on public.task_comments for insert to authenticated with check (public.app_project_can_write(project_id) and author_id=auth.uid());
create policy task_comments_update on public.task_comments for update to authenticated using (public.app_project_can_write(project_id) and author_id=auth.uid()) with check (public.app_project_can_write(project_id) and author_id=auth.uid());
create policy task_comments_delete on public.task_comments for delete to authenticated using (public.app_project_can_write(project_id) and (author_id=auth.uid() or public.app_project_role(project_id)='owner'));

-- Files/documents append-only; attachment là liên kết có thể tháo, không xoá object.
create policy project_files_read on public.project_files for select to authenticated using (public.app_project_role(project_id) is not null);
create policy project_files_insert on public.project_files for insert to authenticated with check (public.app_project_can_write(project_id) and uploaded_by=auth.uid());
create policy task_attachments_read on public.task_attachments for select to authenticated using (public.app_project_role(project_id) is not null);
create policy task_attachments_insert on public.task_attachments for insert to authenticated with check (public.app_project_can_write(project_id));
create policy task_attachments_delete on public.task_attachments for delete to authenticated using (public.app_project_can_write(project_id));
create policy project_documents_read on public.project_documents for select to authenticated using (public.app_project_role(project_id) is not null);
create policy project_documents_insert on public.project_documents for insert to authenticated with check (public.app_project_can_write(project_id));

-- Monitoring/report chỉ SELECT qua RLS; ghi qua RPC có kiểm quyền và khóa row, fail-closed.
create policy monitoring_periods_read on public.monitoring_periods for select to authenticated using (public.app_project_role(project_id) is not null);
create policy monitoring_imports_read on public.monitoring_imports for select to authenticated using (public.app_project_role(project_id) is not null);
create policy monitoring_data_read on public.monitoring_data for select to authenticated using (public.app_project_role(project_id) is not null);
create policy mrv_reports_read on public.mrv_reports for select to authenticated using (public.app_project_role(project_id) is not null);

-- Thu quyền mặc định của Supabase trên các bảng mới, rồi cấp tối thiểu theo cột.
revoke all on public.standards,public.methodologies,public.methodology_factors,public.report_templates,
  public.projects,public.project_members,public.project_stages,public.project_tasks,public.project_files,
  public.task_comments,public.task_attachments,public.project_documents,public.monitoring_periods,
  public.monitoring_imports,public.monitoring_data,public.mrv_reports from public,anon,authenticated;
grant select on public.standards,public.methodologies,public.methodology_factors,public.report_templates,
  public.projects,public.project_members,public.project_stages,public.project_tasks,public.project_files,
  public.task_comments,public.task_attachments,public.project_documents,public.monitoring_periods,
  public.monitoring_imports,public.monitoring_data,public.mrv_reports to authenticated;
grant insert,update on public.standards,public.methodologies,public.report_templates to authenticated;
grant insert,update,delete on public.methodology_factors to authenticated;
grant update(name,description,standard_id,methodology_id,standard_locked_at,methodology_locked_at,baseline,deleted_at) on public.projects to authenticated;
grant insert on public.project_tasks,public.project_files,public.task_comments,public.task_attachments,public.project_documents to authenticated;
grant update(stage_id,title,description,status,assignee_id,due_at,position) on public.project_tasks to authenticated;
grant update(body) on public.task_comments to authenticated;
grant delete on public.project_tasks,public.task_comments,public.task_attachments to authenticated;

-- Backend tin cậy quản lý catalog/tệp và chỉ sinh report qua RPC; không cấp DML thô cho snapshot.
revoke all on public.standards,public.methodologies,public.methodology_factors,public.report_templates,
  public.projects,public.project_members,public.project_stages,public.project_tasks,public.project_files,
  public.task_comments,public.task_attachments,public.project_documents,public.monitoring_periods,
  public.monitoring_imports,public.monitoring_data,public.mrv_reports from service_role;
grant select on public.standards,public.methodologies,public.methodology_factors,public.report_templates,
  public.projects,public.project_members,public.project_stages,public.project_tasks,public.project_files,
  public.task_comments,public.task_attachments,public.project_documents,public.monitoring_periods,
  public.monitoring_imports,public.monitoring_data,public.mrv_reports to service_role;
grant insert on public.project_files to service_role;

-- Buckets MỚI riêng cho dự án và template; cố ý không ON CONFLICT để lộ trùng tên.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('project-documents','project-documents',false,52428800,array[
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','image/jpeg','image/png','image/webp']),
 ('methodology-templates','methodology-templates',false,52428800,array[
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- So sánh UUID dạng text trong path, không cast path lạ sang uuid gây lỗi truy vấn.
create policy project_documents_objects_read on storage.objects for select to authenticated
  using (bucket_id='project-documents' and exists(select 1 from public.project_members m
    where m.project_id::text=(storage.foldername(objects.name))[1] and m.user_id=auth.uid()));
create policy project_documents_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id='project-documents' and (storage.foldername(objects.name))[2]=auth.uid()::text
    and exists(select 1 from public.projects p where p.id::text=(storage.foldername(objects.name))[1]
      and public.app_project_can_write(p.id)));
create policy methodology_templates_objects_read on storage.objects for select to authenticated
  using (bucket_id='methodology-templates' and (public.app_is_admin() or exists(select 1 from public.report_templates t
    where t.bucket_id='methodology-templates' and t.object_path=objects.name and t.status='ready')));
create policy methodology_templates_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id='methodology-templates' and public.app_is_admin()
    and exists(select 1 from public.methodologies m where m.id::text=(storage.foldername(objects.name))[1]));

-- Chặn UPDATE/DELETE objects trong hai bucket mới kể cả policy permissive khác mở rộng sau này.
-- Policy restrictive chỉ phủ bucket mới; evidence/đối tượng cũ luôn qua điều kiện này.
create policy project_platform_objects_no_update on storage.objects as restrictive for update to authenticated
  using (bucket_id not in ('project-documents','methodology-templates'))
  with check (bucket_id not in ('project-documents','methodology-templates'));
create policy project_platform_objects_no_delete on storage.objects as restrictive for delete to authenticated
  using (bucket_id not in ('project-documents','methodology-templates'));

-- Quyền hàm được liệt kê tường minh; không thu hồi hàm cũ, không cấp trigger functions cho client.
revoke all on function public.project_json_hash(jsonb),
  public.app_project_role(uuid),public.app_project_ids(),public.app_project_can_write(uuid),
  public.project_validate_expression(jsonb,text[],text[],text[],text[],integer),
  public.project_validate_metric_schema(jsonb),public.project_validate_values(jsonb,jsonb,text),
  public.project_guard_methodology(),public.project_guard_factor(),public.project_guard_template(),
  public.project_guard_project(),public.project_guard_member(),public.project_bootstrap(),public.project_guard_stage(),public.project_touch_task(),
  public.project_reject_mutation(),public.project_guard_period(),public.project_guard_monitoring_data(),
  public.create_project(text,text),public.set_project_member(uuid,uuid,text),public.approve_project_stage(uuid,smallint),
  public.create_monitoring_period(uuid,text,date,date,integer),
  public.save_monitoring_records(uuid,jsonb,bigint,uuid,jsonb),public.delete_monitoring_record(uuid,text,bigint),
  public.lock_monitoring_period(uuid,bigint),public.create_mrv_report(uuid,uuid,jsonb,jsonb,text,uuid,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.project_json_hash(jsonb),public.app_project_role(uuid),public.app_project_ids(),
  public.app_project_can_write(uuid),public.create_project(text,text),public.set_project_member(uuid,uuid,text),
  public.approve_project_stage(uuid,smallint),public.create_monitoring_period(uuid,text,date,date,integer),
  public.save_monitoring_records(uuid,jsonb,bigint,uuid,jsonb),public.delete_monitoring_record(uuid,text,bigint),
  public.lock_monitoring_period(uuid,bigint) to authenticated;
grant execute on function public.project_json_hash(jsonb),
  public.create_mrv_report(uuid,uuid,jsonb,jsonb,text,uuid,text,uuid) to service_role;
