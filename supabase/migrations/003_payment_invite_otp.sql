create table if not exists public.payment_invite_otps (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.payment_invites(id) on delete cascade,
  code_hash text not null,
  sent_to_email text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_invite_otps_invite_id_created_idx
  on public.payment_invite_otps(invite_id, created_at desc);

create index if not exists payment_invite_otps_invite_id_expires_idx
  on public.payment_invite_otps(invite_id, expires_at);

alter table public.payment_invite_otps enable row level security;

drop policy if exists "No public invite otp access" on public.payment_invite_otps;
create policy "No public invite otp access" on public.payment_invite_otps for all using (false) with check (false);
