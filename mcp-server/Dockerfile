# syntax=docker.io/docker/dockerfile:1

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=8000

COPY pyproject.toml README.md ./
COPY dev_workspace_mcp ./dev_workspace_mcp

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["python", "-m", "dev_workspace_mcp"]
