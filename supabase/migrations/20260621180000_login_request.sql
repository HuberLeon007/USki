-- Cross-device sign-in (QR / device-link). A device that wants to sign in
-- creates a short-lived pending request and shows a QR; an already-signed-in
-- device approves it, attaching a freshly minted session. Single-use and
-- expiring, so the transient token storage is safe for the link window.

create table if not exists public.login_request (
  code           text primary key,
  status         text not null default 'pending',  -- pending | approved
  user_id        uuid,
  email          text,
  access_token   text,
  refresh_token  text,
  needs_username boolean not null default false,
  created_at     timestamptz not null default now(),
  approved_at    timestamptz
);
