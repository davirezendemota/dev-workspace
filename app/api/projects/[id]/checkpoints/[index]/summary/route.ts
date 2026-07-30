import { normalizeCheckpoints } from '@/app/lib/checkpoints';
import { errorResponse } from '@/app/lib/server/api-error';
import { generateCheckpointSummary } from '@/app/lib/server/project-checkpoint-summary';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';

type RouteContext = {
  params: Promise<{ id: string; index: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id, index: indexRaw } = await context.params;
    requireProjectAccess(auth, id);

    const index = Number.parseInt(indexRaw, 10);
    if (Number.isNaN(index) || index < 0) {
      return Response.json({ detail: 'Índice de checkpoint inválido.' }, { status: 400 });
    }

    const project = await generateCheckpointSummary(id, index);
    const checkpoints = normalizeCheckpoints(
      project.json_data.checkpoints,
      typeof project.json_data.topDate === 'string'
        ? project.json_data.topDate
        : undefined,
    );

    return Response.json({ checkpoints, project });
  } catch (error) {
    return errorResponse(error);
  }
}
