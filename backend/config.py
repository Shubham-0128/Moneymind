import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "MoneyMind API"
    ENVIRONMENT: str = "development"
    # Default to PostgreSQL with psycopg driver
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/moneymind"
    )
    # Enable fallback to SQLite if PostgreSQL is unreachable during local testing
    FALLBACK_TO_SQLITE: bool = True
    SECRET_KEY: str = os.getenv("SECRET_KEY", "moneymind_super_secret_dev_key_2026")
    ALLOWED_ORIGINS: list[str] = ["*"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
