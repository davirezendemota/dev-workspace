'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { cn } from '@/app/lib/utils';
import type { Project } from './data';
import type {
  ProjectSpecChecklistData,
  SpecChecklistAc,
  SpecChecklistSpec,
} from './spec-checklist-types';
import {
  CompletionCell,
  STATUS_LABELS,
  STATUS_ROW_CLASS,
  StatusBadge,
  formatDateTime,
} from './spec-checklist-ui';

type ProjectSpecChecklistProps = {
  project: Project;
};

function acMatchesSearch(item: SpecChecklistAc, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const statusLabel = STATUS_LABELS[item.status].toLowerCase();
  const formattedDate = item.completedAt ? formatDateTime(item.completedAt).toLowerCase() : '';
  const commit = (item.completedCommit ?? '').toLowerCase();
  const shortCommit = commit ? commit.slice(0, 7) : '';

  const parts = [
    item.ac,
    item.description,
    item.status,
    statusLabel,
    item.completedAt ?? '',
    formattedDate,
    commit,
    shortCommit,
    ...item.issues.map(String),
    ...item.prs.map(String),
  ];

  return parts.some((part) => part.toLowerCase().includes(q));
}

function specMatchesSearch(spec: SpecChecklistSpec, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return [spec.specId, spec.title, spec.specFile].some((part) =>
    part.toLowerCase().includes(q),
  );
}

function filterSpecs(specs: SpecChecklistSpec[], query: string): SpecChecklistSpec[] {
  const q = query.trim();
  if (!q) return specs;

  return specs
    .map((spec) => {
      if (specMatchesSearch(spec, q)) return spec;
      const filteredChecklist = spec.checklist.filter((item) => acMatchesSearch(item, q));
      if (filteredChecklist.length === 0) return null;
      return { ...spec, checklist: filteredChecklist };
    })
    .filter((spec): spec is SpecChecklistSpec => spec !== null);
}

function SpecChecklistTable({ specs }: { specs: SpecChecklistSpec[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] table-fixed border-collapse text-[13px]">
        <colgroup>
          <col className="w-[72px]" />
          <col />
          <col className="w-[148px]" />
          <col className="w-[220px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--color-divider)] bg-[var(--color-neutral-100)]">
            <th
              className="px-4 py-2 text-left text-[11px] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              AC
            </th>
            <th
              className="px-4 py-2 text-left text-[11px] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Descrição
            </th>
            <th
              className="px-4 py-2 text-left text-[11px] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Status
            </th>
            <th
              className="whitespace-nowrap px-4 py-2 text-left text-[11px] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Conclusão
            </th>
          </tr>
        </thead>
        <tbody>
          {specs.map((spec) => (
            <Fragment key={spec.specId}>
              <tr className="border-b border-[var(--color-divider)] bg-[var(--color-surface)]">
                <td colSpan={4} className="px-4 py-3">
                  <div
                    className="text-[15px] font-semibold"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {spec.specId} — {spec.title}
                  </div>
                  <div
                    className="mt-0.5 font-mono text-[11px]"
                    style={{
                      color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                    }}
                  >
                    {spec.specFile}
                  </div>
                </td>
              </tr>
              {spec.checklist.map((item) => (
                <tr
                  key={`${spec.specId}-${item.ac}`}
                  className={cn(
                    'border-b border-[var(--color-divider)] last:border-b-0',
                    STATUS_ROW_CLASS[item.status],
                  )}
                >
                  <td
                    className="px-4 py-2.5 font-mono text-[12px] align-top"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {item.ac}
                  </td>
                  <td
                    className="px-4 py-2.5 align-top"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {item.description}
                    {item.issues.length > 0 || item.prs.length > 0 ? (
                      <div
                        className="mt-1 flex flex-wrap gap-2 text-[11px]"
                        style={{
                          color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                        }}
                      >
                        {item.issues.length > 0 ? (
                          <span>issues: {item.issues.join(', ')}</span>
                        ) : null}
                        {item.prs.length > 0 ? (
                          <span>PRs: {item.prs.join(', ')}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 align-top">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-2.5 align-top text-[12px]">
                    <CompletionCell
                      completedAt={item.completedAt}
                      completedCommit={item.completedCommit}
                    />
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function ProjectSpecChecklist({ project }: ProjectSpecChecklistProps) {
  const [checklist, setChecklist] = useState<ProjectSpecChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${project.id}/spec-checklist`);
        if (!response.ok) {
          let detail = `Erro ${response.status}`;
          try {
            const body = await response.json();
            if (typeof body?.detail === 'string') detail = body.detail;
          } catch {
            /* ignore */
          }
          throw new Error(detail);
        }
        const data: ProjectSpecChecklistData = await response.json();
        if (!cancelled) setChecklist(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Não foi possível carregar o spec-checklist.',
          );
          setChecklist(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const filteredSpecs = useMemo(
    () => filterSpecs(checklist?.specs ?? [], searchQuery),
    [checklist?.specs, searchQuery],
  );

  const hasSpecs = (checklist?.specs.length ?? 0) > 0;
  const hasFilteredResults = filteredSpecs.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p
          className="text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Carregando spec-checklist…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="border border-[var(--color-accent)] px-4 py-3 text-[13px]"
        style={{
          background: 'var(--color-accent-100)',
          color: 'var(--color-accent-800)',
          fontFamily: 'var(--font-body)',
        }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div
          className="font-mono text-xs"
          style={{
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          {checklist?.checklist_path ?? '.specs/spec-checklist.json'}
        </div>
        {checklist?.updated_at || checklist?.global_updated_at ? (
          <div
            className="text-[11px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            {formatDateTime(checklist.global_updated_at ?? checklist.updated_at)}
          </div>
        ) : null}
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => e.preventDefault()}
        role="search"
      >
        <div className="relative flex min-w-0 items-center">
          <span
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            style={{
              color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
            }}
          >
            <IconSearch />
          </span>
          <input
            type="text"
            className="input w-full !pl-10"
            style={{ paddingRight: searchQuery ? '2.25rem' : undefined }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por AC, descrição, data, hash ou status…"
            aria-label="Pesquisar critérios de aceite"
            autoComplete="off"
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-sm transition-colors hover:bg-[var(--color-neutral-100)]"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar pesquisa"
              style={{
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              <IconClear />
            </button>
          ) : null}
        </div>
        {isSearching ? (
          <p
            className="text-[12px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            {hasFilteredResults
              ? `${filteredSpecs.reduce((n, spec) => n + spec.checklist.length, 0)} resultado(s)`
              : 'Nenhum resultado para esta busca'}
          </p>
        ) : null}
      </form>

      {hasSpecs ? (
        hasFilteredResults ? (
          <div className="border border-[var(--color-divider)]">
            <SpecChecklistTable specs={filteredSpecs} />
          </div>
        ) : (
          <div
            className="py-16 text-center text-sm"
            style={{
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <p>Nenhum critério corresponde a &ldquo;{searchQuery.trim()}&rdquo;.</p>
            <button
              type="button"
              className="btn mt-4"
              onClick={() => setSearchQuery('')}
            >
              Limpar pesquisa
            </button>
          </div>
        )
      ) : (
        <div
          className="py-16 text-center text-sm"
          style={{
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <div
            className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-dashed"
            style={{ borderColor: 'var(--color-divider)' }}
          >
            ?
          </div>
          <p className="mt-3">Nenhum critério de aceite encontrado para este projeto.</p>
          <p className="mt-1 text-xs">
            Adicione <span className="text-[var(--color-text)]">.specs/spec-checklist.json</span>{' '}
            no repositório e configure{' '}
            <span className="text-[var(--color-text)]">local_path</span> ou{' '}
            <span className="text-[var(--color-text)]">spec_project_id</span> no projeto.
          </p>
        </div>
      )}
    </div>
  );
}
