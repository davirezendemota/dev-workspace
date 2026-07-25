'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AiResponseSkeleton from '@/app/components/AiResponseSkeleton';
import { cn } from '@/app/lib/utils';

function IconSpark() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 3l1.9 5.6L19.5 10l-5.1 2 -1.4 5.4 -1.4-5.4L6.5 10l5.6-1.4z" />
    </svg>
  );
}

function IconChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('shrink-0 transition-transform duration-150', expanded && 'rotate-180')}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconRefresh({ spinning }: { spinning?: boolean }) {
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
      className={cn('shrink-0', spinning && 'animate-spin')}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

type ProjectAiSummaryProps = {
  projectId: string;
  summary: string;
  onUpdated?: (ai: string) => void;
};

export default function ProjectAiSummary({
  projectId,
  summary,
  onUpdated,
}: ProjectAiSummaryProps) {
  const [text, setText] = useState(summary);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setText(summary);
    setExpanded(false);
  }, [summary]);

  useEffect(() => {
    if (expanded || loading) {
      if (expanded) setOverflows(true);
      return;
    }

    const measure = () => {
      const el = textRef.current;
      if (!el) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, expanded, loading]);

  const refreshSummary = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (loading) return;

      setLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/ai-summary`, {
          method: 'POST',
        });
        if (!response.ok) {
          let detail = 'Não foi possível atualizar o resumo.';
          try {
            const body = await response.json();
            if (typeof body?.detail === 'string') detail = body.detail;
          } catch {
            /* ignore */
          }
          throw new Error(detail);
        }

        const data = await response.json();
        const next =
          typeof data?.json_data?.ai === 'string'
            ? data.json_data.ai.trim()
            : '';
        if (next) {
          setText(next);
          onUpdated?.(next);
        }
      } catch {
        /* keep current text */
      } finally {
        setLoading(false);
      }
    },
    [loading, onUpdated, projectId],
  );

  const toggleExpanded = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!overflows) return;
      setExpanded((current) => !current);
    },
    [overflows],
  );

  const showChevron = overflows && !loading;
  const showRefresh = hovered || loading;

  return (
    <div
      className="group/ai relative flex items-start gap-[11px] border border-[var(--color-divider)] px-[14px] py-3 text-[13px]"
      style={{ fontFamily: 'var(--font-body)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-busy={loading}
    >
      <IconSpark />

      <div className="min-w-0 flex-1">
        {loading ? (
          <AiResponseSkeleton />
        ) : (
          <p
            ref={textRef}
            className={cn(
              'italic leading-[1.45]',
              !expanded && 'line-clamp-2',
            )}
            style={{ color: 'color-mix(in srgb, var(--color-text) 72%, transparent)' }}
          >
            {text}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 self-start pt-0.5">
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 items-center justify-center transition-opacity duration-150',
            showRefresh ? 'opacity-100' : 'pointer-events-none opacity-0',
            loading
              ? 'text-[var(--color-accent)]'
              : 'text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] hover:text-[var(--color-accent)]',
          )}
          aria-label="Atualizar resumo"
          title="Atualizar resumo"
          onClick={refreshSummary}
          disabled={loading}
        >
          <IconRefresh spinning={loading} />
        </button>

        {showChevron ? (
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] transition-colors hover:text-[var(--color-accent)]"
            aria-label={expanded ? 'Recolher resumo' : 'Expandir resumo'}
            aria-expanded={expanded}
            onClick={toggleExpanded}
          >
            <IconChevron expanded={expanded} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
