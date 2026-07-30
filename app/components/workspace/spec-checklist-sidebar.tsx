'use client';

import type { ReactNode } from 'react';
import { cn } from '@/app/lib/utils';
import type { SpecChecklistAc, SpecChecklistSpec } from './spec-checklist-types';
import { STATUS_LABELS, formatDateTime } from './spec-checklist-ui';

export function specProgress(spec: SpecChecklistSpec): { done: number; total: number } {
  const done = spec.checklist.filter((item) => item.status === 'done').length;
  return { done, total: spec.checklist.length };
}

function SpecIdBadge({ id, active }: { id: string; active: boolean }) {
  return (
    <span
      className="shrink-0 font-mono text-[10px] font-medium tabular-nums leading-none"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        width: 28,
        height: 18,
        borderRadius: 4,
        border: active
          ? '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)'
          : '1px solid color-mix(in srgb, var(--color-text) 16%, transparent)',
        color: active ? 'var(--color-accent)' : 'var(--color-neutral-700)',
      }}
    >
      {id}
    </span>
  );
}

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

export function filterSpecs(specs: SpecChecklistSpec[], query: string): SpecChecklistSpec[] {
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

export function SpecSidebarItem({
  spec,
  active,
  onSelect,
}: {
  spec: SpecChecklistSpec;
  active: boolean;
  onSelect: () => void;
}) {
  const { done, total } = specProgress(spec);

  return (
    <button
      type="button"
      className={cn(
        'group relative flex w-full min-h-[28px] items-center gap-1.5 rounded-md py-1.5 pr-2 pl-2 text-left transition-colors',
        active
          ? 'bg-[color-mix(in_srgb,var(--color-text)_9%,transparent)]'
          : 'hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)]',
      )}
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
    >
      {active ? (
        <span
          className="absolute top-1 bottom-1 left-0 w-[2px] rounded-full bg-[var(--color-accent)]"
          aria-hidden
        />
      ) : null}
      <SpecIdBadge id={spec.specId} active={active} />
      <span
        className="min-w-0 flex-1 truncate text-[13px] leading-tight"
        style={{
          fontFamily: 'var(--font-body)',
          color: active
            ? 'var(--color-text)'
            : 'color-mix(in srgb, var(--color-text) 82%, transparent)',
        }}
      >
        {spec.title}
      </span>
      <span
        className="shrink-0 text-[11px] tabular-nums"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
        }}
      >
        {done}/{total}
      </span>
    </button>
  );
}

export function IconSearch() {
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

export function IconClear() {
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

export function SpecSearchField({
  searchQuery,
  onSearchQueryChange,
  placeholder = 'Buscar spec, AC, descrição, status…',
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <form className="flex flex-none flex-col gap-2" onSubmit={(e) => e.preventDefault()} role="search">
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
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
        />
        {searchQuery ? (
          <button
            type="button"
            className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-sm transition-colors hover:bg-[var(--color-neutral-100)]"
            onClick={() => onSearchQueryChange('')}
            aria-label="Limpar pesquisa"
            style={{
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            <IconClear />
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function SpecSidebarLayout({
  specs,
  selectedSpecId,
  onSelectSpec,
  emptyMessage,
  sidebarLabel = 'Especificações',
  children,
}: {
  specs: SpecChecklistSpec[];
  selectedSpecId: string | null;
  onSelectSpec: (specId: string) => void;
  emptyMessage?: string;
  sidebarLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden"
      role="region"
    >
      <nav
        className="flex w-[min(100%,240px)] shrink-0 flex-col gap-1.5 overflow-y-auto p-1 sm:w-[280px]"
        aria-label={sidebarLabel}
      >
        {specs.map((spec) => (
          <SpecSidebarItem
            key={spec.specId}
            spec={spec}
            active={spec.specId === selectedSpecId}
            onSelect={() => onSelectSpec(spec.specId)}
          />
        ))}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg)]">
        {children ?? (
          <div
            className="flex h-full min-h-[200px] items-center justify-center px-6 text-center text-sm"
            style={{
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {emptyMessage ?? 'Selecione uma feature na barra lateral.'}
          </div>
        )}
      </div>
    </div>
  );
}
