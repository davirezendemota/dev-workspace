import { errorResponse } from '@/app/lib/server/api-error';
import { getProjectSpecChecklist } from '@/app/lib/server/projects';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const checklist = await getProjectSpecChecklist(id);
    if (!checklist) {
      return Response.json({ detail: 'Project not found' }, { status: 404 });
    }
    return Response.json(checklist);
  } catch (error) {
    return errorResponse(error);
  }
}
