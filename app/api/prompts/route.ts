import { errorResponse } from '@/app/lib/server/api-error';
import { listPrompts } from '@/app/lib/server/prompts';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = Number(searchParams.get('skip') ?? '0');
    const limit = Number(searchParams.get('limit') ?? '100');
    const q = searchParams.get('q') ?? searchParams.get('search') ?? undefined;
    const result = listPrompts(skip, limit, q);
    return Response.json(result.items);
  } catch (error) {
    return errorResponse(error);
  }
}
