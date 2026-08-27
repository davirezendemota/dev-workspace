import { isValidWorkspaceApiToken } from './api-token';
import { ApiError } from './api-error';
import { extractBearerToken } from './api-auth';
import { isValidWorkspaceInstallToken } from './install-token';

/** Install-kit register endpoint — install token or admin token. */
export function requireInstallAuth(request: Request): void {
  const token = extractBearerToken(request);
  if (!token) {
    throw new ApiError(
      401,
      'Unauthorized. Use Authorization: Bearer <DEV_WORKSPACE_REGISTER_TOKEN>.',
    );
  }

  if (isValidWorkspaceInstallToken(token) || isValidWorkspaceApiToken(token)) {
    return;
  }

  throw new ApiError(401, 'Unauthorized. Invalid install or admin token.');
}
