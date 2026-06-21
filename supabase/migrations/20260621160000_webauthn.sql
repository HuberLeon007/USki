-- Passkeys / WebAuthn: stored credentials + short-lived ceremony challenges.

create table if not exists public.webauthn_credential (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public."user"(id) on delete cascade,
  credential_id  text not null unique,          -- base64url credential id
  public_key     text not null,                 -- base64url COSE public key
  sign_count     bigint not null default 0,
  transports     text,                          -- comma-joined hints
  name           text,                          -- user-facing label
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);
create index if not exists idx_webauthn_cred_user on public.webauthn_credential (user_id);

-- Pending registration / authentication challenges, keyed by a handle:
-- the user id for registration, or a random login id for discoverable login.
create table if not exists public.webauthn_challenge (
  handle      text not null,
  kind        text not null,                    -- 'register' | 'login'
  challenge   text not null,                    -- base64url
  created_at  timestamptz not null default now(),
  primary key (handle, kind)
);
