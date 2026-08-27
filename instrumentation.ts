export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureWorkspaceApiToken } = await import('./app/lib/server/api-token');
    const { ensureWorkspaceInstallToken } = await import('./app/lib/server/install-token');
    const { rebuildConsumerTokenRegistry } = await import('./app/lib/server/projects');
    ensureWorkspaceApiToken();
    ensureWorkspaceInstallToken();
    rebuildConsumerTokenRegistry();
  }
}
