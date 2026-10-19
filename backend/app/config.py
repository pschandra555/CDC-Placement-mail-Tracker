from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Every setting is optional so the app runs locally with no keys.
    Filling in .env switches each piece to the real service."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    cors_origins: str = "http://localhost:3000"
    allowed_email_domain: str = "vitstudent.ac.in"

    # Auth (Supabase). With neither set, dev mode trusts the X-Dev-Email header.
    supabase_url: str = ""
    supabase_jwt_secret: str = ""

    # Central inbox (Gmail API). Without these, sample mails are used.
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_refresh_token: str = ""
    trusted_senders: str = "helpdesk.cdc@vit.ac.in,cdc@vit.ac.in"
    fetch_lookback_days: int = 7

    # AI extraction. Without keys, the rule-based extractor is used.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    min_confidence: float = 0.7

    cron_secret: str = ""

    @property
    def dev_auth(self) -> bool:
        return not (self.supabase_url or self.supabase_jwt_secret)

    @property
    def gmail_enabled(self) -> bool:
        return bool(self.gmail_client_id and self.gmail_client_secret and self.gmail_refresh_token)

    @property
    def trusted_sender_list(self) -> list[str]:
        return [s.strip().lower() for s in self.trusted_senders.split(",") if s.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
