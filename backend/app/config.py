from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://ulpin:ulpin@localhost:5432/ulpin"
    jwt_secret: str = "change-this-development-secret"
    jwt_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5500,http://127.0.0.1:5500"
    upload_dir: str = "./storage"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
