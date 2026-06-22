-- Lock down server-only tables: enable RLS with NO policies. The backend uses
-- the service-role key (which bypasses RLS), so its access is unaffected, while
-- the public anon/authenticated roles (Supabase Data API) are denied — these
-- tables hold auth/internal data and are never read with the anon key.
ALTER TABLE public.review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credential ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_presence ENABLE ROW LEVEL SECURITY;
