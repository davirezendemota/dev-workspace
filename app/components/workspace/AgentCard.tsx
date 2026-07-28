'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { Agent } from './data';

type AgentCardProps = {
  agent: Agent;
  index: number;
  pinned?: boolean;
  onOpen: (agent: Agent) => void;
  onTogglePin: (agentId: string) => void;
};

function formatUpdatedAt(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const actionBtnClass =
  'flex h-8 w-8 items-center justify-center border border-[var(--color-divider)] bg-[var(--color-bg)] transition-[border-color,color] duration-150 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]';

const actionBtnMutedStyle = {
  color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
} as const;

function IconPinOutline() {
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
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a3 3 0 0 0-6 0v4.76z" />
    </svg>
  );
}

function IconPinSolid() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 3v4.76l1.78.9a2 2 0 0 1 1.11 1.79V17H5v-1.55a2 2 0 0 1 1.11-1.79L8 12.76V3a3 3 0 0 1 6 0z" />
      <rect x="5" y="17" width="14" height="2" rx="0.5" />
      <rect x="11" y="19" width="2" height="3" rx="0.5" />
    </svg>
  );
}

function IconCopy() {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconDownload() {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default function AgentCard({
  agent,
  index,
  pinned = false,
  onOpen,
  onTogglePin,
}: AgentCardProps) {
  const [copied, setCopied] = useState(false);
  const fileName = agent.localFilePath?.split('/').pop() ?? `${agent.id}.md`;
  const downloadName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(agent.content);
      setCopied(true);
      toast.success('Prompt copiado');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o prompt');
    }
  };

  const handleDownload = (event: React.MouseEvent) => {
    event.stopPropagation();
    const blob = new Blob([agent.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Prompt baixado');
  };

  return (
    <article
      className="agent-card group relative anim-fade-up flex flex-col border border-[var(--color-divider)] transition-colors hover:border-[var(--color-accent)]"
      style={{ animationDelay: `${0.08 + index * 0.06}s` }}
    >
      <div
        className={`absolute right-3 top-3 z-10 flex items-center gap-1.5 transition-opacity duration-150 ${
          pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          type="button"
          className={actionBtnClass}
          style={actionBtnMutedStyle}
          aria-label={copied ? 'Prompt copiado' : 'Copiar prompt'}
          title={copied ? 'Copiado' : 'Copiar prompt'}
          onClick={(event) => void handleCopy(event)}
        >
          {copied ? <IconCheck /> : <IconCopy />}
        </button>
        <button
          type="button"
          className={actionBtnClass}
          style={actionBtnMutedStyle}
          aria-label="Baixar prompt"
          title="Baixar prompt"
          onClick={handleDownload}
        >
          <IconDownload />
        </button>
        <button
          type="button"
          className={`${actionBtnClass} ${
            pinned
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : ''
          }`}
          style={pinned ? undefined : actionBtnMutedStyle}
          aria-label={pinned ? 'Desafixar prompt' : 'Fixar prompt'}
          aria-pressed={pinned}
          title={pinned ? 'Desafixar prompt' : 'Fixar prompt'}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePin(agent.id);
          }}
        >
          {pinned ? <IconPinSolid /> : <IconPinOutline />}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onOpen(agent)}
        className="flex h-full w-full cursor-pointer flex-col gap-[18px] border-0 bg-transparent px-[22px] py-6 text-left"
      >
        <header className="border-b border-[var(--color-divider)] pb-4 text-center">
          <h3
            className="font-[family-name:var(--font-heading)] text-[27px] font-semibold leading-[1.1] tracking-[0.01em]"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
          >
            {agent.name}
          </h3>
          <p
            className="mt-[3px] text-[13px] italic"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 52%, transparent)',
            }}
          >
            {fileName}
          </p>
        </header>

        <p
          className="min-h-0 flex-1 overflow-hidden text-[14px] italic leading-relaxed line-clamp-4"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 72%, transparent)',
          }}
        >
          {agent.excerpt}
        </p>

        <div className="flex items-center justify-end border-t border-[var(--color-divider)] pt-3 text-[12px]">
          <span
            className="num"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
            }}
          >
            {formatUpdatedAt(agent.updatedAt)}
          </span>
        </div>
      </button>
    </article>
  );
}
