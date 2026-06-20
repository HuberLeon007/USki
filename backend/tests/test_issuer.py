"""Issuer allow-list validation (the dev 127.0.0.1 vs host.docker.internal 401 fix)."""

from uski.core.config import Settings


class TestForeignIssuerRejected:
    def test_foreign_issuer_returns_401(self, client, make_token):
        token = make_token({"iss": "https://evil.example.com/auth/v1"})
        res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401


class TestAllowedIssuers:
    def test_dev_accepts_localhost_and_docker_host(self):
        s = Settings(
            APP_MODE="dev",
            SUPABASE_URL="http://host.docker.internal:54321",
            SUPABASE_PUBLIC_URL="http://127.0.0.1:54321",
            SUPABASE_ANON_KEY="x",
            SUPABASE_SERVICE_ROLE_KEY="y",
        )
        assert "http://127.0.0.1:54321/auth/v1" in s.allowed_issuers
        assert "http://host.docker.internal:54321/auth/v1" in s.allowed_issuers
        assert "http://localhost:54321/auth/v1" in s.allowed_issuers

    def test_public_url_falls_back_to_supabase_url(self):
        s = Settings(
            APP_MODE="prod",
            SUPABASE_URL="https://abc.supabase.co",
            SUPABASE_PUBLIC_URL="",  # explicit: isolate from any ambient env
            SUPABASE_ANON_KEY="x",
            SUPABASE_SERVICE_ROLE_KEY="y",
        )
        assert s.allowed_issuers == {"https://abc.supabase.co/auth/v1"}
