import { errorResponse } from '@/app/lib/server/api-error';
import { getPrompt } from '@/app/lib/server/prompts';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const prompt = getPrompt(id);
    if (!prompt) {
      return Response.json({ detail: 'Prompt not found' }, { status: 404 });
    }
    return Response.json(prompt);
  } catch (error) {
    return errorResponse(error);
  }
}
