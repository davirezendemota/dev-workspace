'use client';

import type { Agent } from './data';

type AgentCardProps = {
  agent: Agent;
  index: number;
  onOpen: (agent: Agent) => void;
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

export default function AgentCard({ agent, index, onOpen }: AgentCardProps) {
  const fileName = agent.localFilePath?.split('/').pop() ?? `${agent.id}.md`;

  return (
    <button
      type="button"
      onClick={() => onOpen(agent)}
      className="agent-card anim-fade-up flex cursor-pointer flex-col gap-[18px] border border-[var(--color-divider)] px-[22px] py-6 text-left transition-colors hover:border-[var(--color-accent)]"
      style={{ animationDelay: `${0.08 + index * 0.06}s` }}
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
  );
}
