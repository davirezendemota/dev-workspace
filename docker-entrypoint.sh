#!/bin/sh
set -e

if [ -d /data ]; then
  if id nextjs >/dev/null 2>&1; then
    chown -R nextjs:nodejs /data
  fi
fi

CONFIG_PATH="${WORKSPACE_CONFIG_PATH:-/data/config.json}"
TOKEN_DIR="$(dirname "$CONFIG_PATH")"
TOKEN_FILE="$TOKEN_DIR/api_token"

mkdir -p "$TOKEN_DIR"

if [ -n "${WORKSPACE_API_TOKEN:-}" ]; then
  printf '%s\n' "$WORKSPACE_API_TOKEN" > "$TOKEN_FILE"
elif [ -f "$TOKEN_FILE" ]; then
  WORKSPACE_API_TOKEN="$(tr -d '\n\r' < "$TOKEN_FILE")"
else
  if command -v openssl >/dev/null 2>&1; then
    WORKSPACE_API_TOKEN="$(openssl rand -hex 32)"
  else
    WORKSPACE_API_TOKEN="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  printf '%s\n' "$WORKSPACE_API_TOKEN" > "$TOKEN_FILE"
fi

if id nextjs >/dev/null 2>&1; then
  chown nextjs:nodejs "$TOKEN_FILE"
fi
chmod 600 "$TOKEN_FILE"

export WORKSPACE_API_TOKEN

echo ""
echo "============================================================"
echo "Dev Workspace API token (copy to consumer .dev-workspace/.env):"
echo "DEV_WORKSPACE_API_TOKEN=$WORKSPACE_API_TOKEN"
echo "============================================================"
echo ""

run_as_app() {
  if id nextjs >/dev/null 2>&1; then
    exec su-exec nextjs env WORKSPACE_API_TOKEN="$WORKSPACE_API_TOKEN" "$@"
  fi
  exec env WORKSPACE_API_TOKEN="$WORKSPACE_API_TOKEN" "$@"
}

run_as_app "$@"
