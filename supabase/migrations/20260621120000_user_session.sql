-- Device / session history for the Security settings (sign-out, geo, map).
-- One row per login (keyed by a hash of the refresh token), carrying the
-- device, IP and best-effort geolocation captured at login time.

create table if not exists public.user_session (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public."user"(id) on delete cascade,
  session_key   text not null,
  device        text,
  user_agent    text,
  ip            text,
  city          text,
  country       text,
  lat           double precision,
  lon           double precision,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (user_id, session_key)
);

create index if not exists idx_user_session_user on public.user_session (user_id);
