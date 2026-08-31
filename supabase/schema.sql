-- Million Minds Tech City: private lead and OTP storage.
-- Run once in Supabase Dashboard → SQL Editor. Do not run this SQL in the browser.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  source text not null check (source in ('OTP access form', 'Website contact form')),
  first_name text not null check (char_length(first_name) between 1 and 120),
  last_name text,
  email text not null check (char_length(email) <= 160),
  country_code text,
  phone text not null check (char_length(phone) between 10 and 30),
  requirement text not null,
  budget text,
  message text,
  ip_hash text not null,
  user_agent text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_phone_idx on public.leads (phone);

create table if not exists public.otp_challenges (
  id uuid primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  phone text not null,
  otp_digest text not null,
  lead_data jsonb not null,
  ip_hash text not null,
  check (expires_at > created_at)
);

create index if not exists otp_challenges_phone_created_idx on public.otp_challenges (phone, created_at desc);
create index if not exists otp_challenges_expiry_idx on public.otp_challenges (expires_at);

-- The Data API must never expose lead or OTP rows to a browser. The Vercel
-- server uses SUPABASE_SERVICE_ROLE_KEY, which stays outside the public app.
alter table public.leads enable row level security;
alter table public.otp_challenges enable row level security;

revoke all on table public.leads from anon, authenticated;
revoke all on table public.otp_challenges from anon, authenticated;

-- Optional periodic cleanup, safe to run manually or through a scheduled job.
-- delete from public.otp_challenges where expires_at < now() - interval '7 days';
