"""Helpers para criar/alterar checkpoints via API DW."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from mcp.server.mcpserver import Context

from dev_workspace_mcp.client import api_request


async def fetch_checkpoints(ctx: Context, project_id: str) -> list[dict[str, Any]]:
    raw = await api_request(
        "GET",
        f"/api/projects/{project_id}/checkpoints",
        headers=ctx.headers,
    )
    data = json.loads(raw)
    items = data.get("checkpoints", data if isinstance(data, list) else [])
    if not isinstance(items, list):
        return []
    return items


async def save_checkpoints(
    ctx: Context,
    project_id: str,
    checkpoints: list[dict[str, Any]],
) -> str:
    return await api_request(
        "PUT",
        f"/api/projects/{project_id}/checkpoints",
        json_body={"checkpoints": checkpoints},
        headers=ctx.headers,
    )


def default_checkpoint_date() -> str:
    now = datetime.now()
    return f"{now.day:02d}/{now.month:02d}/{now.year} {now.hour:02d}:{now.minute:02d}"


def build_checkpoint_from_transcript(
    *,
    title: str,
    transcript: str,
    date: str = "",
    description: str = "",
    filename: str = "",
) -> dict[str, Any]:
    atas: list[dict[str, str]] = [
        {
            "title": "Transcrição",
            "content": transcript,
        }
    ]
    if filename.strip():
        atas.insert(
            0,
            {
                "title": "Origem",
                "content": f"PDF: {filename.strip()}",
            },
        )

    return {
        "date": date.strip() or default_checkpoint_date(),
        "title": title.strip() or "Reunião — transcrição",
        "summary": "",
        "description": description.strip(),
        "atas": atas,
        "summaryUpdatedAt": None,
    }


async def upsert_checkpoint_record(
    ctx: Context,
    project_id: str,
    checkpoint: dict[str, Any],
    index: int = -1,
) -> tuple[str, int]:
    """index -1 = prepend (mais recente primeiro), -2 = append, >=0 replace."""
    current = await fetch_checkpoints(ctx, project_id)

    if (index >= 0:
        if index >= len(current):
            raise ValueError(f"Índice {index} inválido — há {len(current)} checkpoint(s).")
        existing = current[index]
        if not checkpoint.get("documents") and existing.get("documents"):
            checkpoint = {**checkpoint, "documents": existing["documents"]}
        current[index] = checkpoint
        saved_index = index
    elif index == -2:
        current.append(checkpoint)
        saved_index = len(current) - 1
    else:
        current.insert(0, checkpoint)
        saved_index = 0

    result = await save_checkpoints(ctx, project_id, current)
    return result, saved_index
