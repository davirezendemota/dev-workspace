import { errorResponse } from '@/app/lib/server/api-error';
import {
  getLocalChecklist,
  saveLocalChecklist,
} from '@/app/lib/server/projects';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return Response.json(getLocalChecklist(id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    return Response.json(saveLocalChecklist(id, body));
  } catch (error) {
    return errorResponse(error);
  }
}
