/** Canonical timezone for checkpoint dates and workspace-facing timestamps. */
export const WORKSPACE_TIMEZONE = 'America/Sao_Paulo';

export type WorkspaceDateTimeParts = {
  day: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
};

function readDateTimeParts(
  date: Date,
  timeZone: string,
): WorkspaceDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    day: read('day'),
    month: read('month'),
    year: read('year'),
    hour: read('hour') % 24,
    minute: read('minute'),
  };
}

export function getWorkspaceDateTimeParts(date = new Date()): WorkspaceDateTimeParts {
  return readDateTimeParts(date, WORKSPACE_TIMEZONE);
}

export function formatWorkspaceCheckpointDateTime(date = new Date()): string {
  const parts = getWorkspaceDateTimeParts(date);
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function parseInstantToWorkspaceDateTimeParts(
  value: string | number | Date,
): WorkspaceDateTimeParts {
  const date = value instanceof Date ? value : new Date(value);
  return readDateTimeParts(date, WORKSPACE_TIMEZONE);
}

/** Converts wall-clock parts in the workspace timezone to UTC milliseconds. */
export function workspaceDateTimePartsToUtcMs(parts: WorkspaceDateTimeParts): number {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), WORKSPACE_TIMEZONE);
  return utcGuess - offsetMs;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = readDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  return asUtc - date.getTime();
}

export function formatWorkspaceLocaleDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('pt-BR', {
    timeZone: WORKSPACE_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}
