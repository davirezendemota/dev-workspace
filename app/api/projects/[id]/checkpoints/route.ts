import { normalizeCheckpoints, type Checkpoint } from '@/app/lib/checkpoints';
import { errorResponse } from '@/app/lib/server/api-error';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import {
  getProjectCheckpoints,
  updateProjectCheckpoints,
} from '@/app/lib/server/projects';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function preserveOmittedDocuments(
  raw: unknown[],
  incoming: Checkpoint[],
  existing: Checkpoint[],
): Checkpoint[] {
  if (incoming.length !== existing.length) return incoming;

  return incoming.map((checkpoint, index) => {
    const source = raw[index];
    const omitted =
      !source || typeof source !== 'object' || !('documents' in source);
    if (!omitted) return checkpoint;
    const previous = existing[index];
    if (!previous?.documents.length) return checkpoint;
    return { ...checkpoint, documents: previous.documents };
  });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);
    const checkpoints = getProjectCheckpoints(id);
    return Response.json({ checkpoints });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);
    const body = await request.json();
    const raw = Array.isArray(body?.checkpoints) ? body.checkpoints : [];
    const incoming = normalizeCheckpoints(raw, body?.topDate);
    const existing = getProjectCheckpoints(id);
    const checkpoints = preserveOmittedDocuments(raw, incoming, existing);
    const project = updateProjectCheckpoints(id, checkpoints);
    if (!project) {
      return Response.json({ detail: 'Project not found' }, { status: 404 });
    }
    return Response.json({
      checkpoints: normalizeCheckpoints(
        project.json_data.checkpoints,
        typeof project.json_data.topDate === 'string'
          ? project.json_data.topDate
          : undefined,
      ),
      project,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
