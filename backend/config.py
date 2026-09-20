from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_FALLBACK_SECRET = "moneymind_dev_insecure_secret_key_change_in_production"

class Settings(BaseSettings):
    APP_NAME: str = "MoneyMind API"
    ENVIRONMENT: str = "development"  # "development", "test", or "production"

    # Database connection URL (PostgreSQL via psycopg v3 or local SQLite fallback)
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/moneymind"
    FALLBACK_TO_SQLITE: bool = True

    # Secret key for HMAC token signatures. In non-development/non-test environments,
    # this MUST be provided via environment variables.
    SECRET_KEY: str = ""

    # Permitted CORS origins
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ]

    # Demo account configuration (strictly for evaluation / development)
    ENABLE_DEMO_USER: bool = True
    DEMO_USER_EMAIL: str = "demo@moneymind.app"
    DEMO_USER_PASSWORD: str = "Demo123!"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_secret_key(self):
        env = (self.ENVIRONMENT or "development").lower()
        if env not in ("development", "test"):
            # Enforce an explicit environment secret key in production / staging
            if not self.SECRET_KEY or self.SECRET_KEY == DEV_FALLBACK_SECRET:
                raise ValueError(
                    "SECRET_KEY must be configured via environment variables in non-development environments."
                )
        elif not self.SECRET_KEY:
            # Safe default fallback strictly for local development and automated tests
            self.SECRET_KEY = DEV_FALLBACK_SECRET
        return self

settings = Settings()

