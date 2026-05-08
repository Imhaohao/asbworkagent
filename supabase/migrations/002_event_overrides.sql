create table if not exists event_overrides (
  id uuid primary key default gen_random_uuid(),
  account_code text not null,
  event_key text not null,
  fiscal_year_start int not null,
  display_name text,
  description text,
  projected_revenue numeric(14, 4),
  projected_expenses numeric(14, 4),
  group_name text,
  updated_at timestamptz not null default now(),
  unique (account_code, event_key, fiscal_year_start)
);
