"""Share links, personal share management and the public gallery."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.app_shares import App_shares
from models.shared_apps import Shared_apps
from schemas.auth import UserResponse

router = APIRouter(prefix="/api/v1/share", tags=["share"])

MAX_HTML = 2_000_000


class ShareCreate(BaseModel):
    title: str
    html: str
    files_json: Optional[str] = None
    is_public: bool = False


class ShareUpdate(BaseModel):
    is_public: Optional[bool] = None
    title: Optional[str] = None


def _summary(row: App_shares) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "is_public": bool(row.is_public),
        "remix_count": row.remix_count or 0,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


async def _owned(db: AsyncSession, share_id: int, user_id: str) -> App_shares:
    row = (await db.execute(select(App_shares).where(App_shares.id == share_id))).scalar_one_or_none()
    if not row or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="分享不存在或无权操作")
    return row


@router.post("")
async def create_share(data: ShareCreate, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not data.html.strip():
        raise HTTPException(status_code=400, detail="应用内容为空")
    if len(data.html) > MAX_HTML or len(data.files_json or "") > MAX_HTML:
        raise HTTPException(status_code=400, detail="应用体积过大，无法分享")
    row = App_shares(
        user_id=str(current_user.id),
        title=data.title[:100] or "未命名应用",
        html=data.html,
        files_json=data.files_json,
        is_public=data.is_public,
        remix_count=0,
    )
    db.add(row)
    await db.commit()
    return {"id": row.id}


@router.get("/mine")
async def list_mine(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(select(App_shares).where(App_shares.user_id == str(current_user.id)).order_by(App_shares.id.desc()).limit(100))
    ).scalars().all()
    return {"items": [_summary(r) for r in rows]}


@router.get("/gallery")
async def gallery(skip: int = 0, limit: int = 24, db: AsyncSession = Depends(get_db)):
    limit = max(1, min(limit, 48))
    rows = (
        await db.execute(
            select(App_shares).where(App_shares.is_public.is_(True)).order_by(App_shares.id.desc()).offset(max(skip, 0)).limit(limit)
        )
    ).scalars().all()
    return {"items": [_summary(r) for r in rows]}


@router.patch("/{share_id}")
async def update_share(share_id: int, data: ShareUpdate, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await _owned(db, share_id, str(current_user.id))
    if data.is_public is not None:
        row.is_public = data.is_public
    if data.title is not None:
        row.title = data.title[:100] or row.title
    await db.commit()
    return _summary(row)


@router.delete("/{share_id}")
async def delete_share(share_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await _owned(db, share_id, str(current_user.id))
    await db.delete(row)
    await db.commit()
    return {"deleted": share_id}


@router.post("/{share_id}/remix")
async def remix_share(share_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(App_shares).where(App_shares.id == share_id))).scalar_one_or_none()
    if not row or not (row.is_public or row.user_id == str(current_user.id)):
        raise HTTPException(status_code=404, detail="作品不存在或未公开")
    row.remix_count = (row.remix_count or 0) + 1
    result = {"title": row.title, "html": row.html, "files_json": row.files_json}
    await db.commit()
    return result


@router.get("/{share_id}")
async def get_share(share_id: int, legacy: bool = False, db: AsyncSession = Depends(get_db)):
    if not legacy:
        row = (await db.execute(select(App_shares).where(App_shares.id == share_id))).scalar_one_or_none()
        if row:
            return {"id": row.id, "title": row.title, "html": row.html}
    old = (await db.execute(select(Shared_apps).where(Shared_apps.id == share_id))).scalar_one_or_none()
    if not old:
        raise HTTPException(status_code=404, detail="分享不存在或已删除")
    return {"id": old.id, "title": old.title, "html": old.html}
