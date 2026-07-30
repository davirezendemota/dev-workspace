/** Edge-safe bearer check (no filesystem). Synced via WORKSPACE_CONSUMER_TOKENS_JSON. */
export function isAuthorizedBearer(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) {
    return false;
  }

  const adminToken = process.env.WORKSPACE_API_TOKEN?.trim();
  if (adminToken && trimmed === adminToken) {
    return true;
  }

  try {
    const map = JSON.parse(process.env.WORKSPACE_CONSUMER_TOKENS_JSON ?? '{}') as Record<
      string,
      unknown
    >;
    return typeof map === 'object' && trimmed in map;
  } catch {
    return false;
  }
}
