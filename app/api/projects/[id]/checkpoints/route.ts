import { errorResponse } from '@/app/lib/server/api-error';
import {
  getProjectCheckpoints,
  updateProjectCheckpoints,
} from '@/app/lib/server/projects';
import { normalizeCheckpoints } from '@/app/lib/checkpoints';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const checkpoints = getProjectCheckpoints(id);
    return Response.json({ checkpoints });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const raw = Array.isArray(body?.checkpoints) ? body.checkpoints : [];
    const checkpoints = normalizeCheckpoints(raw, body?.topDate);
    const project = updateProjectCheckpoints(id, checkpoints);
    if (!project) {
      return Response.json({ detail: 'Project not found' }, { status: 404 });
    }
    return Response.json({
      checkpoints: normalizeCheckpoints(
        project.json_data.checkpoints,
        typeof project.json_data.topDate === 'string'
          ? project.json_data.topDate
          : undefined,
      ),
      project,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
