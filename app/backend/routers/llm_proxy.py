"""LLM proxy: forwards provider requests server-side (CORS-free, optional stored keys).

`/stream` relays the provider's SSE token-by-token via EventSourceResponse (same mechanism
as the platform aihub streaming endpoint); `/proxy` is kept for backward compatibility.
"""

import ipaddress
import json
import logging
from typing import Optional
from urllib.parse import quote, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.api_key_crypto import SERVER_KEY_PLACEHOLDER, load_user_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

TIMEOUT = httpx.Timeout(300.0, connect=15.0)


class ProxyRequest(BaseModel):
    url: str
    headers: dict[str, str] = {}
    body: dict
    provider: Optional[str] = None
    use_stored_key: bool = False


def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if parsed.scheme != "https" or not host:
        raise HTTPException(status_code=400, detail="仅支持 https 协议的模型接口地址")
    if host == "localhost" or host.endswith(".local"):
        raise HTTPException(status_code=400, detail="不允许访问内网地址")
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise HTTPException(status_code=400, detail="不允许访问内网地址")
    except ValueError:
        pass


async def _prepare(data: ProxyRequest, user_id: str, db: AsyncSession) -> tuple[str, dict[str, str]]:
    """Validates the target and resolves a stored key; closes the DB phase before slow I/O."""
    _validate_url(data.url)
    url = data.url
    headers = {**data.headers, "Content-Type": "application/json"}
    if data.use_stored_key:
        if not data.provider:
            raise HTTPException(status_code=400, detail="缺少服务商参数")
        key = await load_user_key(db, user_id, data.provider)
        await db.commit()
        if not key:
            raise HTTPException(status_code=400, detail="服务器上没有保存该服务商的 API Key，请在设置中重新保存")
        url = url.replace(SERVER_KEY_PLACEHOLDER, quote(key, safe=""))
        headers = {k: v.replace(SERVER_KEY_PLACEHOLDER, key) for k, v in headers.items()}
    else:
        await db.commit()
    return url, headers


@router.post("/stream")
async def stream(
    data: ProxyRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Relays each upstream SSE `data:` payload as an event: {"raw": "<payload>"}."""
    from sse_starlette.sse import EventSourceResponse

    url, headers = await _prepare(data, str(current_user.id), db)

    async def events():
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                async with client.stream("POST", url, headers=headers, json=data.body) as resp:
                    if resp.status_code >= 400:
                        text = (await resp.aread()).decode(errors="ignore")[:500]
                        yield json.dumps({"error": f"模型接口返回 {resp.status_code}：{text}"}, ensure_ascii=False)
                        return
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if payload and payload != "[DONE]":
                            yield json.dumps({"raw": payload}, ensure_ascii=False)
        except httpx.HTTPError as e:
            logger.warning("LLM stream failed: %s", e)
            yield json.dumps({"error": f"无法连接模型接口：{e}"}, ensure_ascii=False)
        finally:
            yield "[DONE]"

    return EventSourceResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/proxy")
async def proxy(
    data: ProxyRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    url, headers = await _prepare(data, str(current_user.id), db)
    client = httpx.AsyncClient(timeout=TIMEOUT)
    try:
        resp = await client.send(client.build_request("POST", url, headers=headers, json=data.body), stream=True)
    except httpx.HTTPError as e:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"无法连接模型接口：{e}")

    if resp.status_code >= 400:
        text = (await resp.aread()).decode(errors="ignore")[:500]
        await resp.aclose()
        await client.aclose()
        raise HTTPException(status_code=resp.status_code, detail=f"模型接口返回 {resp.status_code}：{text}")

    async def body():
        try:
            async for chunk in resp.aiter_raw():
                yield chunk
        except httpx.HTTPError as e:
            logger.warning("LLM proxy interrupted: %s", e)
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(body(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
