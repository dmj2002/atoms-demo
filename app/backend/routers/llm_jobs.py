"""Generation jobs: a long request reads the provider stream and checkpoints it to the DB,
while the client polls for new content. Works on hosts that buffer whole HTTP responses."""

import json
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.generation_jobs import Generation_jobs
from routers.llm_proxy import TIMEOUT, ProxyRequest, _prepare
from schemas.auth import UserResponse

router = APIRouter(prefix="/api/v1/llm/jobs", tags=["llm-jobs"])

FLUSH_SECONDS = 0.5


class JobRun(ProxyRequest):
    job_key: str


async def _job(db: AsyncSession, user_id: str, key: str) -> Optional[Generation_jobs]:
    res = await db.execute(
        select(Generation_jobs).where(Generation_jobs.user_id == user_id, Generation_jobs.job_key == key).order_by(Generation_jobs.id.desc())
    )
    return res.scalars().first()


@router.post("/run")
async def run_job(data: JobRun, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_id = str(current_user.id)
    if not data.job_key or len(data.job_key) > 64:
        raise HTTPException(status_code=400, detail="job_key 无效")
    job = Generation_jobs(user_id=user_id, job_key=data.job_key, content="", status="running", error=None)
    db.add(job)
    await db.commit()

    try:
        url, headers = await _prepare(data, user_id, db)
    except HTTPException as e:
        job.status, job.error = "error", str(e.detail)
        await db.commit()
        raise

    lines: list[str] = []
    last_flush = time.monotonic()

    async def flush(status: str = "running", error: Optional[str] = None):
        job.content = "\n".join(lines)
        job.status = status
        job.error = error
        await db.commit()

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("POST", url, headers=headers, json=data.body) as resp:
                if resp.status_code >= 400:
                    text = (await resp.aread()).decode(errors="ignore")[:500]
                    await flush("error", f"模型接口返回 {resp.status_code}：{text}")
                    return {"status": "error"}
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    lines.append(payload)
                    if time.monotonic() - last_flush >= FLUSH_SECONDS:
                        await flush()
                        last_flush = time.monotonic()
                        await db.refresh(job, ["status"])
                        if job.status == "cancelled":
                            return {"status": "cancelled"}
        await flush("done")
        return {"status": "done"}
    except httpx.HTTPError as e:
        await flush("error", f"无法连接模型接口：{e}")
        return {"status": "error"}


@router.get("/{job_key}")
async def poll_job(job_key: str, offset: int = 0, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    job = await _job(db, str(current_user.id), job_key)
    if not job:
        return {"status": "pending", "chunk": "", "offset": offset}
    content = job.content or ""
    return {"status": job.status, "error": job.error, "chunk": content[max(offset, 0):], "offset": len(content)}


@router.post("/{job_key}/cancel")
async def cancel_job(job_key: str, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    job = await _job(db, str(current_user.id), job_key)
    if job and job.status == "running":
        job.status = "cancelled"
        await db.commit()
    return {"ok": True, "detail": json.dumps({"job_key": job_key})}
