import { errorResponse } from '@/app/lib/server/api-error';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import {
  getProjectPlans,
  saveProjectPlans,
} from '@/app/lib/server/projects';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);
    return Response.json(getProjectPlans(id));
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
    return Response.json(await saveProjectPlans(id, body));
  } catch (error) {
    return errorResponse(error);
  }
}
