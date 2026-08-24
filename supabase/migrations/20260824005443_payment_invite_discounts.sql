alter table public.payment_invites
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists amount_original_subtotal integer,
  add column if not exists amount_original_tax integer,
  add column if not exists amount_original_total integer,
  add column if not exists discount_amount_subtotal integer not null default 0,
  add column if not exists discount_amount_tax integer not null default 0,
  add column if not exists discount_amount_total integer not null default 0;

alter table public.pilula_orders
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists amount_original_subtotal integer,
  add column if not exists amount_original_tax integer,
  add column if not exists amount_original_total integer,
  add column if not exists discount_amount_subtotal integer not null default 0,
  add column if not exists discount_amount_tax integer not null default 0,
  add column if not exists discount_amount_total integer not null default 0;

update public.payment_invites
set
  discount_percent = coalesce(discount_percent, 0),
  amount_original_subtotal = coalesce(amount_original_subtotal, amount_subtotal),
  amount_original_tax = coalesce(amount_original_tax, amount_tax),
  amount_original_total = coalesce(amount_original_total, amount_total),
  discount_amount_subtotal = greatest(coalesce(amount_original_subtotal, amount_subtotal) - amount_subtotal, 0),
  discount_amount_tax = greatest(coalesce(amount_original_tax, amount_tax) - amount_tax, 0),
  discount_amount_total = greatest(coalesce(amount_original_total, amount_total) - amount_total, 0)
where amount_original_total is null
   or amount_original_subtotal is null
   or amount_original_tax is null
   or discount_amount_total is null;

update public.pilula_orders
set
  discount_percent = coalesce(discount_percent, 0),
  amount_original_subtotal = coalesce(amount_original_subtotal, amount_subtotal),
  amount_original_tax = coalesce(amount_original_tax, amount_tax),
  amount_original_total = coalesce(amount_original_total, amount_total),
  discount_amount_subtotal = greatest(coalesce(amount_original_subtotal, amount_subtotal) - amount_subtotal, 0),
  discount_amount_tax = greatest(coalesce(amount_original_tax, amount_tax) - amount_tax, 0),
  discount_amount_total = greatest(coalesce(amount_original_total, amount_total) - amount_total, 0)
where amount_original_total is null
   or amount_original_subtotal is null
   or amount_original_tax is null
   or discount_amount_total is null;

alter table public.payment_invites
  alter column amount_original_subtotal set default 0,
  alter column amount_original_tax set default 0,
  alter column amount_original_total set default 0,
  alter column amount_original_subtotal set not null,
  alter column amount_original_tax set not null,
  alter column amount_original_total set not null;

alter table public.pilula_orders
  alter column amount_original_subtotal set default 0,
  alter column amount_original_tax set default 0,
  alter column amount_original_total set default 0,
  alter column amount_original_subtotal set not null,
  alter column amount_original_tax set not null,
  alter column amount_original_total set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_invites_discount_percent_check') then
    alter table public.payment_invites
      add constraint payment_invites_discount_percent_check
      check (discount_percent >= 0 and discount_percent <= 99 and discount_percent = trunc(discount_percent));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'pilula_orders_discount_percent_check') then
    alter table public.pilula_orders
      add constraint pilula_orders_discount_percent_check
      check (discount_percent >= 0 and discount_percent <= 99 and discount_percent = trunc(discount_percent));
  end if;
end $$;

create index if not exists payment_invites_discount_percent_idx
  on public.payment_invites(discount_percent);
