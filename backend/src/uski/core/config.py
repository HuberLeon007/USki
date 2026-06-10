"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings loaded from environment variables / .env file."""

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Backend
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"
    BACKEND_LOG_LEVEL: str = "INFO"

    # AI Provider (generic — swap in any provider)
    AI_BASE_URL: str = ""
    AI_API_KEY: str = ""
    AI_MODEL: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",")]

    @property
    def jwks_url(self) -> str:
        """Supabase JWKS endpoint for RS256 JWT validation."""
        return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
