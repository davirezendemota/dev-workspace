export type Checkpoint = {
  date: string;
  title: string;
  summary: string;
  summaryUpdatedAt: string | null;
};

const DATE_LIKE = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

type DateParts = { day: number; month: number; year: number };

/** Slash dates in checkpoints are always DD/MM[/YYYY] (pt-BR). */
function parseCheckpointDateParts(value: string): DateParts | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const yearRaw = slash[3];
    const year = yearRaw
      ? yearRaw.length === 2
        ? 2000 + Number(yearRaw)
        : Number(yearRaw)
      : new Date().getFullYear();
    return { day, month, year };
  }

  const iso = trimmed.match(ISO_DATE);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    };
  }

  return null;
}

function formatDateParts({ day, month, year }: DateParts): string {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function isCheckpointDateString(value: string): boolean {
  return DATE_LIKE.test(value.trim());
}

/** Normalizes legacy checkpoints into `{ date, title, summary }` objects. */
export function normalizeCheckpoints(raw: unknown, topDate?: string): Checkpoint[] {
  if (!Array.isArray(raw)) return [];

  const items = raw
    .map((entry) => {
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        if (isCheckpointDateString(text)) {
          return emptyCheckpoint({ date: text });
        }
        return emptyCheckpoint({ title: text });
      }

      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const date = String(obj.date ?? '').trim();
        const title = String(obj.title ?? '').trim();
        const summary = String(obj.summary ?? '').trim();
        const summaryUpdatedAt =
          typeof obj.summaryUpdatedAt === 'string' && obj.summaryUpdatedAt.trim()
            ? obj.summaryUpdatedAt.trim()
            : null;

        if (!date && !title && !summary) return null;

        return { date, title, summary, summaryUpdatedAt };
      }

      return null;
    })
    .filter((item): item is Checkpoint => item !== null);

  const latestDate = String(topDate ?? '').trim();
  if (latestDate && latestDate !== '—' && items[0] && !items[0].date) {
    items[0] = { ...items[0], date: latestDate };
  }

  return items;
}

/**
 * Checkpoints are listed newest-first. Undated entries inherit the date of the
 * nearest dated checkpoint above them so same-day groups stay together.
 */
export function resolveCheckpointDatesForTimeline(checkpoints: Checkpoint[]): string[] {
  let currentDate = '';

  return checkpoints.map((checkpoint) => {
    if (checkpoint.date.trim()) {
      currentDate = checkpoint.date.trim();
      return currentDate;
    }
    return currentDate;
  });
}

export function serializeCheckpoint(checkpoint: Checkpoint): Record<string, string> {
  const payload: Record<string, string> = {};

  if (checkpoint.date.trim()) payload.date = checkpoint.date.trim();
  if (checkpoint.title.trim()) payload.title = checkpoint.title.trim();
  if (checkpoint.summary.trim()) payload.summary = checkpoint.summary.trim();
  if (checkpoint.summaryUpdatedAt) payload.summaryUpdatedAt = checkpoint.summaryUpdatedAt;

  return payload;
}

export function serializeCheckpoints(checkpoints: Checkpoint[]): Record<string, string>[] {
  return checkpoints.map(serializeCheckpoint).filter((item) => Object.keys(item).length > 0);
}

export function formatCheckpointDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parts = parseCheckpointDateParts(trimmed);
  if (parts) return formatDateParts(parts);

  return trimmed;
}

/** Parses a checkpoint date for sorting (later = larger). Invalid/empty → -Infinity. */
export function checkpointSortKey(date: string): number {
  const trimmed = date.trim();
  if (!trimmed || trimmed === '—') return Number.NEGATIVE_INFINITY;

  const parts = parseCheckpointDateParts(trimmed);
  if (parts) {
    return new Date(parts.year, parts.month - 1, parts.day).getTime();
  }

  return Number.NEGATIVE_INFINITY;
}

/** Returns the sort key of the most recent checkpoint in a newest-first list. */
export function latestCheckpointSortKey(checkpoints: Checkpoint[]): number {
  if (checkpoints.length === 0) return Number.NEGATIVE_INFINITY;

  const resolvedDates = resolveCheckpointDatesForTimeline(checkpoints);
  return resolvedDates.reduce(
    (max, date) => Math.max(max, checkpointSortKey(date)),
    Number.NEGATIVE_INFINITY,
  );
}

/** Normalizes a checkpoint date to a day key for grouping timeline entries. */
export function checkpointDayKey(date: string): string {
  const trimmed = date.trim();
  if (!trimmed) return '__no_date__';

  const parts = parseCheckpointDateParts(trimmed);
  if (parts) {
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  return trimmed;
}

function emptyCheckpoint(partial: Partial<Checkpoint>): Checkpoint {
  return {
    date: partial.date ?? '',
    title: partial.title ?? '',
    summary: partial.summary ?? '',
    summaryUpdatedAt: partial.summaryUpdatedAt ?? null,
  };
}
