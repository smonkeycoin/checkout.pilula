alter table public.pilula_orders
  add column if not exists is_internal_test boolean not null default false,
  add column if not exists excluded_from_kpis boolean not null default false,
  add column if not exists excluded_from_kpis_at timestamptz,
  add column if not exists excluded_from_kpis_reason text,
  add column if not exists payment_option text check (payment_option in ('full', 'deposit', 'balance')),
  add column if not exists deposit_amount integer,
  add column if not exists balance_amount integer,
  add column if not exists deposit_status text check (deposit_status in ('not_applicable', 'pending', 'paid', 'failed')),
  add column if not exists balance_status text check (balance_status in ('not_applicable', 'pending', 'paid', 'overdue', 'failed')),
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists balance_paid_at timestamptz,
  add column if not exists reminder_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists balance_due_at timestamptz,
  add column if not exists public_token_hash text;

alter table public.payment_invites
  add column if not exists is_internal_test boolean not null default false,
  add column if not exists excluded_from_kpis boolean not null default false,
  add column if not exists excluded_from_kpis_at timestamptz,
  add column if not exists excluded_from_kpis_reason text;

alter table public.stripe_events
  add column if not exists is_internal_test boolean not null default false,
  add column if not exists excluded_from_kpis boolean not null default false,
  add column if not exists excluded_from_kpis_at timestamptz,
  add column if not exists excluded_from_kpis_reason text;

create index if not exists pilula_orders_live_kpi_idx
  on public.pilula_orders(environment, livemode, excluded_from_kpis, is_internal_test);

create index if not exists pilula_orders_installment_status_idx
  on public.pilula_orders(payment_option, deposit_status, balance_status);

create index if not exists pilula_orders_public_token_hash_idx
  on public.pilula_orders(public_token_hash);

create index if not exists payment_invites_live_kpi_idx
  on public.payment_invites(environment, livemode, excluded_from_kpis, is_internal_test);

create index if not exists stripe_events_live_kpi_idx
  on public.stripe_events(environment, livemode, excluded_from_kpis, is_internal_test);
