'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AiResponseSkeleton from '@/app/components/AiResponseSkeleton';
import Markdown from './Markdown';
import { tabHref, type Project } from './data';

function IconAi() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#workspace-icon-gradient)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1 1 3z" />
      <path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function detectProjectFromPrompt(prompt: string, projects: Project[]): string | null {
  const query = prompt.toLowerCase();
  for (const project of projects) {
    if (project.name && query.includes(project.name.toLowerCase())) {
      return project.id;
    }
    if (project.client && project.client !== '—' && query.includes(project.client.toLowerCase())) {
      return project.id;
    }
  }
  return null;
}

type ProjectAiChatPanelProps = {
  projects: Project[];
  aiConfigured: boolean;
  settingsLoaded: boolean;
  onReferencedProject?: (projectId: string) => void;
};

export default function ProjectAiChatPanel({
  projects,
  aiConfigured,
  settingsLoaded,
  onReferencedProject,
}: ProjectAiChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [referencedProject, setReferencedProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!referencedProject) return;

    const dismissReferencedProject = () => {
      setReferencedProject(null);
    };

    document.addEventListener('click', dismissReferencedProject);
    return () => {
      document.removeEventListener('click', dismissReferencedProject);
    };
  }, [referencedProject]);

  const submitPrompt = useCallback(
    async (text: string) => {
      if (!aiConfigured || aiLoading) return;

      const question = text.trim();
      if (!question) return;

      setLastQuestion(question);
      setReferencedProject(null);
      setAiLoading(true);
      setAiError(null);

      try {
        const response = await fetch('/api/projects/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: question }),
        });

        if (!response.ok) {
          let detail = 'Falha ao consultar a IA.';
          try {
            const body = await response.json();
            if (typeof body?.detail === 'string') detail = body.detail;
          } catch {
            /* ignore */
          }
          throw new Error(detail);
        }

        const data: { answer?: string; referenced_project_id?: string | null } =
          await response.json();
        const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
        if (!answer) {
          throw new Error('A IA retornou uma resposta vazia.');
        }

        setAiReply(answer);

        const projectId =
          (typeof data.referenced_project_id === 'string' && data.referenced_project_id) ||
          detectProjectFromPrompt(question, projects);

        const referenced = projects.find((project) => project.id === projectId);
        if (referenced) {
          setReferencedProject({ id: referenced.id, name: referenced.name });
          onReferencedProject?.(referenced.id);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Falha ao consultar a IA.';
        setAiError(message);
        setAiReply(null);
      } finally {
        setAiLoading(false);
      }
    },
    [aiConfigured, aiLoading, onReferencedProject, projects],
  );

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;
    setPrompt('');
    await submitPrompt(text);
  };

  const handleResend = async () => {
    if (!lastQuestion) return;
    await submitPrompt(lastQuestion);
  };

  const hasConversation = Boolean(lastQuestion && (aiLoading || aiReply || aiError));

  return (
    <>
      <div className="ai-chat-fab">
        <button
          type="button"
          className="ai-chat-fab__button"
          aria-label={open ? 'Fechar assistente de IA' : 'Abrir assistente de IA'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <IconAi />
        </button>
      </div>

      {open ? (
        <section
          className="ai-chat-panel fixed z-[60] flex w-[min(420px,calc(100vw-48px))] flex-col overflow-hidden border border-[var(--color-divider)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
          style={{ maxHeight: 'min(560px, calc(100vh - 120px))' }}
          aria-label="Assistente de IA"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-divider)] px-4 py-3">
            <div>
              <p className="chk m-0">Assistente</p>
              <p
                className="m-0 mt-0.5 text-[12px] italic"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                }}
              >
                Pergunte sobre seus projetos
              </p>
            </div>
            <button
              type="button"
              className="btn shrink-0"
              style={{ width: 34, minHeight: 34, padding: 0 }}
              aria-label="Fechar"
              onClick={() => setOpen(false)}
            >
              <IconClose />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {!aiConfigured && settingsLoaded ? (
              <div className="border border-[var(--color-divider)] px-4 py-5 text-center">
                <p className="chk mb-3">IA não configurada</p>
                <p
                  className="m-0 text-[14px] leading-relaxed"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'color-mix(in srgb, var(--color-text) 78%, transparent)',
                  }}
                >
                  Configure o provedor, modelo e API token em Settings antes de usar o
                  assistente.
                </p>
                <Link href={tabHref('settings')} className="btn btn-primary mt-4">
                  Ir para Settings
                </Link>
              </div>
            ) : null}

            {aiConfigured || !settingsLoaded ? (
              <>
                {!hasConversation ? (
                  <p
                    className="m-0 text-[14px] leading-relaxed"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                    }}
                  >
                    Descreva a tarefa ou faça uma pergunta sobre os projetos do workspace.
                  </p>
                ) : null}

                {hasConversation ? (
                  <div className="flex flex-col gap-4">
                    <div className="border border-[var(--color-divider)] p-4">
                      <div className="mb-1.5 flex items-start justify-between gap-3">
                        <p
                          className="m-0 flex-1 text-[14px] leading-relaxed italic"
                          style={{
                            fontFamily: 'var(--font-body)',
                            color: 'color-mix(in srgb, var(--color-text) 68%, transparent)',
                          }}
                        >
                          {lastQuestion}
                        </p>
                        <button
                          type="button"
                          className="btn shrink-0"
                          style={{ width: 34, minHeight: 34, padding: 0, border: 'none' }}
                          onClick={() => void handleResend()}
                          disabled={!aiConfigured || aiLoading}
                          aria-label="Reenviar"
                        >
                          <IconRefresh />
                        </button>
                      </div>

                      {aiLoading ? (
                        <>
                          <div className="chk mb-3">Consultando os projetos…</div>
                          <AiResponseSkeleton />
                        </>
                      ) : null}

                      {!aiLoading && aiError ? (
                        <div
                          className="text-[14px]"
                          style={{
                            background: 'var(--color-accent-100)',
                            color: 'var(--color-accent-800)',
                            fontFamily: 'var(--font-body)',
                          }}
                          role="alert"
                        >
                          {aiError}
                        </div>
                      ) : null}

                      {!aiLoading && aiReply ? (
                        <>
                          <div className="chk mb-3">Resposta</div>
                          <Markdown preview className="ai-chat-markdown text-[14px] leading-relaxed">
                            {aiReply}
                          </Markdown>
                          {referencedProject ? (
                            <p
                              className="anim-fade-in m-0 mt-4 border-t border-[var(--color-divider)] pt-4 text-[14px]"
                              style={{ fontFamily: 'var(--font-body)' }}
                            >
                              Projeto referenciado:{' '}
                              <strong>{referencedProject.name}</strong>
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <footer className="shrink-0 border-t border-[var(--color-divider)] p-4">
            <div className="relative">
              <input
                className="input input-ai w-full text-[15px]"
                style={{
                  minHeight: 46,
                  paddingRight: prompt.trim() ? 48 : undefined,
                }}
                placeholder="Descreva a tarefa ou faça uma pergunta…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSend();
                }}
                disabled={!aiConfigured || aiLoading}
              />
              {prompt.trim() ? (
                <button
                  type="button"
                  className="btn btn-primary anim-fade-in absolute top-1/2 right-1.5 -translate-y-1/2"
                  style={{ width: 34, minHeight: 34, padding: 0 }}
                  aria-label="Enviar"
                  onClick={() => void handleSend()}
                  disabled={!aiConfigured || aiLoading}
                >
                  <IconSend />
                </button>
              ) : null}
            </div>
          </footer>
        </section>
      ) : null}
    </>
  );
}
