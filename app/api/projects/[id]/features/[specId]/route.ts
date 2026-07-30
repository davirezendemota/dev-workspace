import { errorResponse } from '@/app/lib/server/api-error';
import { getProjectFeatureContent } from '@/app/lib/server/projects';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';

type RouteContext = {
  params: Promise<{ id: string; specId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id, specId } = await context.params;
    requireProjectAccess(auth, id);

    const feature = await getProjectFeatureContent(id, specId);
    if (!feature) {
      return Response.json({ detail: 'Project not found' }, { status: 404 });
    }
    return Response.json(feature);
  } catch (error) {
    return errorResponse(error);
  }
}
