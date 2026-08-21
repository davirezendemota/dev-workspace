import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

import { ApiError } from './api-error';
import { serverEnv } from './env';
import { slugify } from './slugify';

export const MAX_CHECKPOINT_DOCUMENT_BYTES = Number(
  process.env.MAX_CHECKPOINT_DOCUMENT_BYTES ?? 20 * 1024 * 1024,
);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.md',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
};

const DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function documentsRoot(): string {
  return path.join(path.dirname(serverEnv.WORKSPACE_CONFIG_PATH), 'checkpoint-documents');
}

function projectDocumentsDir(projectId: string): string {
  return path.join(documentsRoot(), slugify(projectId, 'projeto'));
}

export function assertDocumentId(documentId: string): string {
  const id = documentId.trim();
  if (!DOCUMENT_ID.test(id)) {
    throw new ApiError(400, 'ID de documento inválido.');
  }
  return id;
}

export function documentFilePath(projectId: string, documentId: string): string {
  return path.join(projectDocumentsDir(projectId), assertDocumentId(documentId));
}

export function sanitizeOriginalFilename(filename: string): string {
  const base = path.basename(filename).replace(/[\u0000-\u001f]/g, '').trim();
  return base || 'documento';
}

export function extensionOf(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function mimeTypeForDocument(filename: string, declaredType?: string): string {
  const fromName = MIME_BY_EXTENSION[extensionOf(filename)];
  if (fromName) return fromName;
  const declared = declaredType?.trim();
  if (declared && declared !== 'application/octet-stream') return declared;
  return 'application/octet-stream';
}

export function assertAllowedDocument(filename: string, size: number): void {
  if (size <= 0) {
    throw new ApiError(400, 'Arquivo vazio.');
  }
  if (size > MAX_CHECKPOINT_DOCUMENT_BYTES) {
    const limitMb = Math.floor(MAX_CHECKPOINT_DOCUMENT_BYTES / (1024 * 1024));
    throw new ApiError(400, `Arquivo excede o limite de ${limitMb}MB.`);
  }
  const ext = extensionOf(filename);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ApiError(
      400,
      `Tipo de arquivo não permitido (${ext || 'sem extensão'}).`,
    );
  }
}

export function writeCheckpointDocumentFile(projectId: string, buffer: Buffer): string {
  const id = randomUUID();
  fs.mkdirSync(projectDocumentsDir(projectId), { recursive: true });
  fs.writeFileSync(documentFilePath(projectId, id), buffer);
  return id;
}

export function readCheckpointDocumentFile(projectId: string, documentId: string): Buffer {
  const filePath = documentFilePath(projectId, documentId);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Arquivo não encontrado.');
  }
  return fs.readFileSync(filePath);
}

export function deleteCheckpointDocumentFile(projectId: string, documentId: string): void {
  const filePath = documentFilePath(projectId, documentId);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    fs.unlinkSync(filePath);
  }
}

export function deleteProjectDocumentDir(projectId: string): void {
  fs.rmSync(projectDocumentsDir(projectId), { recursive: true, force: true });
}

export function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii || 'documento'}"; filename*=UTF-8''${encoded}`;
}
