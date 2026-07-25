import { errorResponse } from '@/app/lib/server/api-error';
import {
  deleteAgent,
  getAgent,
  updateAgent,
  type AgentUpdateInput,
} from '@/app/lib/server/agents';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const agent = getAgent(id);
    if (!agent) {
      return Response.json({ detail: 'Agent not found' }, { status: 404 });
    }
    return Response.json(agent);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as AgentUpdateInput;
    const agent = updateAgent(id, body);
    if (!agent) {
      return Response.json({ detail: 'Agent not found' }, { status: 404 });
    }
    return Response.json(agent);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!deleteAgent(id)) {
      return Response.json({ detail: 'Agent not found' }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
