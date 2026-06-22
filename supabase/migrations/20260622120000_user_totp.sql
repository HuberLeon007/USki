-- ============================================================
-- USki TOTP (authenticator-app) second factor
-- ============================================================
-- Replaces the redundant email-OTP "second factor" (the primary login is
-- already an email OTP) with a real TOTP factor scanned from an authenticator
-- app. `totp_secret` holds the Base32 shared secret and stays server-only; it
-- is set during setup and only takes effect once a code is verified, which
-- flips `totp_enabled` to true. Additive and idempotent: existing rows default
-- to no TOTP, so this never locks anyone out on its own.
ALTER TABLE public.user
    ADD COLUMN IF NOT EXISTS totp_secret  TEXT,
    ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user.totp_secret IS
    'Base32 TOTP shared secret. Pending until totp_enabled is true. Server-only; never returned after setup.';
COMMENT ON COLUMN public.user.totp_enabled IS
    'Whether app-based TOTP two-factor is active for the account.';
