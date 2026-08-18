import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';

const REPO_HUES = [210, 165, 280, 24, 340, 195, 48, 305, 130, 350, 75, 255];
const GOLDEN_ANGLE = 137.508;

export const RepoHueContext = createContext<Map<string, number> | null>(null);

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function shortRepoLabel(repo: string): string {
  const trimmed = repo.replace(/\/$/, '');
  const parts = trimmed.split('/');
  return parts[parts.length - 1] || repo;
}

/** Assigns a distinct hue per repo; same repo always maps to the same hue. */
export function buildRepoHueMap(repos: Iterable<string>): Map<string, number> {
  const sorted = [...new Set(
    Array.from(repos).filter((repo) => repo && repo !== '—'),
  )].sort((a, b) => a.localeCompare(b));

  const map = new Map<string, number>();
  const usedHues = new Set<number>();

  for (let index = 0; index < sorted.length; index++) {
    const repo = sorted[index]!;
    let hue: number;

    if (index < REPO_HUES.length) {
      hue = REPO_HUES[index]!;
    } else {
      hue = Math.round((index * GOLDEN_ANGLE) % 360);
      while (usedHues.has(hue)) {
        hue = (hue + 29) % 360;
      }
    }

    usedHues.add(hue);
    map.set(repo, hue);
  }

  return map;
}

function resolveRepoHue(repo: string, hueMap?: Map<string, number> | null): number {
  const mapped = hueMap?.get(repo);
  if (mapped !== undefined) return mapped;
  return REPO_HUES[hashString(repo) % REPO_HUES.length]!;
}

export function getRepoBadgeStyle(
  repo: string,
  hueMap?: Map<string, number> | null,
): CSSProperties {
  return {
    '--repo-badge-hue': String(resolveRepoHue(repo, hueMap)),
  } as CSSProperties;
}

export function useRepoBadgeStyle(repo: string): CSSProperties {
  const hueMap = useContext(RepoHueContext);
  return getRepoBadgeStyle(repo, hueMap);
}

type RepoBadgeProps = {
  repo: string;
  active?: boolean;
  title?: string;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
};

export default function RepoBadge({
  repo,
  active = false,
  title,
  onClick,
  className = '',
  children,
}: RepoBadgeProps) {
  const label = children ?? shortRepoLabel(repo);
  const badgeStyle = useRepoBadgeStyle(repo);

  const classes = [
    'repo-badge',
    'tag',
    active ? 'repo-badge-active' : '',
    onClick ? 'repo-badge-clickable' : 'repo-badge-static',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        style={badgeStyle}
        title={title ?? repo}
        onClick={onClick}
      >
        {label}
        {active ? ' ✓' : ''}
      </button>
    );
  }

  return (
    <span className={classes} style={badgeStyle} title={title ?? repo}>
      {label}
    </span>
  );
}
