"""Pydantic schemas untuk request & response auth endpoints."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
	email: EmailStr
	password: str = Field(min_length=8, max_length=128)
	name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
	email: EmailStr
	password: str


class UserPublic(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	email: EmailStr
	name: str
	created_at: datetime


class TokenResponse(BaseModel):
	access_token: str
	token_type: Literal["bearer"] = "bearer"
	expires_in: int  # detik
	user: UserPublic


class RefreshResponse(TokenResponse):
	pass
