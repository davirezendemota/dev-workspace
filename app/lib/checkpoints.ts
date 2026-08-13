export type CheckpointAta = {
  title: string;
  content: string;
};

export type Checkpoint = {
  /** Canonical format: DD/MM/YYYY HH:mm */
  date: string;
  title: string;
  summary: string;
  description: string;
  atas: CheckpointAta[];
  summaryUpdatedAt: string | null;
};

const DATE_ONLY = /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const CANONICAL_DATETIME =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;
const SLASH_WITH_TIME =
  /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/;

type DateParts = { day: number; month: number; year: number };
type DateTimeParts = DateParts & { hour: number; minute: number };

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

function formatTimeParts({ hour, minute }: Pick<DateTimeParts, 'hour' | 'minute'>): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatCanonicalDateTime(parts: DateTimeParts): string {
  return `${formatDateParts(parts)} ${formatTimeParts(parts)}`;
}

function parseTimeToken(value: string): Pick<DateTimeParts, 'hour' | 'minute'> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function parseCheckpointDateTimeParts(date: string, time = ''): DateTimeParts | null {
  const dateTrim = date.trim();
  const timeTrim = time.trim();
  if (!dateTrim && !timeTrim) return null;

  const canonical = dateTrim.match(CANONICAL_DATETIME);
  if (canonical) {
    return {
      day: Number(canonical[1]),
      month: Number(canonical[2]),
      year: Number(canonical[3]),
      hour: Number(canonical[4]),
      minute: Number(canonical[5]),
    };
  }

  const slashWithTime = dateTrim.match(SLASH_WITH_TIME);
  if (slashWithTime) {
    const dateParts = parseCheckpointDateParts(slashWithTime[1]);
    const timeParts = parseTimeToken(slashWithTime[2]);
    if (dateParts && timeParts) {
      return { ...dateParts, ...timeParts };
    }
  }

  const dateParts = parseCheckpointDateParts(dateTrim.split(/\s+/)[0] ?? dateTrim);
  if (!dateParts) {
    const parsed = Date.parse(dateTrim);
    if (!Number.isNaN(parsed) && /[T\s]\d/.test(dateTrim)) {
      const d = new Date(parsed);
      return {
        day: d.getDate(),
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        hour: d.getHours(),
        minute: d.getMinutes(),
      };
    }
    return null;
  }

  const embeddedTime = parseTimeToken(dateTrim.split(/\s+/).slice(1).join(' '));
  const explicitTime = parseTimeToken(timeTrim);
  const timeParts = explicitTime ?? embeddedTime ?? { hour: 0, minute: 0 };

  return { ...dateParts, ...timeParts };
}

/** Normalizes any legacy checkpoint date/time to DD/MM/YYYY HH:mm. */
export function normalizeCheckpointDateString(date: string, time = ''): string {
  const parts = parseCheckpointDateTimeParts(date, time);
  if (!parts) return date.trim();
  return formatCanonicalDateTime(parts);
}

function normalizeAtas(raw: unknown): CheckpointAta[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (typeof entry === 'string') {
        const content = entry.trim();
        if (!content) return null;
        return { title: '', content };
      }

      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const title = typeof obj.title === 'string' ? obj.title.trim() : '';
        const content =
          typeof obj.content === 'string'
            ? obj.content.trim()
            : typeof obj.body === 'string'
              ? obj.body.trim()
              : typeof obj.text === 'string'
                ? obj.text.trim()
                : '';

        if (!title && !content) return null;
        return { title, content };
      }

      return null;
    })
    .filter((item): item is CheckpointAta => item !== null);
}

export function isCheckpointDateString(value: string): boolean {
  const trimmed = value.trim();
  return DATE_ONLY.test(trimmed) || CANONICAL_DATETIME.test(trimmed) || SLASH_WITH_TIME.test(trimmed);
}

function normalizeCheckpointRecord(
  partial: Partial<Checkpoint> & { time?: string },
): Checkpoint {
  const legacyTime = typeof partial.time === 'string' ? partial.time : '';
  const date = partial.date
    ? normalizeCheckpointDateString(partial.date, legacyTime)
    : '';

  return {
    date,
    title: partial.title ?? '',
    summary: partial.summary ?? '',
    description: partial.description ?? '',
    atas: partial.atas ?? [],
    summaryUpdatedAt: partial.summaryUpdatedAt ?? null,
  };
}

/** Normalizes legacy checkpoints into canonical `{ date, title, summary, ... }` objects. */
export function normalizeCheckpoints(raw: unknown, topDate?: string): Checkpoint[] {
  if (!Array.isArray(raw)) return [];

  const items = raw
    .map((entry) => {
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        if (isCheckpointDateString(text)) {
          return normalizeCheckpointRecord({ date: text });
        }
        return normalizeCheckpointRecord({ title: text });
      }

      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const date = String(obj.date ?? '').trim();
        const legacyTime = typeof obj.time === 'string' ? obj.time.trim() : '';
        const title = String(obj.title ?? '').trim();
        const summary = String(obj.summary ?? '').trim();
        const description = String(obj.description ?? '').trim();
        const atas = normalizeAtas(obj.atas);
        const summaryUpdatedAt =
          typeof obj.summaryUpdatedAt === 'string' && obj.summaryUpdatedAt.trim()
            ? obj.summaryUpdatedAt.trim()
            : null;

        if (!date && !title && !summary && !description && atas.length === 0) return null;

        return normalizeCheckpointRecord({
          date,
          time: legacyTime,
          title,
          summary,
          description,
          atas,
          summaryUpdatedAt,
        });
      }

      return null;
    })
    .filter((item): item is Checkpoint => item !== null);

  const latestDate = String(topDate ?? '').trim();
  if (latestDate && latestDate !== '—' && items[0] && !items[0].date) {
    items[0] = normalizeCheckpointRecord({
      ...items[0],
      date: latestDate,
    });
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

/** Full markdown body for expanded view; falls back to AI summary for legacy data. */
export function checkpointExpandedDescription(checkpoint: Checkpoint): string {
  const description = checkpoint.description.trim();
  if (description) return description;
  return checkpoint.summary.trim();
}

export function serializeCheckpoint(checkpoint: Checkpoint): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const date = normalizeCheckpointDateString(checkpoint.date);

  if (date) payload.date = date;
  if (checkpoint.title.trim()) payload.title = checkpoint.title.trim();
  if (checkpoint.summary.trim()) payload.summary = checkpoint.summary.trim();
  if (checkpoint.description.trim()) payload.description = checkpoint.description.trim();
  if (checkpoint.atas.length > 0) {
    payload.atas = checkpoint.atas
      .map((ata) => {
        const item: Record<string, string> = {};
        if (ata.title.trim()) item.title = ata.title.trim();
        if (ata.content.trim()) item.content = ata.content.trim();
        return item;
      })
      .filter((item) => Object.keys(item).length > 0);
  }
  if (checkpoint.summaryUpdatedAt) payload.summaryUpdatedAt = checkpoint.summaryUpdatedAt;

  return payload;
}

export function serializeCheckpoints(checkpoints: Checkpoint[]): Record<string, unknown>[] {
  return checkpoints.map(serializeCheckpoint).filter((item) => Object.keys(item).length > 0);
}

/** Splits a canonical or legacy checkpoint datetime into display parts (pt-BR). */
export function formatCheckpointDateTime(value: string): { date: string; time: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { date: '', time: null };

  const parts = parseCheckpointDateTimeParts(trimmed);
  if (!parts) return { date: trimmed, time: null };

  const time = formatTimeParts(parts);
  return {
    date: formatDateParts(parts),
    time: time === '00:00' ? null : time,
  };
}

export function getCheckpointDisplayDateTime(
  checkpoint: Pick<Checkpoint, 'date'>,
  fallbackDate = '',
): { date: string; time: string | null } {
  const sourceDate = checkpoint.date.trim() || fallbackDate.trim();
  return formatCheckpointDateTime(normalizeCheckpointDateString(sourceDate));
}

export function formatCheckpointDate(value: string): string {
  return formatCheckpointDateTime(value).date;
}

export function formatCheckpointTime(value: string): string {
  const parts = parseCheckpointDateTimeParts(value);
  if (!parts) return '';
  return formatTimeParts(parts);
}

/** Parses a checkpoint datetime for sorting (later = larger). Invalid/empty → -Infinity. */
export function checkpointSortKey(date: string): number {
  const trimmed = date.trim();
  if (!trimmed || trimmed === '—') return Number.NEGATIVE_INFINITY;

  const parts = parseCheckpointDateTimeParts(trimmed);
  if (parts) {
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    ).getTime();
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

  const parts = parseCheckpointDateTimeParts(trimmed);
  if (parts) {
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  return trimmed;
}
