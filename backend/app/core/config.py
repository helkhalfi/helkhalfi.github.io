from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
import json


class Settings(BaseSettings):
    APP_NAME: str = "SwiftSend API"
    DEBUG: bool = False
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    FRANKFURTER_BASE_URL: str = "https://api.frankfurter.app"
    RATE_CACHE_TTL_SECONDS: int = 360

    FEE_PERCENTAGE: float = 0.007
    MIN_TRANSFER_AMOUNT: float = 1.0
    MAX_TRANSFER_AMOUNT: float = 50000.0

    CORS_ORIGINS: list[str] = ["http://localhost", "http://127.0.0.1"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)


settings = Settings()
