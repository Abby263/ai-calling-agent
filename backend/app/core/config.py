from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _csv_set(value: str | None, *, lowercase: bool = True) -> set[str]:
    if not value:
        return set()
    items = [item.strip() for item in value.split(",") if item.strip()]
    if lowercase:
        return {item.lower() for item in items}
    return set(items)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Voice Concierge Agent"
    app_env: str = Field(default="development", alias="APP_ENV")
    public_base_url: str = Field(default="http://localhost:8000", alias="PUBLIC_BASE_URL")
    backend_cors_origins_raw: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="BACKEND_CORS_ORIGINS",
    )

    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    redis_url: str | None = Field(default=None, alias="REDIS_URL")

    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4.1-mini", alias="OPENAI_MODEL")

    google_places_api_key: str | None = Field(default=None, alias="GOOGLE_PLACES_API_KEY")

    twilio_account_sid: str | None = Field(default=None, alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str | None = Field(default=None, alias="TWILIO_AUTH_TOKEN")
    twilio_from_number: str | None = Field(default=None, alias="TWILIO_FROM_NUMBER")

    max_calls_per_task: int = Field(default=5, alias="MAX_CALLS_PER_TASK")
    demo_mode: bool = Field(default=True, alias="DEMO_MODE")
    allow_call_recording: bool = Field(default=False, alias="ALLOW_CALL_RECORDING")
    voice_runtime: str = Field(default="twilio", alias="VOICE_RUNTIME")
    livekit_url: str | None = Field(default=None, alias="LIVEKIT_URL")
    livekit_api_key: str | None = Field(default=None, alias="LIVEKIT_API_KEY")
    livekit_api_secret: str | None = Field(default=None, alias="LIVEKIT_API_SECRET")
    livekit_sip_outbound_trunk_id: str | None = Field(
        default=None,
        alias="LIVEKIT_SIP_OUTBOUND_TRUNK_ID",
    )
    livekit_agent_name: str = Field(
        default="voice-concierge-caller",
        alias="LIVEKIT_AGENT_NAME",
    )
    livekit_webhook_secret: str | None = Field(default=None, alias="LIVEKIT_WEBHOOK_SECRET")
    livekit_wait_until_answered: bool = Field(default=False, alias="LIVEKIT_WAIT_UNTIL_ANSWERED")

    auth_required_setting: bool | None = Field(default=None, alias="AUTH_REQUIRED")
    free_request_limit: int = Field(default=1, alias="FREE_REQUEST_LIMIT")
    admin_emails_raw: str | None = Field(default=None, alias="ADMIN_EMAILS")
    admin_clerk_subjects_raw: str | None = Field(default=None, alias="ADMIN_CLERK_SUBJECTS")
    paid_user_emails_raw: str | None = Field(default=None, alias="PAID_USER_EMAILS")
    clerk_secret_key: str | None = Field(default=None, alias="CLERK_SECRET_KEY")
    clerk_jwks_url: str | None = Field(default=None, alias="CLERK_JWKS_URL")
    clerk_jwt_issuer: str | None = Field(default=None, alias="CLERK_JWT_ISSUER")
    clerk_authorized_parties_raw: str | None = Field(
        default=None,
        alias="CLERK_AUTHORIZED_PARTIES",
    )

    @property
    def backend_cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins_raw.split(",")
            if origin.strip()
        ]

    @property
    def twilio_enabled(self) -> bool:
        return bool(
            self.twilio_account_sid and self.twilio_auth_token and self.twilio_from_number
        ) and not self.demo_mode

    @property
    def livekit_enabled(self) -> bool:
        return bool(
            self.livekit_url and self.livekit_api_key and self.livekit_api_secret
        ) and not self.demo_mode

    @property
    def livekit_calling_enabled(self) -> bool:
        return (
            self.voice_runtime.lower() == "livekit"
            and self.livekit_enabled
            and bool(self.livekit_sip_outbound_trunk_id)
        )

    @property
    def openai_enabled(self) -> bool:
        return bool(self.openai_api_key) and not self.demo_mode

    @property
    def google_places_enabled(self) -> bool:
        return bool(self.google_places_api_key) and not self.demo_mode

    @property
    def auth_required(self) -> bool:
        if self.auth_required_setting is not None:
            return self.auth_required_setting
        return self.app_env == "production" and not self.demo_mode

    @property
    def auth_configured(self) -> bool:
        return bool(self.clerk_secret_key or self.clerk_jwks_url)

    @property
    def clerk_jwks_endpoint(self) -> str:
        return self.clerk_jwks_url or "https://api.clerk.com/v1/jwks"

    @property
    def clerk_authorized_parties(self) -> list[str]:
        if self.clerk_authorized_parties_raw:
            return [
                origin.strip()
                for origin in self.clerk_authorized_parties_raw.split(",")
                if origin.strip()
            ]
        return [self.public_base_url.rstrip("/"), *self.backend_cors_origins]

    @property
    def admin_emails(self) -> set[str]:
        return _csv_set(self.admin_emails_raw)

    @property
    def admin_clerk_subjects(self) -> set[str]:
        return _csv_set(self.admin_clerk_subjects_raw, lowercase=False)

    @property
    def paid_user_emails(self) -> set[str]:
        return _csv_set(self.paid_user_emails_raw)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
