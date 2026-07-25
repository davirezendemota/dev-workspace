import { cn } from '@/app/lib/utils';
import type { AcStatus } from './spec-checklist-types';

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