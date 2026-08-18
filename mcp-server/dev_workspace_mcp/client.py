"""HTTP client for the Dev Workspace REST API."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Mapping

import httpx

DEFAULT_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


def base_url() -> str:
    return os.environ.get("DEV_WORKSPACE_URL", "http://localhost:3010").rstrip("/")


def _token_file_path() -> Path:
    config_path = os.environ.get("WORKSPACE_CONFIG_PATH", "/data/config.json")
    return Path(config_path).parent / "api_token"


def _read_workspace_token_file() -> str:
    token_path = _token_file_path()
    if token_path.is_file():
        return token_path.read_text(encoding="utf-8").strip()
    return ""


def extract_bearer_token(headers: Mapping[str, str] | None) -> str | None:
    if not headers:
        return None
    for key, value in headers.items():
        if key.lower() == "authorization" and value.lower().startswith("bearer "):
            token = value[7:].strip()
            return token or None
    return None


def resolve_api_token(
    headers: Mapping[str, str] | None = None,
    *,
    explicit_token: str | None = None,
) -> str:
    """Token do consumidor (header MCP) ou fallback admin para dev local."""
    if explicit_token and explicit_token.strip():
        return explicit_token.strip()

    header_token = extract_bearer_token(headers)
    if header_token:
        return header_token

    env_token = os.environ.get("WORKSPACE_API_TOKEN", "").strip()
    if env_token:
        return env_token

    if os.environ.get("MCP_FALLBACK_TO_WORKSPACE_TOKEN", "true").lower() in (
        "1",
        "true",
        "yes",
    ):
        file_token = _read_workspace_token_file()
        if file_token:
            return file_token

    raise RuntimeError(
        "Missing API token. Send Authorization: Bearer <DEV_WORKSPACE_API_TOKEN> "
        "(consumer token from .dev-workspace/.env) in MCP headers, or set "
        "WORKSPACE_API_TOKEN on the MCP server."
    )


def _format_body(body: Any) -> str:
    return json.dumps(body, indent=2, ensure_ascii=False, default=str)


async def api_request(
    method: str,
    path: str,
    *,
    json_body: dict[str, Any] | list[Any] | None = None,
    params: dict[str, str] | None = None,
    headers: Mapping[str, str] | None = None,
    api_token: str | None = None,
) -> str:
    token = resolve_api_token(headers, explicit_token=api_token)
    url = f"{base_url()}{path}"
    request_headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.request(
            method,
            url,
            headers=request_headers,
            json=json_body,
            params=params,
        )

    if response.is_error:
        detail = response.text.strip() or response.reason_phrase
        raise RuntimeError(f"DW API {method} {path} → {response.status_code}: {detail}")

    if not response.content:
        return ""

    try:
        return _format_body(response.json())
    except json.JSONDecodeError:
        return response.text
