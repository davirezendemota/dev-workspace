import { checkpointDayKey, formatCheckpointDate } from '@/app/lib/checkpoints';

export type Milestone = {
  id: string;
  title: string;
  targetDate: string;
  description: string;
  specIds: string[];
};

export function normalizeMilestones(raw: unknown): Milestone[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const items: Milestone[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;

    let id = typeof obj.id === 'string' ? obj.id.trim() : '';
    if (!id || seen.has(id)) continue;

    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!title) continue;

    seen.add(id);

    const targetDate = typeof obj.targetDate === 'string' ? obj.targetDate.trim() : '';
    const description = typeof obj.description === 'string' ? obj.description.trim() : '';

    const specIds: string[] = [];
    if (Array.isArray(obj.specIds)) {
      for (const specId of obj.specIds) {
        if (typeof specId === 'string' && specId.trim()) {
          const normalized = specId.trim();
          if (!specIds.includes(normalized)) specIds.push(normalized);
        }
      }
    }

    items.push({ id, title, targetDate, description, specIds });
  }

  return items;
}

export function serializeMilestone(milestone: Milestone): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: milestone.id,
    title: milestone.title,
  };

  if (milestone.targetDate.trim()) payload.targetDate = milestone.targetDate.trim();
  if (milestone.description.trim()) payload.description = milestone.description.trim();
  if (milestone.specIds.length > 0) payload.specIds = [...milestone.specIds];

  return payload;
}

export function serializeMilestones(milestones: Milestone[]): Record<string, unknown>[] {
  return milestones.map(serializeMilestone);
}

/** Parses a milestone target date for sorting (earlier = smaller). Undated → Infinity. */
export function milestoneSortKey(targetDate: string): number {
  const trimmed = targetDate.trim();
  if (!trimmed) return Number.POSITIVE_INFINITY;

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) return iso;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const yearRaw = match[3];
    const year = yearRaw
      ? yearRaw.length === 2
        ? 2000 + Number(yearRaw)
        : Number(yearRaw)
      : new Date().getFullYear();
    return new Date(year, month, day).getTime();
  }

  return Number.POSITIVE_INFINITY;
}

export function sortMilestonesForTimeline(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort(
    (a, b) => milestoneSortKey(a.targetDate) - milestoneSortKey(b.targetDate),
  );
}

export function formatMilestoneDate(value: string): string {
  return formatCheckpointDate(value);
}

export function milestoneDayKey(date: string): string {
  return checkpointDayKey(date);
}
