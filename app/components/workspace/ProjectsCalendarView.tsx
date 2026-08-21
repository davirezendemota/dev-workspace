'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collectProjectCheckpointEvents,
  groupCheckpointEventsByIsoDay,
  type ProjectCheckpointEvent,
} from '@/app/lib/project-checkpoint-events';
import { cn } from '@/app/lib/utils';
import type { Project } from './data';
import ProjectCheckpointEventItem from './ProjectCheckpointEventItem';
import { useRepoBadgeStyle } from './RepoBadge';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
const MAX_CHIPS_PER_DAY = 3;

type ProjectsCalendarViewProps = {
  projects: Project[];
  onOpenCheckpoint: (project: Project, checkpointIndex: number) => void;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toIsoDay(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function todayIsoDay(): string {
  const now = new Date();
  return toIsoDay(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatMonthTitle(year: number, monthIndex: number): string {
  const raw = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthIndex, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatSelectedDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number);
  if (!year || !month || !day) return isoDay;
  const raw = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function buildMonthCells(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function initialCursor(events: ProjectCheckpointEvent[]): { year: number; month: number } {
  const latest = events.find((event) => event.isoDay);
  if (latest?.isoDay) {
    const [year, month] = latest.isoDay.split('-').map(Number);
    if (year && month) return { year, month: month - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function IconChevron({ direction }: { direction: 'prev' | 'next' }) {
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
      {direction === 'prev' ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

function CalendarChip({
  event,
  onClick,
}: {
  event: ProjectCheckpointEvent;
  onClick: () => void;
}) {
  const hasRepo = event.project.repo !== '—';
  const repoBadgeStyle = useRepoBadgeStyle(event.project.repo);
  const title = event.checkpoint.title.trim() || event.checkpoint.summary.trim() || 'Checkpoint';

  return (
    <div
      data-project-anchor={event.project.id}
      className="projects-calendar-chip w-full truncate px-1.5 py-0.5 text-left text-[11px] leading-tight"
      style={
        hasRepo
          ? {
              ...repoBadgeStyle,
              fontFamily: 'var(--font-body)',
              background: 'hsl(calc(var(--repo-badge-hue) * 1deg) 48% 48% / 0.16)',
              color: 'var(--color-text)',
              borderLeft: '2px solid hsl(calc(var(--repo-badge-hue) * 1deg) 48% 48% / 0.85)',
            }
          : {
              fontFamily: 'var(--font-body)',
              background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
              color: 'var(--color-text)',
              borderLeft: '2px solid var(--color-accent)',
            }
      }
      title={`${event.project.name} · ${title}`}
      onClick={onClick}
    >
      <span className="font-medium">{event.project.name}</span>
      <span
        style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
      >
        {' · '}
        {title}
      </span>
    </div>
  );
}

export default function ProjectsCalendarView({
  projects,
  onOpenCheckpoint,
}: ProjectsCalendarViewProps) {
  const events = useMemo(() => collectProjectCheckpointEvents(projects), [projects]);
  const datedEvents = useMemo(() => events.filter((event) => event.isoDay), [events]);
  const undatedCount = events.length - datedEvents.length;
  const byDay = useMemo(() => groupCheckpointEventsByIsoDay(datedEvents), [datedEvents]);

  const [{ year, month }, setCursor] = useState(() => initialCursor(datedEvents));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const monthPrefix = `${year}-${pad2(month + 1)}`;
  const today = todayIsoDay();

  const datedEventsRef = useRef(datedEvents);
  datedEventsRef.current = datedEvents;

  useEffect(() => {
    if (today.startsWith(monthPrefix)) {
      setSelectedDay(today);
      return;
    }
    const inMonth = datedEventsRef.current.find((event) => event.isoDay?.startsWith(monthPrefix));
    setSelectedDay(inMonth?.isoDay ?? null);
  }, [monthPrefix, today]);

  const selectedEvents = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const monthEventCount = datedEvents.filter((event) => event.isoDay?.startsWith(monthPrefix)).length;

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDay(todayIsoDay());
  };

  if (projects.length === 0) {
    return (
      <p
        className="py-8 text-center text-[14px] italic"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
        }}
      >
        Nenhum projeto encontrado.
      </p>
    );
  }

  return (
    <div className="projects-calendar-view flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch lg:gap-5">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <h2
            className="min-w-0 flex-1 text-[18px] font-semibold leading-tight"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
          >
            {formatMonthTitle(year, month)}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="fbtn"
              aria-label="Mês anterior"
              onClick={() => shiftMonth(-1)}
            >
              <IconChevron direction="prev" />
            </button>
            <button type="button" className="fbtn" onClick={goToday}>
              Hoje
            </button>
            <button
              type="button"
              className="fbtn"
              aria-label="Próximo mês"
              onClick={() => shiftMonth(1)}
            >
              <IconChevron direction="next" />
            </button>
          </div>
        </header>

        <div className="projects-calendar-grid min-h-0 flex-1 border-t border-l border-[var(--color-divider)]">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="border-b border-r border-[var(--color-divider)] px-2 py-1.5 text-center text-[11px] uppercase tracking-[0.12em]"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
              }}
            >
              {label}
            </div>
          ))}

          {cells.map((cell) => {
            const iso = toIsoDay(cell.getFullYear(), cell.getMonth(), cell.getDate());
            const inMonth = cell.getMonth() === month;
            const dayEvents = byDay.get(iso) ?? [];
            const visible = dayEvents.slice(0, MAX_CHIPS_PER_DAY);
            const extra = dayEvents.length - visible.length;
            const isToday = iso === today;
            const isSelected = iso === selectedDay;

            return (
              <div
                key={iso}
                role="button"
                tabIndex={0}
                className={cn(
                  'projects-calendar-cell flex h-full min-h-0 cursor-pointer flex-col gap-1 border-b border-r border-[var(--color-divider)] p-1.5 text-left',
                  !inMonth && 'opacity-40',
                  isSelected && 'bg-[var(--color-accent-100)]',
                  !isSelected && 'hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)]',
                )}
                onClick={() => setSelectedDay(iso)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedDay(iso);
                  }
                }}
                aria-pressed={isSelected}
                aria-label={`${cell.getDate()} de ${formatMonthTitle(cell.getFullYear(), cell.getMonth())}${
                  dayEvents.length > 0 ? `, ${dayEvents.length} checkpoint${dayEvents.length === 1 ? '' : 's'}` : ''
                }`}
              >
                <span
                  className={cn(
                    'num inline-flex h-6 w-6 items-center justify-center text-[12px]',
                    isToday && 'rounded-full bg-[var(--color-accent)] text-[var(--color-bg)]',
                  )}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 600,
                    color: isToday
                      ? undefined
                      : isSelected
                        ? 'var(--color-accent-700)'
                        : undefined,
                  }}
                >
                  {cell.getDate()}
                </span>
                {dayEvents.length > 0 ? (
                  <span
                    className="num px-1 text-[11px] sm:hidden"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                    }}
                  >
                    {dayEvents.length}
                  </span>
                ) : null}
                <div className="hidden min-h-0 flex-1 flex-col gap-0.5 sm:flex">
                  {visible.map((event) => (
                    <CalendarChip
                      key={event.id}
                      event={event}
                      onClick={() => onOpenCheckpoint(event.project, event.index)}
                    />
                  ))}
                  {extra > 0 ? (
                    <span
                      className="px-1 text-[10px]"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
                      }}
                    >
                      +{extra} mais
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p
          className="mt-2 shrink-0 text-[12px]"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
          }}
        >
          {monthEventCount === 0
            ? 'Nenhum checkpoint neste mês.'
            : `${monthEventCount} checkpoint${monthEventCount === 1 ? '' : 's'} neste mês.`}
          {undatedCount > 0
            ? ` ${undatedCount} sem data — visíveis na Timeline.`
            : null}
        </p>
      </section>

      <aside className="flex min-h-0 min-w-0 flex-col gap-2 lg:overflow-y-auto">
        <h3
          className="text-[13px] font-semibold"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          {selectedDay ? formatSelectedDay(selectedDay) : 'Selecione um dia'}
        </h3>
        {selectedDay && selectedEvents.length === 0 ? (
          <p
            className="text-[13px] italic"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
            }}
          >
            Nenhum checkpoint neste dia.
          </p>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {selectedEvents.map((event) => (
            <ProjectCheckpointEventItem
              key={event.id}
              event={event}
              compact
              onClick={() => onOpenCheckpoint(event.project, event.index)}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}
