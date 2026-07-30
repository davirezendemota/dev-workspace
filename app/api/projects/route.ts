import { errorResponse, ApiError } from '@/app/lib/server/api-error';
import {
  filterProjectsForScope,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import {
  bootstrapGithubProject,
  refreshStaleProjectSummaries,
} from '@/app/lib/server/project-ai-summary';
import {
  createProject,
  listProjects,
  type ProjectCreateInput,
} from '@/app/lib/server/projects';

export async function GET(request: Request) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { searchParams } = new URL(request.url);
    const skip = Number(searchParams.get('skip') ?? '0');
    const limit = Number(searchParams.get('limit') ?? '100');
    const result = listProjects(skip, limit);
    const items = filterProjectsForScope(result.items, auth);

    void refreshStaleProjectSummaries().catch((error) => {
      console.error('Falha ao atualizar resumos de IA em background:', error);
    });

    return Response.json(items);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = resolveApiAuthOptional(request);
    if (auth.type === 'consumer') {
      throw new ApiError(403, 'Forbidden. Consumer token cannot create projects.');
    }

    const body = (await request.json()) as ProjectCreateInput;
    const project = await createProject(body);
    if (body.source_type === 'github') {
      const bootstrapped = await bootstrapGithubProject(project.id);
      return Response.json(bootstrapped, { status: 201 });
    }
    return Response.json(project, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
