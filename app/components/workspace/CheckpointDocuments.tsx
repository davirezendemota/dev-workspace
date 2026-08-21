'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CHECKPOINT_DOCUMENT_ACCEPT,
  type Checkpoint,
  type CheckpointDocument,
} from '@/app/lib/checkpoints';
import type { ProjectApiResponse } from './AddProjectModal';

type CheckpointDocumentsProps = {
  projectId: string;
  checkpointIndex: number;
  documents: CheckpointDocument[];
  onUpdated: (checkpoints: Checkpoint[], project?: ProjectApiResponse) => void;
};

function IconPaperclip() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string' && body.detail.trim()) return body.detail;
  } catch {
    /* ignore */
  }
  return fallback;
}

export default function CheckpointDocuments({
  projectId,
  checkpointIndex,
  documents,
  onUpdated,
}: CheckpointDocumentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const documentsUrl = `/api/projects/${projectId}/checkpoints/${checkpointIndex}/documents`;

  const applyPayload = (data: {
    checkpoints?: Checkpoint[];
    project?: ProjectApiResponse;
  }) => {
    if (Array.isArray(data.checkpoints)) {
      onUpdated(data.checkpoints, data.project);
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0 || uploading) return;

    setUploading(true);
    try {
      for (const file of list) {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch(documentsUrl, { method: 'POST', body: form });
        if (!response.ok) {
          throw new Error(await readApiError(response, `Falha ao enviar ${file.name}.`));
        }
        applyPayload(await response.json());
      }
      toast.success(
        list.length === 1 ? 'Documento enviado.' : `${list.length} documentos enviados.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar o documento.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const deleteDocument = async (document: CheckpointDocument) => {
    if (deletingId || uploading) return;
    setDeletingId(document.id);
    try {
      const response = await fetch(`${documentsUrl}/${document.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Não foi possível excluir o documento.'));
      }
      applyPayload(await response.json());
      toast.success('Documento excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível excluir o documento.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Documentos">
      <div className="flex items-center justify-between gap-3">
        <h3
          className="text-[12px] font-medium uppercase tracking-wide"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
          }}
        >
          Documentos
        </h3>
        <button
          type="button"
          className="btn text-[12px]"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Enviando…' : 'Enviar'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={CHECKPOINT_DOCUMENT_ACCEPT}
          multiple
          disabled={uploading}
          onChange={(event) => {
            if (event.target.files) void uploadFiles(event.target.files);
          }}
        />
      </div>

      {documents.length === 0 ? (
        <p
          className="text-[13px]"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
          }}
        >
          Nenhum documento anexado. PDF, imagens e arquivos Office até 20MB.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {documents.map((document) => {
            const uploadedLabel = formatUploadedAt(document.uploadedAt);
            return (
              <li
                key={document.id}
                className="flex items-start gap-2 border border-[var(--color-divider)] px-3 py-2"
              >
                <span
                  className="mt-0.5 flex-none text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]"
                  aria-hidden
                >
                  <IconPaperclip />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-medium"
                    style={{ fontFamily: 'var(--font-heading)' }}
                    title={document.filename}
                  >
                    {document.filename}
                  </p>
                  <p
                    className="mt-0.5 text-[11px]"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
                    }}
                  >
                    {formatBytes(document.size)}
                    {uploadedLabel ? ` · ${uploadedLabel}` : ''}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-0.5">
                  <a
                    className="flex h-7 w-7 items-center justify-center text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] transition-colors hover:text-[var(--color-accent)]"
                    href={`${documentsUrl}/${document.id}`}
                    download={document.filename}
                    title="Baixar"
                    aria-label={`Baixar ${document.filename}`}
                  >
                    <IconDownload />
                  </a>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] transition-colors hover:text-[var(--color-accent)]"
                    title="Excluir"
                    aria-label={`Excluir ${document.filename}`}
                    disabled={deletingId === document.id}
                    onClick={() => void deleteDocument(document)}
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
