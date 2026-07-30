import { errorResponse } from '@/app/lib/server/api-error';
import { askAboutProjects } from '@/app/lib/server/project-ai';
import {
  consumerProjectIds,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';

export async function POST(request: Request) {
  try {
    const auth = resolveApiAuthOptional(request);
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const result = await askAboutProjects(prompt, consumerProjectIds(auth));
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
