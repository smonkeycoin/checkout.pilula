alter table public.pilula_orders
  add column if not exists stripe_price_id text,
  add column if not exists stripe_event_id text,
  add column if not exists environment text not null default 'test' check (environment in ('test', 'live')),
  add column if not exists livemode boolean not null default false,
  add column if not exists buyer_confirmation_sent_at timestamptz,
  add column if not exists buyer_confirmation_email_id text,
  add column if not exists owner_confirmation_sent_at timestamptz,
  add column if not exists owner_confirmation_email_id text;

alter table public.payment_invites
  add column if not exists environment text not null default 'test' check (environment in ('test', 'live')),
  add column if not exists livemode boolean not null default false;

alter table public.stripe_events
  add column if not exists object_id text,
  add column if not exists livemode boolean not null default false,
  add column if not exists environment text not null default 'test' check (environment in ('test', 'live')),
  add column if not exists api_version text,
  add column if not exists amount integer,
  add column if not exists currency text;

create index if not exists pilula_orders_environment_idx on public.pilula_orders(environment, livemode);
create index if not exists pilula_orders_stripe_event_id_idx on public.pilula_orders(stripe_event_id);
create index if not exists payment_invites_environment_idx on public.payment_invites(environment, livemode);
create index if not exists stripe_events_environment_idx on public.stripe_events(environment, livemode);
create index if not exists stripe_events_object_id_idx on public.stripe_events(object_id);
