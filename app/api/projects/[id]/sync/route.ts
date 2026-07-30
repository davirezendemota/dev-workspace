import { errorResponse } from '@/app/lib/server/api-error';
import { syncProject } from '@/app/lib/server/projects';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);
    const project = await syncProject(id);
    return Response.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}
