-- Bảng kết quả MRV và bảng thị trường tín chỉ.

create type batch_status as enum ('draft', 'submitted', 'verified', 'listed', 'sold', 'retired');
create type order_status as enum ('pending', 'awaiting_payment', 'paid', 'cancelled', 'fulfilled');
create type payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

-- Hệ số phát thải, đánh version. Không hardcode trong mã ứng dụng để kiểm định
-- viên có thể tra được con số đến từ đâu.
create table emission_factors (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  key text not null,
  value numeric not null,
  unit text,
  description text,
  source text,
  created_at timestamptz not null default now(),
  unique (version, key)
);

-- Kết quả tính cho một thửa trong một vụ. Giữ lại toàn bộ tham số đầu vào để
-- con số tính hôm nay vẫn tái lập được sau này.
create table emission_calculations (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  field_season_id uuid not null references field_seasons (id) on delete cascade,
  methodology_version text not null,
  area_ha numeric(10, 4) not null,
  cultivation_days integer not null,
  baseline_ch4_kg numeric(14, 4) not null,
  project_ch4_kg numeric(14, 4) not null,
  baseline_n2o_kg numeric(14, 4) not null,
  project_n2o_kg numeric(14, 4) not null,
  baseline_burning_co2e_t numeric(14, 4) not null default 0,
  project_burning_co2e_t numeric(14, 4) not null default 0,
  baseline_co2e_t numeric(14, 4) not null,
  project_co2e_t numeric(14, 4) not null,
  reduction_co2e_t numeric(14, 4) not null,
  inputs jsonb not null,
  factors jsonb not null,
  is_current boolean not null default true,
  computed_at timestamptz not null default now(),
  computed_by uuid references auth.users (id) on delete set null
);

-- Mỗi thửa-vụ chỉ có đúng một kết quả đang hiệu lực; các bản cũ giữ lại làm lịch sử.
create unique index emission_calc_current_idx
  on emission_calculations (field_season_id) where is_current;
create index emission_calc_coop_idx on emission_calculations (cooperative_id);

-- ---------------------------------------------------------------- thị trường
create table credit_batches (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives (id) on delete cascade,
  season_id uuid references seasons (id) on delete set null,
  code text not null unique,
  name text not null,
  description text,
  status batch_status not null default 'draft',
  gross_co2e_t numeric(14, 4) not null default 0,
  -- Đệm rủi ro giữ lại theo thông lệ Verra, không bán ra.
  buffer_pct numeric(5, 2) not null default 15 check (buffer_pct between 0 and 100),
  issuable_co2e_t numeric(14, 4) not null default 0,
  sold_co2e_t numeric(14, 4) not null default 0,
  price_per_t_vnd numeric(14, 2),
  platform_fee_pct numeric(5, 2) not null default 12 check (platform_fee_pct between 0 and 100),
  listed_at timestamptz,
  created_at timestamptz not null default now()
);

create index credit_batches_coop_idx on credit_batches (cooperative_id);
create index credit_batches_status_idx on credit_batches (status);

create table batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references credit_batches (id) on delete cascade,
  emission_calculation_id uuid not null references emission_calculations (id) on delete restrict,
  field_season_id uuid not null references field_seasons (id) on delete restrict,
  co2e_t numeric(14, 4) not null,
  unique (batch_id, field_season_id)
);

create index batch_items_batch_idx on batch_items (batch_id);

create table orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  batch_id uuid not null references credit_batches (id) on delete restrict,
  buyer_id uuid not null references profiles (id) on delete restrict,
  quantity_co2e_t numeric(14, 4) not null check (quantity_co2e_t > 0),
  unit_price_vnd numeric(14, 2) not null check (unit_price_vnd >= 0),
  total_vnd numeric(16, 2) not null check (total_vnd >= 0),
  status order_status not null default 'pending',
  buyer_note text,
  created_at timestamptz not null default now()
);

create index orders_buyer_idx on orders (buyer_id);
create index orders_batch_idx on orders (batch_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  provider text not null default 'sandbox',
  provider_ref text,
  amount_vnd numeric(16, 2) not null,
  status payment_status not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index payments_order_idx on payments (order_id);

-- Chia doanh thu: phần lớn về nông dân, nền tảng giữ phí duy trì hệ thống.
create table revenue_shares (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade unique,
  platform_amount_vnd numeric(16, 2) not null,
  cooperative_amount_vnd numeric(16, 2) not null,
  farmer_amount_vnd numeric(16, 2) not null,
  breakdown jsonb not null,
  created_at timestamptz not null default now()
);
