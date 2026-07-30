import { errorResponse } from '@/app/lib/server/api-error';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import { generateProjectPlan } from '@/app/lib/server/project-plan-generate';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);
    const body = await request.json();
    const milestoneId = typeof body?.milestoneId === 'string' ? body.milestoneId : '';
    return Response.json(
      await generateProjectPlan({ projectId: id, milestoneId }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
