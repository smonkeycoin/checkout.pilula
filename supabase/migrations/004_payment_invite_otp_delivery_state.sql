alter table public.payment_invite_otps
  add column if not exists email_sent_at timestamptz,
  add column if not exists invalidated_at timestamptz,
  add column if not exists resend_email_id text;

create index if not exists payment_invite_otps_sent_invite_idx
  on public.payment_invite_otps(invite_id, email_sent_at desc)
  where email_sent_at is not null and invalidated_at is null;
