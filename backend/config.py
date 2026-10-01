from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    fastf1_cache_dir: str = "./assets/cache"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    frontend_origin: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.frontend_origin and self.frontend_origin.strip() not in origins:
            origins.append(self.frontend_origin.strip())
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
