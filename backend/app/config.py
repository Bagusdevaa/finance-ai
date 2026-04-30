"""Konfigurasi aplikasi via pydantic-settings.

Disimpan sebagai singleton (lru_cache) supaya tidak parse ulang env tiap call.
Semua kunci sensitif harus datang dari .env, bukan hardcoded.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
	model_config = SettingsConfigDict(
		env_file=".env",
		env_file_encoding="utf-8",
		case_sensitive=True,
		extra="ignore",
	)

	# Database
	DATABASE_URL: str

	# JWT
	JWT_SECRET_KEY: str
	JWT_ALGORITHM: str = "HS256"
	ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
	REFRESH_TOKEN_EXPIRE_DAYS: int = 30

	# Google OAuth (placeholder untuk fitur OAuth nanti)
	GOOGLE_CLIENT_ID: str | None = None
	GOOGLE_CLIENT_SECRET: str | None = None
	GOOGLE_REDIRECT_URI: str | None = None

	# Groq
	GROQ_API_KEY: str | None = None
	GROQ_MODEL: str = "llama-3.3-70b-versatile"
	GROQ_VISION_MODEL: str = "llama-3.2-11b-vision-preview"

	# Qdrant
	QDRANT_URL: str = "http://localhost:6333"
	QDRANT_COLLECTION: str = "financeai_transactions"

	# App
	FRONTEND_URL: str = "http://localhost:3000"
	ENVIRONMENT: Literal["development", "staging", "production"] = "development"
	LOG_LEVEL: str = "INFO"

	@property
	def is_production(self) -> bool:
		return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
	return Settings()
