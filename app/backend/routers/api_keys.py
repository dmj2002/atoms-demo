"""Save / list / delete the current user's encrypted model API keys. Raw keys are never returned."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.user_api_keys import User_api_keys
from schemas.auth import UserResponse
from services.api_key_crypto import ALLOWED_PROVIDERS, encrypt_key, find_key_row

router = APIRouter(prefix="/api/v1/keys", tags=["keys"])


class KeySave(BaseModel):
    provider: str
    api_key: str


def _check_provider(provider: str) -> None:
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail="不支持的服务商")


@router.get("")
async def list_keys(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User_api_keys.provider).where(User_api_keys.user_id == str(current_user.id)))).scalars().all()
    return {"providers": sorted(set(rows))}


@router.put("")
async def save_key(data: KeySave, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _check_provider(data.provider)
    raw = data.api_key.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="API Key 不能为空")
    user_id = str(current_user.id)
    row = await find_key_row(db, user_id, data.provider)
    if row:
        row.encrypted_key = encrypt_key(raw)
    else:
        db.add(User_api_keys(user_id=user_id, provider=data.provider, encrypted_key=encrypt_key(raw)))
    await db.commit()
    return {"provider": data.provider, "saved": True}


@router.delete("/{provider}")
async def delete_key(provider: str, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _check_provider(provider)
    rows = (
        await db.execute(
            select(User_api_keys).where(User_api_keys.user_id == str(current_user.id), User_api_keys.provider == provider)
        )
    ).scalars().all()
    for row in rows:
        await db.delete(row)
    await db.commit()
    return {"provider": provider, "deleted": len(rows)}
