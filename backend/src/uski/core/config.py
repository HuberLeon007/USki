"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings loaded from environment variables / .env file."""

    # App mode: "dev" or "prod"
    APP_MODE: str = "dev"

    # Supabase
    SUPABASE_URL: str
    # Browser-facing Supabase URL (the `iss` the client token carries). In dev,
    # the browser talks to 127.0.0.1 while the backend container reaches Supabase
    # via host.docker.internal, so the token issuer differs from SUPABASE_URL.
    # Empty -> falls back to SUPABASE_URL.
    SUPABASE_PUBLIC_URL: str = ""
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Backend
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"
    BACKEND_LOG_LEVEL: str = "INFO"

    # AI Provider (works with any OpenAI-compatible API)
    # DEV: leave empty → auto-resolves to Ollama (http://localhost:11434/v1)
    # PROD: set to your provider URL (e.g. https://generativelanguage.googleapis.com/v1beta)
    AI_BASE_URL: str = ""
    AI_API_KEY: str = ""
    AI_MODEL: str = ""

    # Rate Limiting
    RATE_LIMIT_REDIS_URL: str = "redis://localhost:6379"
    RATE_LIMIT_SEND_OTP_IP: str = "5/minute"
    RATE_LIMIT_VERIFY_OTP_IP: str = "10/minute"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",")]

    @property
    def jwks_url(self) -> str:
        """Supabase JWKS endpoint for RS256 JWT validation."""
        return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def allowed_issuers(self) -> set[str]:
        """Accepted `iss` claims for incoming tokens.

        The token issuer is whatever GoTrue is configured with (browser-facing
        URL). We accept both the internal SUPABASE_URL and the public URL, plus
        common localhost variants in dev, so a token minted at 127.0.0.1 still
        validates in a container that reaches Supabase via host.docker.internal.
        """
        bases = {self.SUPABASE_URL}
        if self.SUPABASE_PUBLIC_URL:
            bases.add(self.SUPABASE_PUBLIC_URL)
        if self.is_dev:
            bases |= {
                "http://127.0.0.1:54321",
                "http://localhost:54321",
                "http://host.docker.internal:54321",
            }
        return {f"{b.rstrip('/')}/auth/v1" for b in bases}

    @property
    def is_dev(self) -> bool:
        return self.APP_MODE == "dev"

    @property
    def ai_base_url_resolved(self) -> str:
        """Return the effective AI base URL based on mode."""
        if self.AI_BASE_URL:
            return self.AI_BASE_URL
        if self.is_dev:
            return "http://localhost:11434/v1"
        return ""

    @property
    def ai_model_resolved(self) -> str:
        """Return the effective AI model based on mode."""
        if self.AI_MODEL:
            return self.AI_MODEL
        if self.is_dev:
            return "qwen3:4b"
        return ""

    @property
    def rate_limit_storage_uri(self) -> str:
        """Use Redis in prod, in-memory in dev/test."""
        if self.is_dev or self.APP_MODE == "test":
            return "memory://"
        return self.RATE_LIMIT_REDIS_URL

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
