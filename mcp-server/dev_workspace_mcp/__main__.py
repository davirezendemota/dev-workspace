"""Entry point for the Dev Workspace MCP server."""

import os

from dev_workspace_mcp.server import mcp

if __name__ == "__main__":
    host = os.environ.get("MCP_HOST", "0.0.0.0")
    port = int(os.environ.get("MCP_PORT", "8000"))
    mcp.run(transport="streamable-http", host=host, port=port)
