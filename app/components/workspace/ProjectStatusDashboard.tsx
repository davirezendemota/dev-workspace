'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/app/lib/utils';
import type { Project } from './data';

export type AcStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

export type SpecChecklistAc = {
  ac: string;
  description: string;
  status: AcStatus;
  completedCommit: string | null;
  completedAt: string | null;
  issues: number[];
  prs: number[];
};

export type SpecChecklistSpec = {
  specId: string;
  specFile: string;
  title: string;
  checklist: SpecChecklistAc[];
};

export type ProjectSpecChecklistData = {
  checklist_path: string;
  updated_at: string | null;
  global_updated_at: string | null;
  project_id: string | null;
  project_name: string | null;
  specs: SpecChecklistSpec[];
  source: 'local' | 'github' | null;
  stats: {
    total: number;
    done: number;
    in_progress: number;
    blocked: number;
    todo: number;
  };
};

const STATUS_LABELS: Record<AcStatus, string> = {
  done: 'Concluído',
  'in-progress': 'Em progresso',
  blocked: 'Bloqueado',
  todo: 'Pendente',
};

const STATUS_ROW_CLASS: Record<AcStatus, string> = {
  done: 'status-row-green',
  'in-progress': 'status-row-amber',
  blocked: 'status-row-red',
  todo: 'status-row-neutral',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-[var(--color-divider)] bg-[var(--color-surface)] px-4 py-3">
      <div
        className="text-[11px] font-medium uppercase tracking-widest"
        style={{
          fontFamily: 'var(--font-heading)',
          color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
        }}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-semibold ${mono ? 'font-mono' : ''}`}
        style={{ fontFamily: mono ? 'var(--font-body)' : 'var(--font-heading)' }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AcStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
        status === 'done' && 'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]',
        status === 'in-progress' && 'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]',
        status === 'blocked' && 'bg-[color-mix(in_srgb,var(--color-destructive)_14%,transparent)] text-[var(--color-destructive)]',
        status === 'todo' && 'bg-[color-mix(in_srgb,var(--color-neutral-600)_12%,transparent)] text-[var(--color-neutral-700)]',
      )}
      style={{ fontFamily: 'var(--font-heading)' }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function ProjectStatusDashboard({ project }: { project: Project }) {
  const [checklist, setChecklist] = useState<ProjectSpecChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const stats = checklist?.stats ?? {
    total: 0,
    done: 0,
    in_progress: 0,
    blocked: 0,
    todo: 0,
  };

  const hasSpecs = (checklist?.specs.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total ACs" value={String(stats.total)} />
        <Stat label="Concluídos" value={String(stats.done)} />
        <Stat label="Em progresso" value={String(stats.in_progress)} />
        <Stat label="Bloqueados" value={String(stats.blocked)} />
        <Stat label="Pendentes" value={String(stats.todo)} />
      </div>

      <section className="border border-[var(--color-divider)] bg-[var(--color-bg)]">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-divider)] px-5 py-3">
          <div>
            <div className="chk">Spec checklist</div>
            <div
              className="mt-0.5 font-mono text-xs"
              style={{
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              {checklist?.checklist_path ?? '.specs/spec-checklist.json'}
            </div>
          </div>
          <div className="text-right">
            {checklist?.project_name ? (
              <div
                className="text-[13px] font-medium"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {checklist.project_name}
                {checklist.project_id ? (
                  <span
                    className="ml-2 font-mono text-[11px] font-normal"
                    style={{
                      color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                    }}
                  >
                    {checklist.project_id}
                  </span>
                ) : null}
              </div>
            ) : null}
            {checklist?.updated_at || checklist?.global_updated_at ? (
              <div
                className="mt-0.5 text-[11px]"
                style={{
                  color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                }}
              >
                {formatDateTime(checklist.global_updated_at ?? checklist.updated_at)}
              </div>
            ) : null}
          </div>
        </header>

        <div className="px-5 py-5 sm:px-6">
          {hasSpecs ? (
            <div className="flex flex-col gap-6">
              {checklist!.specs.map((spec) => (
                <div key={spec.specId} className="border border-[var(--color-divider)]">
                  <header className="border-b border-[var(--color-divider)] bg-[var(--color-surface)] px-4 py-3">
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
                  </header>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] border-collapse text-[13px]">
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
                            <td className="px-4 py-2.5 align-top">
                              <StatusBadge status={item.status} />
                            </td>
                            <td
                              className="whitespace-nowrap px-4 py-2.5 align-top text-[12px]"
                              style={{
                                fontFamily: 'var(--font-body)',
                                color: item.completedAt
                                  ? 'var(--color-text)'
                                  : 'color-mix(in srgb, var(--color-text) 45%, transparent)',
                              }}
                            >
                              {formatDateTime(item.completedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
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
      </section>
    </div>
  );
}
