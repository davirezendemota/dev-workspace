import { ApiError, errorResponse } from '@/app/lib/server/api-error';
import {
  requireProjectAccess,
  resolveApiAuthOptional,
} from '@/app/lib/server/api-auth';
import {
  decodePdfBase64,
  extractTextFromPdfBuffer,
} from '@/app/lib/server/pdf-text';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = resolveApiAuthOptional(request);
    const { id } = await context.params;
    requireProjectAccess(auth, id);

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file === 'string') {
        throw new ApiError(400, 'Campo multipart "file" é obrigatório.');
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename =
        typeof file.name === 'string' && file.name.trim() ? file.name.trim() : 'document.pdf';
      const result = await extractTextFromPdfBuffer(buffer, filename);
      return Response.json(result);
    }

    const body = (await request.json()) as {
      pdf_base64?: string;
      filename?: string;
    };
    const pdfBase64 = typeof body.pdf_base64 === 'string' ? body.pdf_base64 : '';
    if (!pdfBase64.trim()) {
      throw new ApiError(400, 'Envie multipart "file" ou JSON { "pdf_base64": "..." }.');
    }
    const filename =
      typeof body.filename === 'string' && body.filename.trim()
        ? body.filename.trim()
        : 'document.pdf';
    const buffer = decodePdfBase64(pdfBase64);
    const result = await extractTextFromPdfBuffer(buffer, filename);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
