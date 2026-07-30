import { errorResponse } from '@/app/lib/server/api-error';
import { getProjectConsumerConnection } from '@/app/lib/server/projects';
import { requireAdminAuth } from '@/app/lib/server/api-auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Admin / UI only — returns consumer token scoped to this project's local_path. */
export async function GET(request: Request, context: RouteContext) {
  try {
    requireAdminAuth(request);
    const { id } = await context.params;
    const connection = getProjectConsumerConnection(id);
    if (!connection) {
      return Response.json(
        { detail: 'Project not found or has no local_path for consumer access.' },
        { status: 404 },
      );
    }
    return Response.json(connection);
  } catch (error) {
    return errorResponse(error);
  }
}
