-- ============================================================
-- USki Auth Schema — user + login_audit + user_sessions
-- ============================================================

-- public.user — extends auth.users with app-specific data
CREATE TABLE public.user (
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username      TEXT,
    discriminator TEXT NOT NULL DEFAULT '0000',
    display_name  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_username_discriminator_key
        UNIQUE (username, discriminator)
);

CREATE INDEX idx_user_username_discriminator
    ON public.user (username, discriminator);

COMMENT ON TABLE public.user IS 'User profiles extending Supabase auth.users';
COMMENT ON COLUMN public.user.id IS 'Same UUID as auth.users.id — 1:1 relationship';
COMMENT ON COLUMN public.user.username IS 'Freely chosen, NOT unique. Combined with discriminator for unique ID.';
COMMENT ON COLUMN public.user.discriminator IS 'Auto-generated 4-digit code. Displayed as username#1234 for friend finding.';

-- Trigger: auto-create user row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.user (id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- public.login_audit — append-only login history
CREATE TABLE public.login_audit (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    ip_address  INET,
    user_agent  TEXT,
    city        TEXT,
    country     TEXT,
    event_type  TEXT NOT NULL CHECK (event_type IN ('login', 'logout', 'failed_attempt')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_audit_user_id ON public.login_audit (user_id, created_at DESC);

COMMENT ON TABLE public.login_audit IS 'Append-only log of all login events for security monitoring';
COMMENT ON COLUMN public.login_audit.user_agent IS 'Parsed device info, e.g. "Chrome 125 on Windows 11". Not raw UA string.';
COMMENT ON COLUMN public.login_audit.city IS 'Best-effort from IP geolocation. May be NULL.';

-- public.user_sessions — active sessions / devices
CREATE TABLE public.user_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES public.user(id) ON DELETE CASCADE,
    device_name    TEXT NOT NULL DEFAULT 'Unknown device',
    ip_address     INET,
    city           TEXT,
    country        TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions (user_id);

COMMENT ON TABLE public.user_sessions IS 'Active sessions/devices. One row per logged-in device. Deleted on logout or expiry.';
COMMENT ON COLUMN public.user_sessions.device_name IS 'Human-readable label from User-Agent, e.g. "Chrome on macOS"';
COMMENT ON COLUMN public.user_sessions.last_active_at IS 'Updated on each authenticated request';

-- Row Level Security
ALTER TABLE public.user ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select_own"
    ON public.user FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "user_update_own"
    ON public.user FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "user_select_public"
    ON public.user FOR SELECT
    TO anon, authenticated
    USING (true);

ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "login_audit_select_own"
    ON public.login_audit FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sessions_select_own"
    ON public.user_sessions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "user_sessions_delete_own"
    ON public.user_sessions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
