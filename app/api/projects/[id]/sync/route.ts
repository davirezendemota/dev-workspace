import { errorResponse } from '@/app/lib/server/api-error';
import { syncProject } from '@/app/lib/server/projects';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const project = await syncProject(id);
    return Response.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}
