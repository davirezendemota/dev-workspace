'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkpointDayKey,
  formatCheckpointDate,
  getCheckpointDisplayDateTime,
  resolveCheckpointDatesForTimeline,
  type Checkpoint,
} from '@/app/lib/checkpoints';
import { cn } from '@/app/lib/utils';
import CheckpointDetailSidebar from './CheckpointDetailSidebar';
import type { ProjectApiResponse } from './AddProjectModal';
import type { Project } from './data';

type ProjectCheckpointsProps = {
  project: Project;
  onUpdated?: (project: ProjectApiResponse) => void;
  initialExpandedIndex?: number | null;
};

type DayGroup = {
  dayKey: string;
  date: string;
  items: { checkpoint: Checkpoint; index: number }[];
};

type TimelineEntry = {
  checkpoint: Checkpoint;
  index: number;
  isDayAnchor: boolean;
  date: string;
  isLatestDayAnchor: boolean;
};

const TIMELINE_DOT_SIZE = 15;
const TIMELINE_LINE_LEFT = 7;

function groupCheckpointsByDay(
  checkpoints: Checkpoint[],
  resolvedDates: string[],
): DayGroup[] {
  const groups: DayGroup[] = [];

  for (let i = 0; i < checkpoints.length; i++) {
    const checkpoint = checkpoints[i];
    const date = resolvedDates[i] ?? '';
    const dayKey = checkpointDayKey(date);
    const last = groups[groups.length - 1];

    if (last && last.dayKey === dayKey) {
      last.items.push({ checkpoint, index: i });
      continue;
    }

    groups.push({
      dayKey,
      date,
      items: [{ checkpoint, index: i }],
    });
  }

  return groups;
}

function buildTimelineEntries(checkpoints: Checkpoint[]): TimelineEntry[] {
  const resolvedDates = resolveCheckpointDatesForTimeline(checkpoints);
  const groups = groupCheckpointsByDay(checkpoints, resolvedDates);
  const entries: TimelineEntry[] = [];

  groups.forEach((group, groupIndex) => {
    const hasDate = Boolean(group.date.trim());

    group.items.forEach((item, itemIndex) => {
      const isDayAnchor = hasDate && itemIndex === 0;
      entries.push({
        checkpoint: item.checkpoint,
        index: item.index,
        isDayAnchor,
        date: group.date,
        isLatestDayAnchor: groupIndex === 0 && isDayAnchor,
      });
    });
  });

  return entries;
}

function IconExpand() {
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
      className="shrink-0"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function CheckpointContent({
  checkpoint,
  index,
  onExpand,
}: {
  checkpoint: Checkpoint;
  index: number;
  onExpand: (index: number) => void;
}) {
  const label = checkpoint.title.trim() || 'Checkpoint sem título';

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3
          className="min-w-0 flex-1 text-[15px] font-medium leading-snug"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {label}
        </h3>

        <button
          type="button"
          className="flex h-6 w-6 flex-none items-center justify-center text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] transition-colors hover:text-[var(--color-accent)]"
          aria-label="Expandir checkpoint"
          title="Expandir checkpoint"
          onClick={() => onExpand(index)}
        >
          <IconExpand />
        </button>
      </div>

      <div className="mt-3">
        {checkpoint.summary ? (
          <p
            className="text-[14px] leading-relaxed"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 78%, transparent)',
            }}
          >
            {checkpoint.summary}
          </p>
        ) : (
          <p
            className="text-[13px] italic"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 42%, transparent)',
            }}
          >
            Sem resumo
          </p>
        )}

        {checkpoint.summaryUpdatedAt ? (
          <p
            className="mt-2 text-[11px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 42%, transparent)',
            }}
          >
            Resumo salvo em{' '}
            {new Date(checkpoint.summaryUpdatedAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        ) : null}

        {checkpoint.documents?.length ? (
          <p
            className="mt-2 text-[12px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
            }}
          >
            {checkpoint.documents.length} documento
            {checkpoint.documents.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>
    </>
  );
}

function TimelineEntryRow({
  entry,
  onExpand,
}: {
  entry: TimelineEntry;
  onExpand: (index: number) => void;
}) {
  const { date: displayDate, time: displayTime } = getCheckpointDisplayDateTime({
    date: entry.date,
  });
  const showDateWithAnchor = entry.isDayAnchor && Boolean(displayDate);

  return (
    <li className="grid grid-cols-[15px_1fr] gap-x-4 pb-8 last:pb-0">
      <div className="relative">
        {entry.isDayAnchor ? (
          <span
            className={cn(
              'absolute left-0 top-[3px] z-[1] rounded-full border-2',
              entry.isLatestDayAnchor
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                : 'border-[color-mix(in_srgb,white_55%,var(--color-text))] bg-white',
            )}
            style={{ width: TIMELINE_DOT_SIZE, height: TIMELINE_DOT_SIZE }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="min-w-0">
        {showDateWithAnchor ? (
          <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <time
              className="num text-[18px] font-semibold leading-none"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                color: entry.isLatestDayAnchor
                  ? 'var(--color-accent-700)'
                  : 'color-mix(in srgb, var(--color-text) 62%, transparent)',
              }}
              dateTime={entry.date || undefined}
            >
              {displayDate}
            </time>
            {displayTime ? (
              <span
                className="num text-[12px] leading-none"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
                }}
              >
                {displayTime}
              </span>
            ) : null}
            {entry.isLatestDayAnchor ? (
              <span
                className="text-[11px] uppercase tracking-wide"
                style={{
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--color-accent)',
                }}
              >
                Mais recente
              </span>
            ) : null}
          </div>
        ) : null}

        <CheckpointContent
          checkpoint={entry.checkpoint}
          index={entry.index}
          onExpand={onExpand}
        />
      </div>
    </li>
  );
}

export default function ProjectCheckpoints({
  project,
  onUpdated,
  initialExpandedIndex = null,
}: ProjectCheckpointsProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(project.checkpoints);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const appliedInitialKey = useRef<string | null>(null);

  const timelineEntries = useMemo(() => buildTimelineEntries(checkpoints), [checkpoints]);

  const expandedEntry = useMemo(() => {
    if (expandedIndex === null) return null;
    const checkpoint = checkpoints[expandedIndex];
    if (!checkpoint) return null;

    const resolvedDates = resolveCheckpointDatesForTimeline(checkpoints);
    return {
      checkpoint,
      index: expandedIndex,
      date: resolvedDates[expandedIndex] ?? checkpoint.date,
    };
  }, [checkpoints, expandedIndex]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/checkpoints`);
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
      const data = await response.json();
      setCheckpoints(Array.isArray(data.checkpoints) ? data.checkpoints : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar os checkpoints.',
      );
      setCheckpoints(project.checkpoints);
    } finally {
      setLoading(false);
    }
  }, [project.checkpoints, project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || typeof initialExpandedIndex !== 'number') return;
    const key = `${project.id}:${initialExpandedIndex}`;
    if (appliedInitialKey.current === key) return;
    if (!checkpoints[initialExpandedIndex]) return;
    setExpandedIndex(initialExpandedIndex);
    appliedInitialKey.current = key;
  }, [checkpoints, initialExpandedIndex, loading, project.id]);

  useEffect(() => {
    if (expandedIndex === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedIndex(null);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedIndex]);

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <p
          className="text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Carregando checkpoints…
        </p>
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-4 text-center">
        <p
          className="text-[15px] font-medium"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Nenhum checkpoint registrado
        </p>
        <p
          className="max-w-md text-[13px]"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Adicione marcos no JSON do projeto (`checkpoints`) com data, título, descrição e atas.
        </p>
      </div>
    );
  }

  const latestDate =
    project.topDate !== '—'
      ? project.topDate
      : checkpoints.find((item) => item.date.trim())?.date;

  return (
    <>
      <div className="flex flex-col gap-6">
        {error ? (
          <div
            className="border border-[var(--color-accent)] px-4 py-3 text-[13px]"
            style={{
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              fontFamily: 'var(--font-body)',
            }}
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p
            className="text-[13px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            {checkpoints.length} checkpoint{checkpoints.length === 1 ? '' : 's'} no histórico
          </p>
          {latestDate ? (
            <p
              className="num text-[12px]"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
              }}
            >
              Último: {formatCheckpointDate(latestDate) || latestDate}
            </p>
          ) : null}
        </div>

        <div className="relative">
          <span
            className="absolute bottom-0 top-0 w-px"
            style={{
              left: TIMELINE_LINE_LEFT,
              background: 'color-mix(in srgb, var(--color-text) 18%, transparent)',
            }}
            aria-hidden
          />

          <ol className="relative m-0 list-none p-0" aria-label="Timeline de checkpoints">
            {timelineEntries.map((entry) => (
              <TimelineEntryRow
                key={`${entry.index}-${entry.checkpoint.title}`}
                entry={entry}
                onExpand={setExpandedIndex}
              />
            ))}
          </ol>
        </div>
      </div>

      {expandedEntry ? (
        <CheckpointDetailSidebar
          projectId={project.id}
          checkpointIndex={expandedEntry.index}
          checkpoint={expandedEntry.checkpoint}
          date={expandedEntry.date}
          onClose={() => setExpandedIndex(null)}
          onUpdated={(next, nextProject) => {
            setCheckpoints(next);
            if (nextProject) onUpdated?.(nextProject);
          }}
        />
      ) : null}
    </>
  );
}
