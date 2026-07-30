import { errorResponse } from '@/app/lib/server/api-error';
import { buildProjectSpecGraph } from '@/app/lib/server/spec-graph';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);

    const graph = await buildProjectSpecGraph(id);
    if (!graph) {
      return Response.json({ detail: 'Project not found' }, { status: 404 });
    }
    return Response.json(graph);
  } catch (error) {
    return errorResponse(error);
  }
}
