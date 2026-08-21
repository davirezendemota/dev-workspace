import { ApiError, errorResponse } from '@/app/lib/server/api-error';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import {
  assertAllowedDocument,
  deleteCheckpointDocumentFile,
  mimeTypeForDocument,
  sanitizeOriginalFilename,
  writeCheckpointDocumentFile,
} from '@/app/lib/server/checkpoint-documents';
import {
  addCheckpointDocument,
  getProjectCheckpoints,
} from '@/app/lib/server/projects';
import { normalizeCheckpoints } from '@/app/lib/checkpoints';

type RouteContext = {
  params: Promise<{ id: string; index: string }>;
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
    const { id, index: indexRaw } = await context.params;
    requireProjectAccess(auth, id);

    const index = parseCheckpointIndex(indexRaw);
    const checkpoints = getProjectCheckpoints(id);
    if (index >= checkpoints.length) {
      throw new ApiError(404, 'Checkpoint não encontrado.');
    }

    return Response.json({ documents: checkpoints[index].documents });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id, index: indexRaw } = await context.params;
    requireProjectAccess(auth, id);

    const index = parseCheckpointIndex(indexRaw);
    const checkpoints = getProjectCheckpoints(id);
    if (index >= checkpoints.length) {
      throw new ApiError(404, 'Checkpoint não encontrado.');
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      throw new ApiError(400, 'Envie multipart/form-data com o campo "file".');
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      throw new ApiError(400, 'Campo multipart "file" é obrigatório.');
    }

    const filename = sanitizeOriginalFilename(
      typeof file.name === 'string' ? file.name : 'documento',
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    assertAllowedDocument(filename, buffer.length);

    const documentId = writeCheckpointDocumentFile(id, buffer);
    const document = {
      id: documentId,
      filename,
      mimeType: mimeTypeForDocument(filename, file.type),
      size: buffer.length,
      uploadedAt: new Date().toISOString(),
    };

    try {
      const project = addCheckpointDocument(id, index, document);
      if (!project) {
        throw new ApiError(404, 'Project not found');
      }

      return Response.json({
        document,
        checkpoints: normalizeCheckpoints(
          project.json_data.checkpoints,
          typeof project.json_data.topDate === 'string'
            ? project.json_data.topDate
            : undefined,
        ),
        project,
      });
    } catch (error) {
      deleteCheckpointDocumentFile(id, documentId);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
