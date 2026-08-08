alter table public.payment_invites
  add column if not exists fx_rate_locked numeric,
  add column if not exists fx_locked_at timestamptz,
  add column if not exists base_currency text,
  add column if not exists charge_currency text,
  add column if not exists total_amount_mxn integer;

alter table public.pilula_orders
  add column if not exists stripe_price_id text,
  add column if not exists fx_rate_locked numeric,
  add column if not exists fx_locked_at timestamptz,
  add column if not exists base_currency text,
  add column if not exists charge_currency text,
  add column if not exists total_amount_mxn integer;

update public.payment_invites
set
  fx_rate_locked = coalesce(fx_rate_locked, exchange_rate_mxn_per_usd),
  fx_locked_at = coalesce(fx_locked_at, exchange_rate_locked_at),
  base_currency = coalesce(base_currency, 'USD'),
  charge_currency = coalesce(charge_currency, upper(currency)),
  total_amount_mxn = coalesce(total_amount_mxn, case when currency = 'mxn' then amount_total else null end)
where fx_rate_locked is null
   or fx_locked_at is null
   or base_currency is null
   or charge_currency is null
   or (currency = 'mxn' and total_amount_mxn is null);

update public.pilula_orders
set
  fx_rate_locked = coalesce(fx_rate_locked, exchange_rate_mxn_per_usd),
  fx_locked_at = coalesce(fx_locked_at, exchange_rate_locked_at),
  base_currency = coalesce(base_currency, 'USD'),
  charge_currency = coalesce(charge_currency, upper(currency)),
  total_amount_mxn = coalesce(total_amount_mxn, case when currency = 'mxn' then amount_total else null end)
where fx_rate_locked is null
   or fx_locked_at is null
   or base_currency is null
   or charge_currency is null
   or (currency = 'mxn' and total_amount_mxn is null);

create table if not exists public.fx_rate_changes (
  id uuid primary key default gen_random_uuid(),
  key text not null default 'USD_MXN_RATE',
  previous_rate numeric,
  new_rate numeric not null,
  changed_by text,
  changed_at timestamptz not null default now()
);

alter table public.fx_rate_changes enable row level security;

drop policy if exists "No public fx rate changes access" on public.fx_rate_changes;
create policy "No public fx rate changes access" on public.fx_rate_changes for all using (false) with check (false);

create index if not exists fx_rate_changes_changed_at_idx on public.fx_rate_changes(changed_at desc);
create index if not exists payment_invites_fx_locked_idx on public.payment_invites(fx_rate_locked, charge_currency);
create index if not exists pilula_orders_fx_locked_idx on public.pilula_orders(fx_rate_locked, charge_currency);

with previous as (
  select rate
  from public.exchange_rates
  where status = 'active'
  order by effective_from desc
  limit 1
),
closed as (
  update public.exchange_rates
  set status = 'inactive',
      effective_until = coalesce(effective_until, now())
  where status = 'active'
    and (source is distinct from 'PILULA_MANAGED_FIXED' or rate <> 17.50)
  returning rate
),
inserted as (
  insert into public.exchange_rates(key, rate, source, effective_from, effective_until, created_by, status)
  select 'USD_MXN_RATE', 17.50, 'PILULA_MANAGED_FIXED', now(), null, 'migration_008_fixed_mxn_fx_prices', 'active'
  where not exists (
    select 1
    from public.exchange_rates
    where status = 'active'
      and source = 'PILULA_MANAGED_FIXED'
      and rate = 17.50
      and (effective_until is null or effective_until >= now())
  )
  returning rate
)
insert into public.fx_rate_changes(key, previous_rate, new_rate, changed_by, changed_at)
select 'USD_MXN_RATE', (select rate from previous), 17.50, 'migration_008_fixed_mxn_fx_prices', now()
where exists (select 1 from inserted);
