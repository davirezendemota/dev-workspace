"""MCP tools — proxy to Dev Workspace API using the consumer Bearer from each client."""

from __future__ import annotations

import json

from mcp.server.mcpserver import Context, MCPServer

from dev_workspace_mcp.checkpoints import (
    build_checkpoint_from_transcript,
    upsert_checkpoint_record,
)
from dev_workspace_mcp.client import api_request
from dev_workspace_mcp.pdf import extract_text_from_pdf_base64

mcp = MCPServer(
    "dev-workspace",
    instructions=(
        "Ferramentas para o Dev Workspace (DW). Conexão scoped ao token do consumidor "
        "(Authorization no MCP). Use para pendências, tasks, checkpoints, milestones, plans, "
        "resumo IA e ask. Edição de specs/ACs continua no repo (.specs/)."
    ),
)


async def _dw(
    ctx: Context,
    method: str,
    path: str,
    *,
    json_body: dict | list | None = None,
    params: dict[str, str] | None = None,
) -> str:
    return await api_request(
        method,
        path,
        json_body=json_body,
        params=params,
        headers=ctx.headers,
    )


@mcp.tool()
async def list_projects(ctx: Context, skip: int = 0, limit: int = 100) -> str:
    """Lista projetos registrados no Dev Workspace (scoped ao token do consumidor)."""
    return await _dw(
        ctx,
        "GET",
        "/api/projects",
        params={"skip": str(skip), "limit": str(limit)},
    )


@mcp.tool()
async def get_project(ctx: Context, project_id: str) -> str:
    """Detalhes do projeto, incluindo resumo de IA em json_data.ai."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}")


@mcp.tool()
async def get_spec_checklist(ctx: Context, project_id: str) -> str:
    """Checklist agregado de specs/ACs do projeto (pendências, status, stats)."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}/spec-checklist")


@mcp.tool()
async def get_tasks(ctx: Context, project_id: str) -> str:
    """Tasks do projeto (somente leitura)."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}/tasks")


@mcp.tool()
async def get_checkpoints(ctx: Context, project_id: str) -> str:
    """Checkpoints (entregas já realizadas) do projeto."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}/checkpoints")


@mcp.tool()
async def update_checkpoints(ctx: Context, project_id: str, checkpoints_json: str) -> str:
    """Substitui a lista completa de checkpoints. JSON: {"checkpoints":[...]} ou array direto."""
    parsed = json.loads(checkpoints_json)
    if isinstance(parsed, dict) and "checkpoints" in parsed:
        body = parsed
    elif isinstance(parsed, list):
        body = {"checkpoints": parsed}
    else:
        raise ValueError("checkpoints_json deve ser array ou objeto com campo checkpoints.")
    return await api_request(
        "PUT",
        f"/api/projects/{project_id}/checkpoints",
        json_body=body,
        headers=ctx.headers,
    )


@mcp.tool()
async def upsert_checkpoint(
    ctx: Context,
    project_id: str,
    checkpoint_json: str,
    index: int = -1,
) -> str:
    """Cria ou altera um checkpoint. index -1=prepend (recente), -2=append, >=0=substituir índice."""
    checkpoint = json.loads(checkpoint_json)
    result, saved_index = await upsert_checkpoint_record(ctx, project_id, checkpoint, index)
    return json.dumps(
        {"saved_index": saved_index, "response": json.loads(result)},
        indent=2,
        ensure_ascii=False,
    )


@mcp.tool()
async def parse_pdf_transcript(
    ctx: Context,
    pdf_base64: str,
    filename: str = "document.pdf",
) -> str:
    """Extrai texto de PDF (transcrição de reunião). pdf_base64 = arquivo em base64."""
    text, pages = extract_text_from_pdf_base64(pdf_base64)
    return json.dumps(
        {
            "filename": filename,
            "pages": pages,
            "char_count": len(text),
            "text": text,
        },
        indent=2,
        ensure_ascii=False,
    )


@mcp.tool()
async def parse_checkpoint_pdf(
    ctx: Context,
    project_id: str,
    pdf_base64: str,
    filename: str = "document.pdf",
) -> str:
    """Upload PDF via base64 e extrai texto (API DW). Útil para PDFs grandes."""
    return await api_request(
        "POST",
        f"/api/projects/{project_id}/checkpoints/parse-pdf",
        json_body={"pdf_base64": pdf_base64, "filename": filename},
        headers=ctx.headers,
    )


@mcp.tool()
async def add_checkpoint_from_pdf(
    ctx: Context,
    project_id: str,
    pdf_base64: str,
    title: str,
    date: str = "",
    description: str = "",
    filename: str = "meeting.pdf",
) -> str:
    """Upload PDF, extrai transcrição e cria checkpoint (prepend — mais recente primeiro)."""
    text, pages = extract_text_from_pdf_base64(pdf_base64)
    checkpoint = build_checkpoint_from_transcript(
        title=title,
        transcript=text,
        date=date,
        description=description,
        filename=filename,
    )
    result, saved_index = await upsert_checkpoint_record(ctx, project_id, checkpoint, index=-1)
    return json.dumps(
        {
            "saved_index": saved_index,
            "pages": pages,
            "char_count": len(text),
            "checkpoint_title": checkpoint["title"],
            "response": json.loads(result),
        },
        indent=2,
        ensure_ascii=False,
    )


@mcp.tool()
async def generate_checkpoint_summary(ctx: Context, project_id: str, index: int) -> str:
    """Gera resumo IA do checkpoint no índice dado (timeline preview)."""
    return await _dw(
        ctx,
        "POST",
        f"/api/projects/{project_id}/checkpoints/{index}/summary",
    )


@mcp.tool()
async def get_milestones(ctx: Context, project_id: str) -> str:
    """Milestones (planejamento futuro) do projeto."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}/milestones")


@mcp.tool()
async def get_plans(ctx: Context, project_id: str) -> str:
    """Planos de ação vinculados a milestones."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}/plans")


@mcp.tool()
async def update_plans(ctx: Context, project_id: str, plans_json: str) -> str:
    """Persiste planos após aprovação do usuário. Body JSON: {"version":1,"items":[...]}."""
    body = json.loads(plans_json)
    return await _dw(ctx, "PUT", f"/api/projects/{project_id}/plans", json_body=body)


@mcp.tool()
async def generate_plan(ctx: Context, project_id: str, milestone_id: str) -> str:
    """Gera plano de ação via IA no DW para um milestone."""
    return await _dw(
        ctx,
        "POST",
        f"/api/projects/{project_id}/plans/generate",
        json_body={"milestoneId": milestone_id},
    )


@mcp.tool()
async def get_feature(ctx: Context, project_id: str, spec_id: str) -> str:
    """Markdown de uma spec (features/{specId}) do projeto."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}/features/{spec_id}")


@mcp.tool()
async def get_spec_graph(ctx: Context, project_id: str) -> str:
    """Grafo de dependências entre specs do projeto."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}/spec-graph")


@mcp.tool()
async def regenerate_ai_summary(ctx: Context, project_id: str) -> str:
    """Regenera o resumo de IA do projeto."""
    return await _dw(ctx, "POST", f"/api/projects/{project_id}/ai-summary")


@mcp.tool()
async def ask_projects(ctx: Context, prompt: str) -> str:
    """Pergunta aberta cross-project (contexto scoped ao token do consumidor)."""
    return await _dw(ctx, "POST", "/api/projects/ask", json_body={"prompt": prompt})


@mcp.tool()
async def list_prompts(ctx: Context, query: str = "") -> str:
    """Lista prompts da aba Prompts do DW. Opcional: query de busca."""
    params = {"q": query} if query else None
    return await _dw(ctx, "GET", "/api/prompts", params=params)


@mcp.tool()
async def get_prompt(ctx: Context, prompt_id: str) -> str:
    """Conteúdo Markdown de um prompt do DW."""
    return await _dw(ctx, "GET", f"/api/prompts/{prompt_id}")


@mcp.tool()
async def sync_project(ctx: Context, project_id: str) -> str:
    """Sincroniza specs/checklist do repo local com o DW."""
    return await _dw(ctx, "POST", f"/api/projects/{project_id}/sync")


@mcp.tool()
async def get_connection(ctx: Context, project_id: str) -> str:
    """Token de consumidor scoped ao local_path (admin only — falha com token de consumidor)."""
    return await _dw(ctx, "GET", f"/api/projects/{project_id}/connection")
