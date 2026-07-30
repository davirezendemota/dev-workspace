import { errorResponse, ApiError } from '@/app/lib/server/api-error';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import {
  deleteProject,
  getProject,
  updateProject,
  type ProjectUpdateInput,
} from '@/app/lib/server/projects';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);

    const project = getProject(id);
    if (!project) {
      return Response.json({ detail: 'Project not found' }, { status: 404 });
    }
    return Response.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    if (auth.type === 'consumer') {
      throw new ApiError(403, 'Forbidden. Consumer token cannot update projects.');
    }

    const { id } = await context.params;
    const body = (await request.json()) as ProjectUpdateInput;
    const project = updateProject(id, body);
    if (!project) {
      return Response.json({ detail: 'Project not found' }, { status: 404 });
    }
    return Response.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    if (auth.type === 'consumer') {
      throw new ApiError(403, 'Forbidden. Consumer token cannot delete projects.');
    }

    const { id } = await context.params;
    if (!deleteProject(id)) {
      return Response.json({ detail: 'Project not found' }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
