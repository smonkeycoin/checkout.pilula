alter table public.payment_invites
  add column if not exists payment_option text not null default 'full' check (payment_option in ('full', 'deposit'));

alter table public.pilula_orders
  add column if not exists stripe_event_id text,
  add column if not exists environment text not null default 'test' check (environment in ('test', 'live')),
  add column if not exists livemode boolean not null default false,
  add column if not exists is_internal_test boolean not null default false,
  add column if not exists excluded_from_kpis boolean not null default false,
  add column if not exists payment_option text check (payment_option in ('full', 'deposit', 'balance')),
  add column if not exists total_amount integer,
  add column if not exists deposit_amount integer,
  add column if not exists balance_amount integer,
  add column if not exists amount_paid integer not null default 0,
  add column if not exists amount_due integer not null default 0,
  add column if not exists deposit_status text check (deposit_status in ('not_applicable', 'pending', 'paid', 'failed')),
  add column if not exists balance_status text check (balance_status in ('not_applicable', 'pending', 'paid', 'overdue', 'failed')),
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists balance_paid_at timestamptz,
  add column if not exists reminder_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists balance_due_at timestamptz,
  add column if not exists public_token_hash text;

update public.pilula_orders
set
  total_amount = coalesce(total_amount, amount_total),
  amount_paid = coalesce(nullif(amount_paid, 0), amount_received, 0),
  amount_due = case
    when amount_due <> 0 then amount_due
    else coalesce(amount_remaining, amount_total, 0)
  end
where total_amount is null or amount_paid = 0 or amount_due = 0;

alter table public.pilula_orders
  alter column total_amount set default 0,
  alter column total_amount set not null;

alter table public.pilula_orders
  drop constraint if exists pilula_orders_status_check;

alter table public.pilula_orders
  add constraint pilula_orders_status_check
  check (status in (
    'created',
    'checkout_open',
    'awaiting_payment_method',
    'awaiting_bank_transfer',
    'partially_funded',
    'partial',
    'paid',
    'expired',
    'cancelled',
    'failed',
    'refunded',
    'disputed',
    'requires_manual_review'
  ));

create unique index if not exists pilula_orders_stripe_checkout_session_id_idx
  on public.pilula_orders(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists pilula_orders_stripe_event_id_idx
  on public.pilula_orders(stripe_event_id);

create index if not exists pilula_orders_installment_status_idx
  on public.pilula_orders(payment_option, deposit_status, balance_status);

create index if not exists pilula_orders_public_token_hash_idx
  on public.pilula_orders(public_token_hash);

create index if not exists payment_invites_payment_option_idx
  on public.payment_invites(payment_option);

