create extension if not exists pgcrypto;

create table if not exists public.pilula_orders (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  profile_type text not null check (profile_type in ('doctor', 'patient')),
  status text not null check (status in ('created', 'checkout_open', 'awaiting_payment_method', 'awaiting_bank_transfer', 'partially_funded', 'paid', 'expired', 'cancelled', 'failed', 'refunded', 'disputed', 'requires_manual_review')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  full_name text,
  email text,
  phone text,
  specialty text,
  city_country text,
  currency text not null default 'usd' check (currency in ('usd', 'mxn')),
  payment_method text check (payment_method in ('card', 'bank_transfer')),
  amount_subtotal integer not null,
  amount_tax integer not null,
  amount_total integer not null,
  amount_received integer not null default 0,
  amount_remaining integer not null default 0,
  exchange_rate_mxn_per_usd numeric,
  exchange_rate_source text,
  exchange_rate_locked_at timestamptz,
  payment_expires_at timestamptz,
  invoice_requested boolean not null default false,
  terms_version text not null,
  terms_hash text,
  cancellation_policy_version text,
  payment_invite_id uuid,
  terms_accepted_at timestamptz,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz
);

create table if not exists public.payment_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  profile_type text not null check (profile_type in ('doctor', 'patient')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'opened', 'paid', 'expired', 'revoked')),
  market text not null check (market in ('mexico', 'international')),
  full_name text,
  email text not null,
  whatsapp text,
  payment_currency text not null check (payment_currency in ('usd', 'mxn')),
  currency text not null default 'usd' check (currency in ('usd', 'mxn')),
  allowed_payment_methods text not null check (allowed_payment_methods in ('card', 'bank_transfer', 'card_and_bank_transfer')),
  recommended_payment_method text not null check (recommended_payment_method in ('card', 'bank_transfer')),
  stripe_price_id text,
  stripe_customer_id text,
  exchange_rate_mxn_per_usd numeric,
  exchange_rate_source text,
  exchange_rate_locked_at timestamptz,
  base_amount_subtotal_usd integer not null,
  base_amount_tax_usd integer not null,
  base_amount_total_usd integer not null,
  amount_subtotal integer not null,
  amount_tax integer not null,
  amount_total integer not null,
  amount_received integer not null default 0,
  amount_remaining integer not null default 0,
  expires_at timestamptz not null,
  approved_at timestamptz,
  opened_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  terms_version text not null,
  terms_hash text not null,
  cancellation_policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text not null,
  status text not null check (status in ('processing', 'processed', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  key text not null default 'USD_MXN_RATE',
  rate numeric not null,
  source text,
  effective_from timestamptz not null,
  effective_until timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  status text not null check (status in ('active', 'inactive'))
);

create table if not exists public.invoice_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pilula_orders(id),
  rfc text not null,
  legal_name text not null,
  tax_regime text not null,
  fiscal_postal_code text not null,
  cfdi_use text not null,
  invoice_email text not null,
  status text not null default 'solicitada' check (status in ('solicitada', 'en_revision', 'requiere_correccion', 'emitida', 'enviada')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists pilula_orders_status_idx on public.pilula_orders(status);
create index if not exists pilula_orders_email_idx on public.pilula_orders(email);
create index if not exists payment_invites_status_idx on public.payment_invites(status);
create index if not exists payment_invites_profile_type_idx on public.payment_invites(profile_type);
create index if not exists payment_invites_email_idx on public.payment_invites(email);
create index if not exists payment_invites_currency_idx on public.payment_invites(payment_currency);
create index if not exists exchange_rates_status_idx on public.exchange_rates(status, effective_from);
create index if not exists invoice_requests_order_id_idx on public.invoice_requests(order_id);

alter table public.pilula_orders enable row level security;
alter table public.payment_invites enable row level security;
alter table public.stripe_events enable row level security;
alter table public.invoice_requests enable row level security;
alter table public.exchange_rates enable row level security;

drop policy if exists "No public orders access" on public.pilula_orders;
drop policy if exists "No public invites access" on public.payment_invites;
drop policy if exists "No public events access" on public.stripe_events;
drop policy if exists "No public invoice access" on public.invoice_requests;
drop policy if exists "No public exchange rates access" on public.exchange_rates;

create policy "No public orders access" on public.pilula_orders for all using (false) with check (false);
create policy "No public invites access" on public.payment_invites for all using (false) with check (false);
create policy "No public events access" on public.stripe_events for all using (false) with check (false);
create policy "No public invoice access" on public.invoice_requests for all using (false) with check (false);
create policy "No public exchange rates access" on public.exchange_rates for all using (false) with check (false);
