import { ApiError, errorResponse } from '@/app/lib/server/api-error';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import {
  contentDispositionAttachment,
  readCheckpointDocumentFile,
} from '@/app/lib/server/checkpoint-documents';
import {
  findCheckpointDocument,
  removeCheckpointDocument,
} from '@/app/lib/server/projects';
import { normalizeCheckpoints } from '@/app/lib/checkpoints';

type RouteContext = {
  params: Promise<{ id: string; index: string; docId: string }>;
};

function parseCheckpointIndex(raw: string): number {
  const index = Number.parseInt(raw, 10);
  if (Number.isNaN(index) || index < 0) {
    throw new ApiError(400, 'Índice de checkpoint inválido.');
  }
  return index;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id, index: indexRaw, docId } = await context.params;
    requireProjectAccess(auth, id);

    const index = parseCheckpointIndex(indexRaw);
    const document = findCheckpointDocument(id, index, docId);
    const buffer = readCheckpointDocumentFile(id, document.id);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Disposition': contentDispositionAttachment(document.filename),
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id, index: indexRaw, docId } = await context.params;
    requireProjectAccess(auth, id);

    const index = parseCheckpointIndex(indexRaw);
    const result = removeCheckpointDocument(id, index, docId);
    if (!result) {
      throw new ApiError(404, 'Project not found');
    }

    return Response.json({
      deleted: result.document,
      checkpoints: normalizeCheckpoints(
        result.project.json_data.checkpoints,
        typeof result.project.json_data.topDate === 'string'
          ? result.project.json_data.topDate
          : undefined,
      ),
      project: result.project,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
