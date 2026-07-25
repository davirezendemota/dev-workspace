import { errorResponse } from '@/app/lib/server/api-error';
import {
  createAgent,
  listAgents,
  type AgentCreateInput,
} from '@/app/lib/server/agents';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = Number(searchParams.get('skip') ?? '0');
    const limit = Number(searchParams.get('limit') ?? '100');
    const result = listAgents(skip, limit);
    return Response.json(result.items);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentCreateInput;
    const agent = createAgent(body);
    return Response.json(agent, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
