import { errorResponse } from '@/app/lib/server/api-error';
import { askAboutProjects } from '@/app/lib/server/project-ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const result = await askAboutProjects(prompt);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
