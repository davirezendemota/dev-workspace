'use client';

import { getCheckpointDisplayDateTime } from '@/app/lib/checkpoints';
import type { ProjectCheckpointEvent } from '@/app/lib/project-checkpoint-events';
import { cn } from '@/app/lib/utils';
import RepoBadge, { useRepoBadgeStyle } from './RepoBadge';

type ProjectCheckpointEventItemProps = {
  event: ProjectCheckpointEvent;
  showDate?: boolean;
  compact?: boolean;
  onClick: () => void;
};

export default function ProjectCheckpointEventItem({
  event,
  showDate = false,
  compact = false,
  onClick,
}: ProjectCheckpointEventItemProps) {
  const hasRepo = event.project.repo !== '—';
  const repoBadgeStyle = useRepoBadgeStyle(event.project.repo);
  const { date, time } = getCheckpointDisplayDateTime({ date: event.resolvedDate });
  const title = event.checkpoint.title.trim() || 'Checkpoint sem título';
  const summary = event.checkpoint.summary.trim();

  return (
    <button
      type="button"
      data-project-anchor={event.project.id}
      className={cn(
        'projects-checkpoint-event w-full cursor-pointer border border-[var(--color-divider)] text-left transition-colors',
        compact ? 'px-2.5 py-2' : 'px-3.5 py-3',
        'hover:bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]',
      )}
      style={
        hasRepo
          ? {
              ...repoBadgeStyle,
              borderLeftWidth: 3,
              borderLeftColor: 'hsl(calc(var(--repo-badge-hue) * 1deg) 48% 48% / 0.72)',
            }
          : {
              borderLeftWidth: 3,
              borderLeftColor: 'var(--color-accent)',
            }
      }
      onClick={onClick}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {showDate && date ? (
          <span
            className="num text-[13px] font-semibold leading-none"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
          >
            {date}
          </span>
        ) : null}
        {time ? (
          <span
            className="num text-[11px] leading-none"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
            }}
          >
            {time}
          </span>
        ) : null}
        <span
          className="min-w-0 truncate text-[13px] font-medium leading-snug"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          {event.project.name}
        </span>
        {hasRepo ? <RepoBadge repo={event.project.repo} className="scale-90" /> : null}
      </div>

      <p
        className={cn(
          'mt-1.5 text-[13px] leading-snug',
          compact && 'line-clamp-1',
        )}
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {title}
      </p>

      {!compact && summary && summary !== title ? (
        <p
          className="mt-1 line-clamp-2 text-[12px] leading-snug"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          {summary}
        </p>
      ) : null}
    </button>
  );
}
