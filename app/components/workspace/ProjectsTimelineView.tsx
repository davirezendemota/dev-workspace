'use client';

import { useMemo } from 'react';
import { formatCheckpointDate } from '@/app/lib/checkpoints';
import {
  collectProjectCheckpointEvents,
  type ProjectCheckpointEvent,
} from '@/app/lib/project-checkpoint-events';
import type { Project } from './data';
import ProjectCheckpointEventItem from './ProjectCheckpointEventItem';

const TIMELINE_DOT_SIZE = 13;
const TIMELINE_LINE_LEFT = 6;

type ProjectsTimelineViewProps = {
  projects: Project[];
  onOpenCheckpoint: (project: Project, checkpointIndex: number) => void;
};

type DayGroup = {
  key: string;
  label: string;
  events: ProjectCheckpointEvent[];
};

function groupEventsForTimeline(events: ProjectCheckpointEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];

  for (const event of events) {
    const key = event.isoDay ?? '__no_date__';
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
      continue;
    }

    groups.push({
      key,
      label: event.isoDay ? formatCheckpointDate(event.resolvedDate) : 'Sem data',
      events: [event],
    });
  }

  return groups;
}

export default function ProjectsTimelineView({
  projects,
  onOpenCheckpoint,
}: ProjectsTimelineViewProps) {
  const events = useMemo(() => collectProjectCheckpointEvents(projects), [projects]);
  const groups = useMemo(() => groupEventsForTimeline(events), [events]);

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

  if (events.length === 0) {
    return (
      <p
        className="py-8 text-center text-[14px] italic"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
        }}
      >
        Nenhum checkpoint registrado nos projetos visíveis.
      </p>
    );
  }

  return (
    <div className="projects-timeline-view mx-auto w-full max-w-[720px] px-1 py-2">
      <div className="relative">
        <span
          className="absolute bottom-2 top-2 w-px"
          style={{
            left: TIMELINE_LINE_LEFT,
            background: 'color-mix(in srgb, var(--color-text) 18%, transparent)',
          }}
          aria-hidden
        />

        <ol className="relative m-0 list-none p-0" aria-label="Timeline de checkpoints dos projetos">
          {groups.map((group, groupIndex) => (
            <li key={group.key} className="grid grid-cols-[13px_1fr] gap-x-4 pb-8 last:pb-2">
              <div className="relative">
                <span
                  className="absolute left-0 top-[4px] z-[1] rounded-full border-2"
                  style={{
                    width: TIMELINE_DOT_SIZE,
                    height: TIMELINE_DOT_SIZE,
                    borderColor:
                      groupIndex === 0 ? 'var(--color-accent)' : 'color-mix(in srgb, white 55%, var(--color-text))',
                    background:
                      groupIndex === 0 ? 'var(--color-accent)' : 'var(--color-bg)',
                  }}
                  aria-hidden
                />
              </div>

              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <time
                    className="num text-[18px] font-semibold leading-none"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 600,
                      color:
                        groupIndex === 0
                          ? 'var(--color-accent-700)'
                          : 'color-mix(in srgb, var(--color-text) 62%, transparent)',
                    }}
                    dateTime={group.key === '__no_date__' ? undefined : group.key}
                  >
                    {group.label}
                  </time>
                  {groupIndex === 0 && group.key !== '__no_date__' ? (
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
                  <span
                    className="text-[11px]"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
                    }}
                  >
                    {group.events.length} {group.events.length === 1 ? 'checkpoint' : 'checkpoints'}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {group.events.map((event) => (
                    <ProjectCheckpointEventItem
                      key={event.id}
                      event={event}
                      onClick={() => onOpenCheckpoint(event.project, event.index)}
                    />
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
