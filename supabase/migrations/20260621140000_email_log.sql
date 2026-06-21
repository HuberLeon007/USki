-- Transactional-email outbox. In dev, emails are recorded here (and logged)
-- instead of being delivered, so they are fully inspectable offline. In prod
-- the Resend adapter delivers for real and still records a row here. The
-- 'welcome' kind is also used to send the welcome email exactly once per email.

create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  to_email    text not null,
  subject     text not null,
  html        text not null,
  kind        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_email_log_to_kind on public.email_log (to_email, kind);
