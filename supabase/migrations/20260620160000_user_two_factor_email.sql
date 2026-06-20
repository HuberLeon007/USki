-- ============================================================
-- USki Email-OTP second factor (2FA) — per-user opt-in flag
-- ============================================================
-- Adds an opt-in preference flag on public.user that records whether the
-- account wants the existing email OTP flow used as a second factor at login.
-- The backend only stores and exposes this flag; the actual code delivery and
-- verification reuse the existing send-otp / verify-otp endpoints, driven by
-- the frontend. No new email transport is introduced.
--
-- Idempotent and additive: guarded with IF NOT EXISTS so it is safe to
-- (re)apply on a local DB that already has the base auth schema. Defaults to
-- false so existing rows are valid without a backfill.
ALTER TABLE public.user
    ADD COLUMN IF NOT EXISTS two_factor_email BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user.two_factor_email IS
    'Opt-in email-OTP second factor preference. Defaults to false. The OTP delivery/verification reuses send-otp / verify-otp.';
