-- ============================================================
-- USki Social Login — auth_identity table + user.email linking key
-- ============================================================
-- Backs the email-keyed account resolution used by both the offline
-- Mock_Social_Login path and the real social path (services/auth_identity.py:
-- SupabaseAccountStore). Email is the single linking key: every email binds to
-- exactly one account (Requirement 3.3, 9.3). auth_identity records the
-- OTP/email identity plus zero or more provider identities, all pointing to the
-- same user_id (Requirement 9.2).
--
-- Idempotent and additive: guarded with IF NOT EXISTS so it is safe to (re)apply
-- on a local DB that already has the base auth schema.

-- ── user.email: the account-linking key (nullable, unique) ──
-- public.user is created by 0001_auth_schema.sql without an email column, but
-- SupabaseAccountStore looks accounts up by email and backfills it on first
-- resolve. Add it here and make it unique. NULLs are allowed and, per Postgres,
-- multiple NULLs do not violate a UNIQUE constraint, so existing rows that have
-- not yet been backfilled coexist fine.
ALTER TABLE public.user
    ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_email
    ON public.user (email);

COMMENT ON COLUMN public.user.email IS
    'Account-linking key (lowercased). Unique. Backfilled from auth.users on first social/OTP resolve.';

-- ── user.settings: per-account settings carrier (design USER model) ──
-- SupabaseAccountStore reads/returns a settings blob alongside the profile.
-- Add it as a JSONB column defaulting to an empty object so existing rows are
-- valid without a backfill.
ALTER TABLE public.user
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user.settings IS
    'Per-account user settings (design USER model). Defaults to an empty object.';

-- ── auth_identity: provider identities linked to one account ──
CREATE TABLE IF NOT EXISTS public.auth_identity (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    provider             TEXT NOT NULL,
    provider_account_ref TEXT,
    linked_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT auth_identity_user_provider_ref_key
        UNIQUE (user_id, provider, provider_account_ref)
);

CREATE INDEX IF NOT EXISTS idx_auth_identity_user_id
    ON public.auth_identity (user_id);

COMMENT ON TABLE public.auth_identity IS
    'Provider identities (email | google | github | discord) linked to a single account (user_id).';
COMMENT ON COLUMN public.auth_identity.provider IS
    'email for the OTP path, or a social provider name.';
COMMENT ON COLUMN public.auth_identity.provider_account_ref IS
    'Provider subject / mirror of auth.identities (e.g. the auth.users id for mock origins).';

-- ── Row Level Security (consistent with public.user) ──
-- service_role bypasses RLS, so backend writes via the service-role client are
-- unaffected; authenticated users may read only their own identities.
ALTER TABLE public.auth_identity ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'auth_identity'
          AND policyname = 'auth_identity_select_own'
    ) THEN
        CREATE POLICY "auth_identity_select_own"
            ON public.auth_identity FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END$$;

-- ── Data API grants (match 20260618215550_grant_api_roles.sql) ──
GRANT ALL ON public.auth_identity TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_identity TO authenticated;
GRANT SELECT ON public.auth_identity TO anon;
