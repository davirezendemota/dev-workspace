#!/usr/bin/env bash
# Install Dev Workspace bridge — minimal: .env + one skill. No templates/ in consumer.
set -euo pipefail

UPSTREAM_ARCHIVE="https://github.com/davirezendemota/dev-workspace/archive/refs/heads/main.tar.gz"

usage() {
  cat <<'EOF'
Usage: install.sh [TARGET_DIR] [--merge] [--no-register]

Install into TARGET_DIR/.dev-workspace/.env and skill dev-workspace (Cursor + Claude).

  --merge         Keep existing .env; refresh skill only
  --no-register   Skip auto-register via DEV_WORKSPACE_REGISTER_TOKEN

  --api-url URL
  --api-token TOKEN
  --dw-root PATH

Auto-register (when DEV_WORKSPACE_REGISTER_TOKEN + DEV_WORKSPACE_URL are set):
  POST /api/install/register → writes consumer token to .dev-workspace/.env
EOF
}

TARGET="."
MERGE=false
NO_REGISTER=false
API_URL="http://localhost:3010"
API_TOKEN=""
MCP_URL=""
DW_ROOT=""
CLEANUP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --merge) MERGE=true ;;
    --no-register) NO_REGISTER=true ;;
    --api-url) API_URL="${2:-}"; shift ;;
    --api-token) API_TOKEN="${2:-}"; shift ;;
    --dw-root) DW_ROOT="${2:-}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [[ "$TARGET" == "." && "$1" != --* ]]; then TARGET="$1"; fi
      ;;
  esac
  shift
done

download_kit() {
  tmp="$(mktemp -d)"
  CLEANUP="$tmp"
  curl -fsSL "$UPSTREAM_ARCHIVE" | tar xz -C "$tmp"
  SCRIPT_DIR="$tmp/dev-workspace-main/install-kit"
}

resolve_source() {
  if [[ -n "${INSTALL_KIT_ROOT:-}" ]]; then
    SCRIPT_DIR="$(cd "$INSTALL_KIT_ROOT" && pwd)"
    return
  fi
  src="${BASH_SOURCE[0]:-}"
  if [[ -n "$src" && -f "$src" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "$src")" && pwd)"
    if [[ -f "$SCRIPT_DIR/skill-dev-workspace.md" ]]; then return; fi
  fi
  download_kit
}

derive_mcp_url() {
  local base_url="$1"
  if [[ -n "${DEV_WORKSPACE_MCP_URL:-}" ]]; then
    echo "${DEV_WORKSPACE_MCP_URL%/}"
    return
  fi
  case "$base_url" in
    *:3010*) echo "http://localhost:3011/mcp" ;;
    *:3000*) echo "http://localhost:3001/mcp" ;;
    *:8080*) echo "http://localhost:8082/mcp" ;;
    *) echo "http://localhost:3011/mcp" ;;
  esac
}

try_register_consumer() {
  if [[ "$NO_REGISTER" == true ]]; then
    return 0
  fi

  local register_token="${DEV_WORKSPACE_REGISTER_TOKEN:-}"
  local api_url="${DEV_WORKSPACE_URL:-$API_URL}"
  api_url="${api_url%/}"

  if [[ -z "$register_token" ]]; then
    return 0
  fi

  local payload response http_code body consumer_token
  payload="$(python3 -c 'import json,sys; print(json.dumps({"local_path": sys.argv[1]}))' "$TARGET")"

  response="$(curl -fsS -w "\n%{http_code}" \
    -X POST "$api_url/api/install/register" \
    -H "Authorization: Bearer $register_token" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)" || {
    echo "WARN: registro automático falhou (curl) — verifique DEV_WORKSPACE_URL e token" >&2
    return 0
  }

  http_code="$(printf '%s' "$response" | tail -n1)"
  body="$(printf '%s' "$response" | sed '$d')"

  if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
    echo "WARN: registro automático falhou (HTTP $http_code): $body" >&2
    return 0
  fi

  consumer_token="$(python3 -c "import json,sys; print(json.load(sys.stdin)['consumer_api_token'])" <<< "$body")"
  if [[ -z "$consumer_token" ]]; then
    echo "WARN: registro automático sem consumer_api_token na resposta" >&2
    return 0
  fi

  API_TOKEN="$consumer_token"
  API_URL="$api_url"
  MCP_URL="$(derive_mcp_url "$api_url")"
  echo "     projeto registrado no DW (HTTP $http_code) → token consumidor obtido"
}

ensure_gitignore_dev_workspace() {
  local gitignore="$TARGET/.gitignore"
  local entry='.dev-workspace/'

  if [[ -f "$gitignore" ]]; then
    if grep -qE '(^|/)\.dev-workspace/?$' "$gitignore" \
      || grep -qE '^\.dev-workspace/' "$gitignore"; then
      return 0
    fi
    if [[ -n "$(tail -c1 "$gitignore" 2>/dev/null || true)" ]]; then
      printf '\n' >> "$gitignore"
    fi
    {
      echo '# Dev Workspace bridge (secrets local — install-kit)'
      echo "$entry"
    } >> "$gitignore"
  else
    {
      echo '# Dev Workspace bridge (secrets local — install-kit)'
      echo "$entry"
    } > "$gitignore"
  fi
}

install_mcp_config() {
  local env_file="$BRIDGE/.env"
  local mcp_json="$TARGET/.cursor/mcp.json"
  local mcp_url="http://localhost:3011/mcp"
  local token=""

  if [[ -f "$env_file" ]]; then
    token="$(grep -E '^DEV_WORKSPACE_API_TOKEN=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"
    local url_line
    url_line="$(grep -E '^DEV_WORKSPACE_MCP_URL=' "$env_file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"
    if [[ -n "$url_line" ]]; then
      mcp_url="$url_line"
    fi
  fi

  if [[ -z "$token" ]]; then
    echo "     (mcp.json omitido — defina DEV_WORKSPACE_API_TOKEN em .dev-workspace/.env)"
    return 0
  fi

  mkdir -p "$TARGET/.cursor"
  python3 - "$mcp_json" "$mcp_url" "$token" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
mcp_url = sys.argv[2]
token = sys.argv[3]

data: dict = {}
if path.is_file():
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        data = {}

servers = data.setdefault("mcpServers", {})
servers["dev-workspace"] = {
    "url": mcp_url,
    "headers": {"Authorization": f"Bearer {token}"},
}

path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY

  local gitignore="$TARGET/.gitignore"
  if [[ -f "$gitignore" ]]; then
    if ! grep -qE '(^|/)\.cursor/mcp\.json$' "$gitignore"; then
      if [[ -n "$(tail -c1 "$gitignore" 2>/dev/null || true)" ]]; then
        printf '\n' >> "$gitignore"
      fi
      {
        echo '# Dev Workspace MCP consumer (token scoped — install-kit)'
        echo '.cursor/mcp.json'
      } >> "$gitignore"
    fi
  fi

  echo "     .cursor/mcp.json → consumidor dev-workspace (token scoped)"
}

resolve_source
TARGET="$(cd "$TARGET" && pwd)"
BRIDGE="$TARGET/.dev-workspace"
mkdir -p "$BRIDGE"

if [[ -z "$MCP_URL" ]]; then
  MCP_URL="$(derive_mcp_url "${DEV_WORKSPACE_URL:-$API_URL}")"
fi

try_register_consumer

cp "$SCRIPT_DIR/install.sh" "$BRIDGE/install.sh"
chmod +x "$BRIDGE/install.sh"
cp "$SCRIPT_DIR/.env.example" "$BRIDGE/.env.example"

if [[ ! -f "$BRIDGE/imported-prompts.json" ]]; then
  if [[ -f "$SCRIPT_DIR/imported-prompts.json.example" ]]; then
    cp "$SCRIPT_DIR/imported-prompts.json.example" "$BRIDGE/imported-prompts.json"
  else
    echo '{}' > "$BRIDGE/imported-prompts.json"
  fi
fi

if [[ "$MERGE" != true || ! -f "$BRIDGE/.env" ]]; then
  if [[ -z "$DW_ROOT" && -d "$TARGET/../dev-workspace/workspace_data" ]]; then
    DW_ROOT="$(cd "$TARGET/../dev-workspace" && pwd)"
  fi
  if [[ -n "$API_TOKEN" ]]; then
    {
      echo "DEV_WORKSPACE_URL=$API_URL"
      echo "DEV_WORKSPACE_MCP_URL=$MCP_URL"
      echo "DEV_WORKSPACE_API_TOKEN=$API_TOKEN"
      [[ -n "$DW_ROOT" ]] && echo "DEV_WORKSPACE_ROOT=$DW_ROOT"
    } > "$BRIDGE/.env"
  elif [[ -n "$DW_ROOT" ]]; then
    {
      echo "DEV_WORKSPACE_ROOT=$DW_ROOT"
      echo "# DEV_WORKSPACE_URL=$API_URL"
      echo "# DEV_WORKSPACE_API_TOKEN="
    } > "$BRIDGE/.env"
  elif [[ ! -f "$BRIDGE/.env" ]]; then
    cp "$SCRIPT_DIR/.env.example" "$BRIDGE/.env"
  fi
fi

mkdir -p "$TARGET/.cursor/skills/dev-workspace" "$TARGET/.claude/skills/dev-workspace"
cp "$SCRIPT_DIR/skill-dev-workspace.md" "$TARGET/.cursor/skills/dev-workspace/SKILL.md"
cp "$SCRIPT_DIR/skill-dev-workspace.md" "$TARGET/.claude/skills/dev-workspace/SKILL.md"

if [[ -f "$SCRIPT_DIR/command-dev-workspace.md" ]]; then
  mkdir -p "$TARGET/.cursor/commands"
  cp "$SCRIPT_DIR/command-dev-workspace.md" "$TARGET/.cursor/commands/dev-workspace.md"
fi

ensure_gitignore_dev_workspace

install_mcp_config

# Remover artefatos legados
rm -rf \
  "$BRIDGE/templates" \
  "$BRIDGE/ARCHITECTURE.md" \
  "$BRIDGE/README.md" \
  "$BRIDGE/api-reference.md" \
  "$BRIDGE/bootstrap-ai-rules.md" \
  "$TARGET/.cursor/commands/bootstrap-dev-workspace.md" \
  "$TARGET/.cursor/commands/dev-workspace-planning.md" \
  "$TARGET/.cursor/rules/dev-workspace-bridge.mdc" \
  "$TARGET/.cursor/skills/dev-workspace-planning" \
  "$TARGET/.claude/skills/dev-workspace-bridge" \
  "$TARGET/.claude/skills/dev-workspace-planning" \
  2>/dev/null || true

if [[ -n "$CLEANUP" ]]; then rm -rf "$CLEANUP"; fi

echo "OK → $BRIDGE/.env + skill dev-workspace (Cursor + Claude)"
echo "     .gitignore → .dev-workspace/ ignorado"
echo "     MCP: servidor DW central; este repo = consumidor (token em mcp.json)"
if [[ -z "${DEV_WORKSPACE_REGISTER_TOKEN:-}" && "$NO_REGISTER" != true ]]; then
  echo "Tip: export DEV_WORKSPACE_REGISTER_TOKEN para auto-registrar no DW (ver logs do container)"
fi
