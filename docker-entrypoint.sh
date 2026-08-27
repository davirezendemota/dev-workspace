#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

if [ -d /data ]; then
  chown -R "${PUID}:${PGID}" /data
fi

CONFIG_PATH="${WORKSPACE_CONFIG_PATH:-/data/config.json}"
TOKEN_DIR="$(dirname "$CONFIG_PATH")"
TOKEN_FILE="$TOKEN_DIR/api_token"
INSTALL_TOKEN_FILE="$TOKEN_DIR/install_token"

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

if [ -n "${WORKSPACE_INSTALL_TOKEN:-}" ]; then
  printf '%s\n' "$WORKSPACE_INSTALL_TOKEN" > "$INSTALL_TOKEN_FILE"
elif [ -f "$INSTALL_TOKEN_FILE" ]; then
  WORKSPACE_INSTALL_TOKEN="$(tr -d '\n\r' < "$INSTALL_TOKEN_FILE")"
else
  if command -v openssl >/dev/null 2>&1; then
    WORKSPACE_INSTALL_TOKEN="$(openssl rand -hex 32)"
  else
    WORKSPACE_INSTALL_TOKEN="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  printf '%s\n' "$WORKSPACE_INSTALL_TOKEN" > "$INSTALL_TOKEN_FILE"
fi

chown "${PUID}:${PGID}" "$TOKEN_FILE" "$INSTALL_TOKEN_FILE"
chmod 600 "$TOKEN_FILE" "$INSTALL_TOKEN_FILE"

export WORKSPACE_API_TOKEN
export WORKSPACE_INSTALL_TOKEN

echo ""
echo "============================================================"
echo "Dev Workspace API token (copy to consumer .dev-workspace/.env):"
echo "DEV_WORKSPACE_API_TOKEN=$WORKSPACE_API_TOKEN"
echo "============================================================"
echo ""
echo "============================================================"
echo "Dev Workspace install token (system env for install-kit):"
echo "DEV_WORKSPACE_REGISTER_TOKEN=$WORKSPACE_INSTALL_TOKEN"
echo "============================================================"
echo ""

if [ "${NODE_ENV:-}" = "development" ] && [ -f /app/package.json ]; then
  npm install
  chown -R "${PUID}:${PGID}" /app/node_modules /app/.next 2>/dev/null || true
fi

run_as_app() {
  exec su-exec "${PUID}:${PGID}" env \
    WORKSPACE_API_TOKEN="$WORKSPACE_API_TOKEN" \
    WORKSPACE_INSTALL_TOKEN="$WORKSPACE_INSTALL_TOKEN" \
    "$@"
}

run_as_app "$@"
