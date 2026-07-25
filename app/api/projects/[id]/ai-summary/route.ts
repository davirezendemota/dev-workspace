import { errorResponse } from '@/app/lib/server/api-error';
import { generateProjectAiSummary } from '@/app/lib/server/project-ai-summary';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const project = await generateProjectAiSummary(id);
    return Response.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}
