'use client';

import { useMemo, type CSSProperties } from 'react';
import RepoBadge, { useRepoBadgeStyle } from './RepoBadge';
import { resolveGithubHref, type Project } from './data';
import {
  getCheckpointDisplayDateTime,
  type Checkpoint,
} from '@/app/lib/checkpoints';
import { cn } from '@/app/lib/utils';

const checkpointTimeMutedStyle = {
  fontFamily: 'var(--font-body)',
  color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
} as const;

function CheckpointRow({
  checkpoint,
  fallbackDate,
  isFirst,
  onClick,
}: {
  checkpoint: Checkpoint;
  fallbackDate?: string;
  isFirst: boolean;
  onClick: () => void;
}) {
  const { date, time } = getCheckpointDisplayDateTime(checkpoint, fallbackDate);
  const summary = checkpoint.summary || checkpoint.title || 'checkpoint resume';

  return (
    <tr
      className="projects-table-row cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <td className="projects-table-cell projects-table-cell-date">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'num leading-none',
              isFirst ? 'text-[15px] text-[var(--color-accent-700)]' : 'text-[13px]',
            )}
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              color: isFirst
                ? undefined
                : 'color-mix(in srgb, var(--color-text) 62%, transparent)',
            }}
          >
            {date || '—'}
          </span>
          {time ? (
            <span className="num text-[11px] leading-none" style={checkpointTimeMutedStyle}>
              {time}
            </span>
          ) : null}
        </div>
      </td>
      <td className="projects-table-cell">
        <span
          className={cn(
            'line-clamp-2 text-[12px] leading-snug',
            isFirst && 'italic',
          )}
          style={{
            fontFamily: 'var(--font-body)',
            color: isFirst
              ? 'color-mix(in srgb, var(--color-text) 55%, transparent)'
              : 'color-mix(in srgb, var(--color-text) 45%, transparent)',
          }}
        >
          {summary}
        </span>
      </td>
    </tr>
  );
}

function ProjectGroup({
  project,
  index,
  onExpand,
}: {
  project: Project;
  index: number;
  onExpand: (project: Project) => void;
}) {
  const hasRepo = project.repo !== '—';
  const repoBadgeStyle = useRepoBadgeStyle(project.repo);
  const githubHref = resolveGithubHref(project);
  const repoBranch =
    project.sourceType === 'github' && githubHref
      ? project.githubBranch?.trim() || 'main'
      : project.sourceType === 'local_repo'
        ? project.localRepoBranch?.trim() || 'main'
        : null;
  const repoTitle =
    repoBranch && project.repo !== '—'
      ? `${project.repo}:${repoBranch}`
      : project.repo;

  const groupStyle: CSSProperties = hasRepo
    ? {
        ...repoBadgeStyle,
        borderLeftWidth: 3,
        borderLeftColor: 'hsl(calc(var(--repo-badge-hue) * 1deg) 48% 48% / 0.72)',
        background:
          'hsl(calc(var(--repo-badge-hue) * 1deg) 48% 48% / 0.06)',
      }
    : {};

  return (
    <section
      id={`project-table-group-${project.id}`}
      className="projects-table-group anim-fade-up overflow-hidden border border-[var(--color-divider)]"
      style={{ ...groupStyle, animationDelay: `${0.04 + index * 0.03}s` }}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--color-divider)] px-4 py-3">
        <button
          type="button"
          className="text-left font-[family-name:var(--font-heading)] text-[18px] font-semibold leading-tight tracking-[0.01em] transition-opacity hover:opacity-80"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
          onClick={() => onExpand(project)}
        >
          {project.name}
        </button>
        {hasRepo ? (
          githubHref ? (
            <a
              href={githubHref}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
              onClick={(event) => event.stopPropagation()}
            >
              <RepoBadge repo={project.repo} title={repoTitle} />
            </a>
          ) : (
            <RepoBadge repo={project.repo} title={repoTitle} />
          )
        ) : null}
      </header>

      {project.checkpoints.length > 0 ? (
        <table className="projects-table w-full">
          <tbody>
            {project.checkpoints.map((checkpoint, i) => (
              <CheckpointRow
                key={`${project.id}-cp-${i}-${checkpoint.date}-${checkpoint.title}`}
                checkpoint={checkpoint}
                fallbackDate={i === 0 ? project.topDate : undefined}
                isFirst={i === 0}
                onClick={() => onExpand(project)}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <p
          className="px-4 py-3 text-[12px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
          }}
        >
          Nenhum checkpoint registrado.
        </p>
      )}
    </section>
  );
}

function RepoSupergroup({
  repo,
  projects,
  startIndex,
  onExpand,
}: {
  repo: string;
  projects: Project[];
  startIndex: number;
  onExpand: (project: Project) => void;
}) {
  const repoBadgeStyle = useRepoBadgeStyle(repo);

  return (
    <div
      className="projects-repo-supergroup flex flex-col gap-3"
      style={repoBadgeStyle}
    >
      <div
        className="flex items-center gap-3 border-b px-1 pb-2"
        style={{
          borderBottomColor: 'hsl(calc(var(--repo-badge-hue) * 1deg) 48% 48% / 0.45)',
        }}
      >
        <RepoBadge repo={repo} />
        <span
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
          }}
        >
          {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'}
        </span>
      </div>
      <div className="flex flex-col gap-3 pl-2">
        {projects.map((project, i) => (
          <ProjectGroup
            key={project.id}
            project={project}
            index={startIndex + i}
            onExpand={onExpand}
          />
        ))}
      </div>
    </div>
  );
}

type ProjectsTableViewProps = {
  projects: Project[];
  groupByRepo: boolean;
  onExpand: (project: Project) => void;
};

export default function ProjectsTableView({
  projects,
  groupByRepo,
  onExpand,
}: ProjectsTableViewProps) {
  const repoGroups = useMemo(() => {
    if (!groupByRepo) return null;

    const map = new Map<string, Project[]>();
    for (const project of projects) {
      const repo =
        project.repo && project.repo !== '—' ? project.repo : '—';
      const list = map.get(repo) ?? [];
      list.push(project);
      map.set(repo, list);
    }

    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '—') return 1;
      if (b === '—') return -1;
      return a.localeCompare(b);
    });
  }, [projects, groupByRepo]);

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

  if (groupByRepo && repoGroups) {
    let index = 0;
    return (
      <div className="projects-table-view flex flex-col gap-6">
        {repoGroups.map(([repo, repoProjects]) => {
          const startIndex = index;
          index += repoProjects.length;
          return (
            <RepoSupergroup
              key={repo}
              repo={repo}
              projects={repoProjects}
              startIndex={startIndex}
              onExpand={onExpand}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="projects-table-view flex flex-col gap-3">
      {projects.map((project, index) => (
        <ProjectGroup
          key={project.id}
          project={project}
          index={index}
          onExpand={onExpand}
        />
      ))}
    </div>
  );
}
