alter table public.payment_invites
  add column if not exists token_hash text,
  add column if not exists profile_type text,
  add column if not exists status text default 'pending',
  add column if not exists market text default 'mexico',
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists whatsapp text,
  add column if not exists payment_currency text default 'usd',
  add column if not exists currency text default 'usd',
  add column if not exists allowed_payment_methods text default 'card',
  add column if not exists recommended_payment_method text default 'card',
  add column if not exists stripe_price_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists exchange_rate_mxn_per_usd numeric,
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_locked_at timestamptz,
  add column if not exists base_amount_subtotal_usd integer default 0,
  add column if not exists base_amount_tax_usd integer default 0,
  add column if not exists base_amount_total_usd integer default 0,
  add column if not exists amount_subtotal integer default 0,
  add column if not exists amount_tax integer default 0,
  add column if not exists amount_total integer default 0,
  add column if not exists amount_received integer default 0,
  add column if not exists amount_remaining integer default 0,
  add column if not exists expires_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists used_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists terms_version text default '2026-01',
  add column if not exists terms_hash text default '',
  add column if not exists cancellation_policy_version text default '2026-01',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists metadata jsonb default '{}'::jsonb;

update public.payment_invites
set
  status = coalesce(status, 'pending'),
  market = coalesce(market, 'mexico'),
  payment_currency = coalesce(payment_currency, currency, 'usd'),
  currency = coalesce(currency, payment_currency, 'usd'),
  allowed_payment_methods = coalesce(allowed_payment_methods, 'card'),
  recommended_payment_method = coalesce(recommended_payment_method, 'card'),
  base_amount_subtotal_usd = coalesce(base_amount_subtotal_usd, 0),
  base_amount_tax_usd = coalesce(base_amount_tax_usd, 0),
  base_amount_total_usd = coalesce(base_amount_total_usd, 0),
  amount_subtotal = coalesce(amount_subtotal, 0),
  amount_tax = coalesce(amount_tax, 0),
  amount_total = coalesce(amount_total, 0),
  amount_received = coalesce(amount_received, 0),
  amount_remaining = coalesce(amount_remaining, amount_total, 0),
  terms_version = coalesce(terms_version, '2026-01'),
  terms_hash = coalesce(terms_hash, ''),
  cancellation_policy_version = coalesce(cancellation_policy_version, '2026-01'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now()),
  metadata = coalesce(metadata, '{}'::jsonb);

alter table public.payment_invites
  alter column status set not null,
  alter column market set not null,
  alter column payment_currency set not null,
  alter column currency set not null,
  alter column allowed_payment_methods set not null,
  alter column recommended_payment_method set not null,
  alter column base_amount_subtotal_usd set not null,
  alter column base_amount_tax_usd set not null,
  alter column base_amount_total_usd set not null,
  alter column amount_subtotal set not null,
  alter column amount_tax set not null,
  alter column amount_total set not null,
  alter column amount_received set not null,
  alter column amount_remaining set not null,
  alter column terms_version set not null,
  alter column terms_hash set not null,
  alter column cancellation_policy_version set not null,
  alter column created_at set not null,
  alter column updated_at set not null,
  alter column metadata set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_invites_profile_type_check') then
    alter table public.payment_invites
      add constraint payment_invites_profile_type_check check (profile_type in ('doctor', 'patient'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_invites_status_check') then
    alter table public.payment_invites
      add constraint payment_invites_status_check check (status in ('pending', 'approved', 'opened', 'paid', 'expired', 'revoked'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_invites_market_check') then
    alter table public.payment_invites
      add constraint payment_invites_market_check check (market in ('mexico', 'international'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_invites_payment_currency_check') then
    alter table public.payment_invites
      add constraint payment_invites_payment_currency_check check (payment_currency in ('usd', 'mxn'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_invites_currency_check') then
    alter table public.payment_invites
      add constraint payment_invites_currency_check check (currency in ('usd', 'mxn'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_invites_allowed_payment_methods_check') then
    alter table public.payment_invites
      add constraint payment_invites_allowed_payment_methods_check check (allowed_payment_methods in ('card', 'bank_transfer', 'card_and_bank_transfer'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payment_invites_recommended_payment_method_check') then
    alter table public.payment_invites
      add constraint payment_invites_recommended_payment_method_check check (recommended_payment_method in ('card', 'bank_transfer'));
  end if;
end $$;

create unique index if not exists payment_invites_token_hash_key on public.payment_invites(token_hash);
create index if not exists payment_invites_status_idx on public.payment_invites(status);
create index if not exists payment_invites_profile_type_idx on public.payment_invites(profile_type);
create index if not exists payment_invites_email_idx on public.payment_invites(email);
create index if not exists payment_invites_currency_idx on public.payment_invites(payment_currency);
