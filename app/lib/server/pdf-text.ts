import pdf from 'pdf-parse';

const MAX_PDF_BYTES = Number(process.env.MAX_PDF_BYTES ?? 20 * 1024 * 1024);

export type PdfExtractResult = {
  text: string;
  pages: number;
  filename: string;
  char_count: number;
};

export async function extractTextFromPdfBuffer(
  buffer: Buffer,
  filename = 'document.pdf',
): Promise<PdfExtractResult> {
  if (!buffer.length) {
    throw new Error('PDF vazio.');
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(
      `PDF excede o limite de ${Math.floor(MAX_PDF_BYTES / (1024 * 1024))}MB.`,
    );
  }
  if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error('Conteúdo não parece um PDF.');
  }

  const parsed = await pdf(buffer);
  const text = (parsed.text ?? '').trim();
  if (!text) {
    throw new Error('Nenhum texto extraído do PDF (pode ser scan sem OCR).');
  }

  return {
    text,
    pages: parsed.numpages ?? 0,
    filename,
    char_count: text.length,
  };
}

export function decodePdfBase64(input: string): Buffer {
  const trimmed = input.trim();
  const payload = trimmed.startsWith('data:') && trimmed.includes(',')
    ? trimmed.slice(trimmed.indexOf(',') + 1)
    : trimmed;
  return Buffer.from(payload, 'base64');
}
