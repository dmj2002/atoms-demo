"""Encrypted per-user storage of model provider API keys."""

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.user_api_keys import User_api_keys

ALLOWED_PROVIDERS = {"qwen", "openai", "deepseek", "gemini", "anthropic"}
SERVER_KEY_PLACEHOLDER = "__SERVER_KEY__"


def _fernet() -> Fernet:
    secret = settings.jwt_secret_key or ""
    if not secret:
        raise HTTPException(status_code=500, detail="服务器未配置加密密钥")
    digest = hashlib.sha256(f"atoms-demo-api-keys:{secret}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_key(raw: str) -> str:
    return _fernet().encrypt(raw.encode()).decode()


def decrypt_key(token: str) -> Optional[str]:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


async def find_key_row(db: AsyncSession, user_id: str, provider: str) -> Optional[User_api_keys]:
    result = await db.execute(
        select(User_api_keys)
        .where(User_api_keys.user_id == user_id, User_api_keys.provider == provider)
        .order_by(User_api_keys.id.desc())
    )
    return result.scalars().first()


async def load_user_key(db: AsyncSession, user_id: str, provider: str) -> Optional[str]:
    row = await find_key_row(db, user_id, provider)
    return decrypt_key(row.encrypted_key) if row else None
