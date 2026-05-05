from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Voice Concierge Agent"
    app_env: str = Field(default="development", alias="APP_ENV")
    public_base_url: str = Field(default="http://localhost:8000", alias="PUBLIC_BASE_URL")
    backend_cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"],
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

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def twilio_enabled(self) -> bool:
        return bool(
            self.twilio_account_sid and self.twilio_auth_token and self.twilio_from_number
        ) and not self.demo_mode

    @property
    def openai_enabled(self) -> bool:
        return bool(self.openai_api_key) and not self.demo_mode

    @property
    def google_places_enabled(self) -> bool:
        return bool(self.google_places_api_key) and not self.demo_mode


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

