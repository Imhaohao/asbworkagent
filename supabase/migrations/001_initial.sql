-- Run in Supabase SQL editor (Dashboard → SQL → New query).
-- Use the same project as NEXT_PUBLIC_SUPABASE_URL in .env.local

create extension if not exists "pgcrypto";

create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  filename text,
  account_name text,
  account_code text not null,
  row_count int not null default 0
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references imports (id) on delete set null,
  account_code text not null,
  account_name text,
  txn_date date not null,
  ref_number text not null,
  txn_type text not null,
  description text,
  payee_name text,
  notes text,
  amount numeric(14, 4) not null,
  balance numeric(14, 4),
  event_key text not null,
  fiscal_year_start int not null,
  content_hash text not null,
  unique (content_hash)
);

create index if not exists idx_txn_account_fy on transactions (account_code, fiscal_year_start);
create index if not exists idx_txn_event on transactions (account_code, event_key, fiscal_year_start);
create index if not exists idx_txn_date on transactions (account_code, txn_date);
