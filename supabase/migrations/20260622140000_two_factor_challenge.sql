-- ============================================================
-- TOTP second-factor login challenge (short-lived, single-use)
-- ============================================================
-- When a user with TOTP enabled passes the first factor (email OTP or social),
-- the minted session is parked here instead of being returned, and only handed
-- over once a valid TOTP code is presented. Rows are single-use and expire
-- after a few minutes (enforced in the service). Mirrors the login_request
-- (device-link) pattern, which also parks tokens transiently.
create table if not exists public.two_factor_challenge (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public."user"(id) on delete cascade,
  email          text,
  access_token   text not null,
  refresh_token  text not null,
  needs_username boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_two_factor_challenge_user on public.two_factor_challenge (user_id);
