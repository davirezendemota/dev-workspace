export type Checkpoint = {
  date: string;
  title: string;
  summary: string;
  summaryUpdatedAt: string | null;
};

const DATE_LIKE = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;

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

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return trimmed;
}

/** Normalizes a checkpoint date to a day key for grouping timeline entries. */
export function checkpointDayKey(date: string): string {
  const trimmed = date.trim();
  if (!trimmed) return '__no_date__';

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (match) {
    const year = match[3]
      ? match[3].length === 2
        ? `20${match[3]}`
        : match[3]
      : 'unknown';
    return `${year}-${Number(match[2])}-${Number(match[1])}`;
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
