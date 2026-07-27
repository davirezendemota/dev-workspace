'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import AgentMarkdownField from './AgentMarkdownField';
import type { AgentApiResponse } from './data';

const DEFAULT_CONTENT = `## Identidade

Descreva o papel e o tom do prompt.

## Stack principal

- Item 1
- Item 2

## Como você trabalha

- Diretriz 1
- Diretriz 2
`;

type AddAgentModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (agent: AgentApiResponse) => void;
  agentsFolder?: string | null;
};

export default function AddAgentModal({
  open,
  onClose,
  onCreated,
  agentsFolder,
}: AddAgentModalProps) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setContent(DEFAULT_CONTENT);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Informe o nome do prompt.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          content: content.trim(),
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

      const created: AgentApiResponse = await response.json();
      toast.success('Prompt criado', {
        description: `${created.id}.md salvo na pasta de prompts.`,
      });
      onCreated(created);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o prompt.');
    } finally {
      setSubmitting(false);
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
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-fade-up relative z-10 flex max-h-[min(90vh,800px)] w-full max-w-[960px] flex-col border border-[var(--color-divider)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-divider)] px-6 py-5">
          <div>
            <p className="chk mb-2">Novo prompt</p>
            <h2
              id={titleId}
              className="text-[28px] font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
            >
              Adicionar prompt
            </h2>
            <p
              className="mt-1.5 text-[13px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              O arquivo markdown é gerado na pasta de prompts.
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
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

            <div className="flex flex-col gap-4">
              <p
                className="text-[13px] italic"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                }}
              >
                {agentsFolder ? (
                  <>
                    Destino:{' '}
                    <span style={{ color: 'var(--color-text)' }}>
                      {agentsFolder}/&lt;slug&gt;.md
                    </span>
                  </>
                ) : (
                  <>
                    Destino:{' '}
                    <span style={{ color: 'var(--color-text)' }}>
                      agents/&lt;slug&gt;.md
                    </span>
                  </>
                )}
              </p>

              <Field label="Nome" htmlFor="a-name">
                <input
                  ref={firstFieldRef}
                  id="a-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dev Fullstack"
                  disabled={submitting}
                  required
                />
              </Field>

              <AgentMarkdownField
                key={open ? 'open' : 'closed'}
                id="a-content"
                label="Conteúdo"
                hint="Markdown com identidade, stack e diretrizes do prompt."
                value={content}
                onChange={setContent}
                disabled={submitting}
                heightClassName="h-[400px]"
              />
            </div>
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-[var(--color-divider)] px-6 py-4">
            <button
              type="button"
              className="btn"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Criando…' : 'Criar prompt'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
        style={{
          fontFamily: 'var(--font-heading)',
          color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
        }}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p
          className="mt-1.5 text-[12px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
