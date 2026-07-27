'use client';

import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import AgentMarkdownField from './AgentMarkdownField';
import type { Agent, AgentApiResponse } from './data';

type AgentDetailModalProps = {
  agent: Agent | null;
  onClose: () => void;
  onUpdated: (agent: AgentApiResponse) => void;
  onDeleted: (id: string) => void;
};

export default function AgentDetailModal({
  agent,
  onClose,
  onUpdated,
  onDeleted,
}: AgentDetailModalProps) {
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    setEditing(false);
    setContent(agent.content);
    setError(null);
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !deleting) {
        if (editing) {
          setContent(agent.content);
          setError(null);
          setEditing(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [agent, saving, deleting, editing, onClose]);

  if (!agent) return null;

  const busy = saving || deleting;
  const fileName = agent.localFilePath?.split('/').pop() ?? `${agent.id}.md`;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Prompt copiado');
    } catch {
      toast.error('Não foi possível copiar o prompt');
    }
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Prompt baixado');
  };

  const handleCancelEdit = () => {
    setContent(agent.content);
    setError(null);
    setEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setSaving(true);
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agent.name,
          content,
        }),
      });

      if (!response.ok) {
        let detail = `Erro ${response.status}`;
        try {
          const body = await response.json();
          if (typeof body?.detail === 'string') detail = body.detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      const updated: AgentApiResponse = await response.json();
      toast.success('Prompt atualizado');
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o prompt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remover o prompt "${agent.name}"?`)) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let detail = `Erro ${response.status}`;
        try {
          const body = await response.json();
          if (typeof body?.detail === 'string') detail = body.detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      toast.success('Prompt removido');
      onDeleted(agent.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover o prompt.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer border-0"
        style={{ background: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}
        aria-label="Fechar"
        onClick={() => {
          if (!busy) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-fade-up relative z-10 flex max-h-[min(90vh,860px)] w-full max-w-[960px] flex-col border border-[var(--color-divider)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-divider)] px-6 py-5">
          <div>
            <p className="chk mb-2">Prompt</p>
            <h2
              id={titleId}
              className="text-[28px] font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
            >
              {agent.name}
            </h2>
            <p
              className="mt-1.5 text-[13px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              {fileName}
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-5">
            {error && (
              <div
                className="mb-4 border border-[var(--color-accent)] px-3 py-2.5 text-[13px]"
                style={{
                  background: 'var(--color-accent-100)',
                  color: 'var(--color-accent-800)',
                  fontFamily: 'var(--font-body)',
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            <AgentMarkdownField
              key={`${agent.id}-${editing ? 'edit' : 'view'}`}
              id="edit-a-content"
              label="Markdown"
              hint={editing ? 'Edite o conteúdo do prompt.' : undefined}
              value={content}
              onChange={setContent}
              disabled={busy}
              readOnly={!editing}
            />
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-[var(--color-divider)] px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn"
                onClick={handleDelete}
                disabled={busy}
                style={{
                  color: 'var(--color-accent-800)',
                  borderColor: 'var(--color-accent)',
                }}
              >
                {deleting ? 'Removendo…' : 'Remover'}
              </button>

              {!editing ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                >
                  Editar
                </button>
              ) : null}
            </div>

            {editing ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn"
                  onClick={handleCancelEdit}
                  disabled={busy}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void handleCopyPrompt()}
                  disabled={busy}
                >
                  Copiar prompt
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadPrompt}
                  disabled={busy}
                >
                  Baixar prompt
                </button>
              </div>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
