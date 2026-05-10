from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    genius_access_token: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    environment: str = "development"
    fastapi_host: str = "0.0.0.0"
    fastapi_port: int = 8000

    class Config:
        env_file = "apps/api/.env"
        env_file_encoding = "utf-8"


settings = Settings()
