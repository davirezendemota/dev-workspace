import { ApiError } from './api-error';
import { getWorkspaceApiToken } from './api-token';
import { resolveConsumerScope } from './consumer-api-token';

export type ApiAuthScope =
  | { type: 'admin' }
  | { type: 'consumer'; local_path: string; project_ids: string[] };

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export function resolveApiAuth(request: Request): ApiAuthScope | null {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  const adminToken = getWorkspaceApiToken();
  if (adminToken && token === adminToken) {
    return { type: 'admin' };
  }

  const consumer = resolveConsumerScope(token);
  if (consumer) {
    return {
      type: 'consumer',
      local_path: consumer.local_path,
      project_ids: consumer.project_ids,
    };
  }

  return null;
}

export function requireApiAuth(request: Request): ApiAuthScope {
  const scope = resolveApiAuth(request);
  if (!scope) {
    throw new ApiError(
      401,
      'Unauthorized. Use Authorization: Bearer <DEV_WORKSPACE_API_TOKEN> (consumer token scoped to this repo, or admin token from DW logs).',
    );
  }
  return scope;
}

export function canAccessProject(scope: ApiAuthScope, projectId: string): boolean {
  if (scope.type === 'admin') {
    return true;
  }
  return scope.project_ids.includes(projectId);
}

export function requireProjectAccess(scope: ApiAuthScope, projectId: string): void {
  if (!canAccessProject(scope, projectId)) {
    throw new ApiError(403, 'Forbidden. Consumer token cannot access this project.');
  }
}

export function filterProjectsForScope<T extends { id: string }>(
  items: T[],
  scope: ApiAuthScope,
): T[] {
  if (scope.type === 'admin') {
    return items;
  }
  const allowed = new Set(scope.project_ids);
  return items.filter((item) => allowed.has(item.id));
}

export function resolveApiAuthOptional(request: Request): ApiAuthScope {
  const token = extractBearerToken(request);
  if (!token) {
    return { type: 'admin' };
  }

  const scope = resolveApiAuth(request);
  if (!scope) {
    throw new ApiError(
      401,
      'Unauthorized. Invalid API token (use consumer token from GET /api/projects/{id}/connection or admin token from DW logs).',
    );
  }
  return scope;
}

export function consumerProjectIds(scope: ApiAuthScope): string[] | null {
  if (scope.type === 'admin') {
    return null;
  }
  return scope.project_ids;
}

export function requireAdminAuth(request: Request): void {
  const scope = resolveApiAuthOptional(request);
  if (scope.type !== 'admin') {
    throw new ApiError(403, 'Forbidden. Admin token or same-origin UI required.');
  }
}
