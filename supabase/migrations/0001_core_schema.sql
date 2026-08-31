-- Agri-Carbon Pass — schema lõi: định danh, đối tượng canh tác, mùa vụ, nhật ký.

create extension if not exists postgis;

-- ---------------------------------------------------------------- enums
create type user_role as enum ('platform_admin', 'coop_manager', 'coop_staff', 'buyer');
create type crop_type as enum ('rice');

-- Chế độ nước trong vụ — quyết định hệ số SFw của IPCC.
create type water_regime as enum ('continuously_flooded', 'single_aeration', 'multiple_aeration');

-- Chế độ nước trước vụ — quyết định hệ số SFp.
create type preseason_water as enum ('non_flooded_short', 'non_flooded_long', 'flooded_pre');

-- Loại chất hữu cơ bón vào — quyết định hệ số CFOA trong SFo.
create type organic_amendment as enum (
  'straw_incorporated_short',
  'straw_incorporated_long',
  'compost',
  'farmyard_manure',
  'green_manure'
);

create type straw_method as enum ('incorporated_short', 'incorporated_long', 'removed', 'burned', 'mulched');
create type water_event_type as enum ('drainage', 'reflood');

-- ---------------------------------------------------------------- định danh
create table cooperatives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  province text not null,
  district text,
  commune text,
  contact_name text,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'coop_staff',
  cooperative_id uuid references cooperatives (id) on delete set null,
  company_name text,
  created_at timestamptz not null default now()
);

create index profiles_cooperative_idx on profiles (cooperative_id);

-- Tạo profile tự động khi có tài khoản mới; vai trò lấy từ metadata lúc đăng ký.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'coop_staff'),
    new.raw_user_meta_data ->> 'company_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- nông hộ & thửa ruộng
create table farmers (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  full_name text not null,
  phone text,
  village text,
  member_code text,
  created_at timestamptz not null default now(),
  unique (cooperative_id, member_code)
);

create index farmers_cooperative_idx on farmers (cooperative_id);

create table fields (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  farmer_id uuid not null references farmers (id) on delete cascade,
  name text not null,
  geom geometry (Polygon, 4326),
  -- Diện tích nông dân khai, giữ lại để đối chiếu với diện tích đo từ polygon.
  declared_area_ha numeric(10, 4),
  area_ha numeric(10, 4),
  soil_type text,
  created_at timestamptz not null default now()
);

create index fields_geom_idx on fields using gist (geom);
create index fields_cooperative_idx on fields (cooperative_id);
create index fields_farmer_idx on fields (farmer_id);

-- Diện tích luôn suy ra từ hình học, không tin số người dùng gõ vào.
create function sync_field_area() returns trigger
language plpgsql as $$
begin
  if new.geom is not null then
    new.area_ha := round((st_area(new.geom::geography) / 10000)::numeric, 4);
  end if;
  return new;
end;
$$;

create trigger fields_sync_area
  before insert or update of geom on fields
  for each row execute function sync_field_area();

-- ---------------------------------------------------------------- mùa vụ
create table seasons (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  name text not null,
  crop crop_type not null default 'rice',
  start_date date not null,
  end_date date,
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);

create index seasons_cooperative_idx on seasons (cooperative_id);

-- Một thửa trong một vụ. Nhật ký gắn vào đây, không gắn thẳng vào thửa,
-- vì cùng thửa qua các vụ cho kết quả phát thải khác nhau.
create table field_seasons (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  season_id uuid not null references seasons (id) on delete cascade,
  field_id uuid not null references fields (id) on delete cascade,
  transplant_date date,
  harvest_date date,
  preseason_water preseason_water not null default 'non_flooded_short',
  baseline_water_regime water_regime not null default 'continuously_flooded',
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (season_id, field_id)
);

create index field_seasons_season_idx on field_seasons (season_id);
create index field_seasons_field_idx on field_seasons (field_id);

-- ---------------------------------------------------------------- nhật ký canh tác
create table water_events (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  field_season_id uuid not null references field_seasons (id) on delete cascade,
  event_date date not null,
  event_type water_event_type not null,
  water_depth_cm numeric(5, 1),
  note text,
  created_at timestamptz not null default now()
);

create index water_events_field_season_idx on water_events (field_season_id);

create table fertilizer_applications (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  field_season_id uuid not null references field_seasons (id) on delete cascade,
  applied_date date not null,
  product_name text,
  is_organic boolean not null default false,
  organic_type organic_amendment,
  amount_kg numeric(12, 2) not null check (amount_kg >= 0),
  n_content_pct numeric(5, 2) not null default 0 check (n_content_pct between 0 and 100),
  dry_matter_pct numeric(5, 2) check (dry_matter_pct between 0 and 100),
  note text,
  created_at timestamptz not null default now(),
  -- Phân hữu cơ bắt buộc khai loại, vì mỗi loại có hệ số CFOA khác nhau.
  constraint organic_needs_type check (not is_organic or organic_type is not null)
);

create index fertilizer_field_season_idx on fertilizer_applications (field_season_id);

create table straw_management (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  field_season_id uuid not null references field_seasons (id) on delete cascade unique,
  method straw_method not null,
  baseline_method straw_method not null default 'burned',
  amount_t_per_ha numeric(10, 3),
  days_before_cultivation integer,
  note text,
  created_at timestamptz not null default now()
);

create table evidence_photos (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  field_season_id uuid not null references field_seasons (id) on delete cascade,
  storage_path text not null,
  caption text,
  taken_at timestamptz,
  lat numeric(9, 6),
  lng numeric(9, 6),
  created_at timestamptz not null default now()
);

create index evidence_field_season_idx on evidence_photos (field_season_id);
