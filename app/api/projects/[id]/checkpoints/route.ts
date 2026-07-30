import { normalizeCheckpoints } from '@/app/lib/checkpoints';
import { errorResponse } from '@/app/lib/server/api-error';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import {
  getProjectCheckpoints,
  updateProjectCheckpoints,
} from '@/app/lib/server/projects';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);
    const checkpoints = getProjectCheckpoints(id);
    return Response.json({ checkpoints });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);
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
