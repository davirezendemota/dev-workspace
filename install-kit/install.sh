#!/usr/bin/env bash
# Install Dev Workspace bridge — minimal: .env + one skill. No templates/ in consumer.
set -euo pipefail

UPSTREAM_ARCHIVE="https://github.com/davirezendemota/dev-workspace/archive/refs/heads/main.tar.gz"

usage() {
  cat <<'EOF'
Usage: install.sh [TARGET_DIR] [--merge]

Install into TARGET_DIR/.dev-workspace/.env and skill dev-workspace (Cursor + Claude).

  --merge    Keep existing .env; refresh skill only

  --api-url URL
  --api-token TOKEN
  --dw-root PATH
EOF
}

TARGET="."
MERGE=false
API_URL="http://localhost:3010"
API_TOKEN=""
DW_ROOT=""
CLEANUP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --merge) MERGE=true ;;
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

resolve_source
TARGET="$(cd "$TARGET" && pwd)"
BRIDGE="$TARGET/.dev-workspace"
mkdir -p "$BRIDGE"

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

# Remover artefatos legados (instalação antiga)
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
echo "Projeto DW: registrar local_path → $TARGET"
