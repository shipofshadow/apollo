from __future__ import annotations

import httpx

_client: httpx.AsyncClient | None = None


def init_http_client() -> None:
    global _client
    if _client is not None:
        return

    limits = httpx.Limits(max_connections=200, max_keepalive_connections=50)
    _client = httpx.AsyncClient(limits=limits)


def get_http_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("HTTP client not initialized. Call init_http_client() on startup.")
    return _client


async def close_http_client() -> None:
    global _client
    if _client is None:
        return
    await _client.aclose()
    _client = None
