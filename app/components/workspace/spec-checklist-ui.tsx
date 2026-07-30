import { cn } from '@/app/lib/utils';
import type { AcStatus, SpecChecklistAc } from './spec-checklist-types';

export const STATUS_LABELS: Record<AcStatus, string> = {
  done: 'Concluído',
  'in-progress': 'Em progresso',
  blocked: 'Bloqueado',
  todo: 'Pendente',
};

export const STATUS_ROW_CLASS: Record<AcStatus, string> = {
  done: 'status-row-green',
  'in-progress': 'status-row-amber',
  blocked: 'status-row-red',
  todo: 'status-row-neutral',
};

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortCommit(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 7);
}

export function CompletionCell({
  completedAt,
  completedCommit,
}: {
  completedAt: string | null;
  completedCommit: string | null;
}) {
  const timestamp = completedAt ? formatDateTime(completedAt) : null;
  const shortHash = formatShortCommit(completedCommit);

  if (!timestamp && !shortHash) {
    return (
      <span
        style={{
          color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
        }}
      >
        —
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {timestamp ? <span>{timestamp}</span> : null}
      {timestamp && shortHash ? (
        <span
          aria-hidden
          style={{
            color: 'color-mix(in srgb, var(--color-text) 35%, transparent)',
          }}
        >
          ·
        </span>
      ) : null}
      {shortHash ? (
        <span
          className="font-mono text-[11px]"
          style={{
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
          title={completedCommit ?? undefined}
        >
          {shortHash}
        </span>
      ) : null}
    </span>
  );
}

export function StatusBadge({ status }: { status: AcStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        status === 'done' && 'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]',
        status === 'in-progress' && 'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]',
        status === 'blocked' && 'bg-[color-mix(in_srgb,var(--color-destructive)_14%,transparent)] text-[var(--color-destructive)]',
        status === 'todo' && 'bg-[color-mix(in_srgb,var(--color-neutral-600)_12%,transparent)] text-[var(--color-neutral-700)]',
      )}
      style={{ fontFamily: 'var(--font-heading)' }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AcListItem({
  item,
  variant = 'card',
}: {
  item: SpecChecklistAc;
  variant?: 'card' | 'inline';
}) {
  if (variant === 'inline') {
    const shortHash = formatShortCommit(item.completedCommit);

    return (
      <article
        className="rounded-md px-2 py-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[12px] font-semibold">{item.ac}</span>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span
              className="min-w-0 truncate text-[13px]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {item.description}
            </span>
            <span className="shrink-0">
              <StatusBadge status={item.status} />
            </span>
          </div>
          <span
            className="shrink-0 font-mono text-[11px]"
            style={{
              color: shortHash
                ? 'color-mix(in srgb, var(--color-text) 55%, transparent)'
                : 'color-mix(in srgb, var(--color-text) 45%, transparent)',
            }}
            title={item.completedCommit ?? undefined}
          >
            {shortHash ?? '—'}
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'border border-[var(--color-divider)] px-4 py-3',
        STATUS_ROW_CLASS[item.status],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] font-semibold">{item.ac}</span>
            <StatusBadge status={item.status} />
          </div>
          <p
            className="mt-2 text-[13px] leading-relaxed"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {item.description}
          </p>
          {item.issues.length > 0 || item.prs.length > 0 ? (
            <div
              className="mt-2 flex flex-wrap gap-2 text-[11px]"
              style={{
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              {item.issues.length > 0 ? <span>issues: {item.issues.join(', ')}</span> : null}
              {item.prs.length > 0 ? <span>PRs: {item.prs.join(', ')}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-[12px]">
          <CompletionCell
            completedAt={item.completedAt}
            completedCommit={item.completedCommit}
          />
        </div>
      </div>
    </article>
  );
}
