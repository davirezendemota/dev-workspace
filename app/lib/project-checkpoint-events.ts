import {
  checkpointIsoDayKey,
  checkpointSortKey,
  resolveCheckpointDatesForTimeline,
  type Checkpoint,
} from '@/app/lib/checkpoints';
import type { Project } from '@/app/components/workspace/data';

export type ProjectCheckpointEvent = {
  id: string;
  project: Project;
  checkpoint: Checkpoint;
  index: number;
  resolvedDate: string;
  sortKey: number;
  isoDay: string | null;
};

export function collectProjectCheckpointEvents(
  projects: Project[],
): ProjectCheckpointEvent[] {
  const events: ProjectCheckpointEvent[] = [];

  for (const project of projects) {
    const resolvedDates = resolveCheckpointDatesForTimeline(project.checkpoints);

    project.checkpoints.forEach((checkpoint, index) => {
      const resolvedDate = resolvedDates[index] ?? checkpoint.date;
      events.push({
        id: `${project.id}:${index}`,
        project,
        checkpoint,
        index,
        resolvedDate,
        sortKey: checkpointSortKey(resolvedDate),
        isoDay: checkpointIsoDayKey(resolvedDate),
      });
    });
  }

  events.sort((a, b) => {
    if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey;
    const byProject = a.project.name.localeCompare(b.project.name, 'pt-BR');
    if (byProject !== 0) return byProject;
    return a.index - b.index;
  });

  return events;
}

export function groupCheckpointEventsByIsoDay(
  events: ProjectCheckpointEvent[],
): Map<string, ProjectCheckpointEvent[]> {
  const groups = new Map<string, ProjectCheckpointEvent[]>();

  for (const event of events) {
    if (!event.isoDay) continue;
    const list = groups.get(event.isoDay) ?? [];
    list.push(event);
    groups.set(event.isoDay, list);
  }

  return groups;
}
