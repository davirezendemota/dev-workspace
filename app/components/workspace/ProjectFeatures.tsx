'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from './Markdown';
import type { Project } from './data';
import type { ProjectSpecChecklistData, SpecChecklistSpec } from './spec-checklist-types';
import { AcListItem, formatDateTime } from './spec-checklist-ui';
import {
  filterSpecs,
  SpecSearchField,
  SpecSidebarLayout,
  specProgress,
} from './spec-checklist-sidebar';

type ProjectFeaturesProps = {
  project: Project;
};

type FeatureContent = {
  specId: string;
  specFile: string;
  title: string;
  content: string;
  updated_at: string | null;
};

function getScrollProgress(el: HTMLElement): number {
  const maxScroll = el.scrollHeight - el.clientHeight;
  if (maxScroll <= 0) return 100;
  return Math.min(100, Math.round((el.scrollTop / maxScroll) * 100));
}

function FeatureContentPanel({
  spec,
  content,
  contentLoading,
  contentError,
}: {
  spec: SpecChecklistSpec;
  content: FeatureContent | null;
  contentLoading: boolean;
  contentError: string | null;
}) {
  const { done, total } = specProgress(spec);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const updateScrollProgress = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollProgress(getScrollProgress(el));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    updateScrollProgress();
  }, [spec.specId, content, contentLoading, contentError, updateScrollProgress]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => updateScrollProgress());
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollProgress]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex-none">
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3
              className="text-[17px] font-semibold"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {spec.specId} — {spec.title}
            </h3>
            <span
              className="text-[12px] tabular-nums"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              {done}/{total} ACs concluídos
            </span>
          </div>
          <p
            className="mt-1 font-mono text-[11px]"
            style={{
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            {spec.specFile}
          </p>
          {content?.updated_at ? (
            <p
              className="mt-1 text-[11px]"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              Atualizado: {formatDateTime(content.updated_at)}
            </p>
          ) : null}
        </div>
        <div
          className="h-[3px] w-full bg-[color-mix(in_srgb,var(--color-text)_10%,transparent)]"
          role="progressbar"
          aria-valuenow={scrollProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso de leitura"
        >
          <div
            className="h-full bg-[var(--color-accent)]"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-10"
        onScroll={updateScrollProgress}
      >
        {contentLoading ? (
          <p
            className="text-[14px] italic"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            Carregando feature…
          </p>
        ) : null}
        {contentError ? (
          <div
            className="border border-[var(--color-accent)] px-4 py-3 text-[13px]"
            style={{
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              fontFamily: 'var(--font-body)',
            }}
            role="alert"
          >
            {contentError}
          </div>
        ) : null}
        {!contentLoading && !contentError && content ? (
          <Markdown preview>{content.content}</Markdown>
        ) : null}

        {spec.checklist.length > 0 ? (
          <section className="mt-8 border-t border-[var(--color-divider)] pt-6">
            <h4
              className="text-[12px] font-semibold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Critérios de aceite
            </h4>
            <ul className="m-0 mt-3 list-disc space-y-1 pl-5 marker:text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]">
              {spec.checklist.map((item) => (
                <li key={item.ac}>
                  <AcListItem item={item} variant="inline" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function ProjectFeatures({ project }: ProjectFeaturesProps) {
  const [checklist, setChecklist] = useState<ProjectSpecChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [content, setContent] = useState<FeatureContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setSearchQuery('');
    setSelectedSpecId(null);
    setLoading(true);
    setError(null);

    async function load() {
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
            err instanceof Error ? err.message : 'Não foi possível carregar as features.',
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

  const selectedSpec = useMemo(
    () => filteredSpecs.find((spec) => spec.specId === selectedSpecId) ?? null,
    [filteredSpecs, selectedSpecId],
  );

  useEffect(() => {
    if (filteredSpecs.length === 0) {
      setSelectedSpecId(null);
      return;
    }
    const stillVisible = selectedSpecId && filteredSpecs.some((s) => s.specId === selectedSpecId);
    if (!stillVisible) {
      setSelectedSpecId(filteredSpecs[0].specId);
    }
  }, [filteredSpecs, selectedSpecId]);

  useEffect(() => {
    if (!selectedSpecId) {
      setContent(null);
      setContentError(null);
      setContentLoading(false);
      return;
    }

    let cancelled = false;
    setContentLoading(true);
    setContentError(null);

    async function loadContent() {
      try {
        const response = await fetch(
          `/api/projects/${project.id}/features/${encodeURIComponent(selectedSpecId)}`,
        );
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
        const data: FeatureContent = await response.json();
        if (!cancelled) setContent(data);
      } catch (err) {
        if (!cancelled) {
          setContent(null);
          setContentError(
            err instanceof Error ? err.message : 'Não foi possível carregar a feature.',
          );
        }
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    }

    void loadContent();
    return () => {
      cancelled = true;
    };
  }, [project.id, selectedSpecId]);

  const hasSpecs = (checklist?.specs.length ?? 0) > 0;
  const hasFilteredResults = filteredSpecs.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center">
        <p
          className="text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Carregando features…
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <SpecSearchField
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        placeholder="Buscar feature, spec, arquivo…"
      />

      {isSearching && !hasFilteredResults ? (
        <p
          className="text-[12px]"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Nenhum resultado para esta busca
        </p>
      ) : null}

      {hasSpecs ? (
        hasFilteredResults ? (
          <SpecSidebarLayout
            specs={filteredSpecs}
            selectedSpecId={selectedSpecId}
            onSelectSpec={setSelectedSpecId}
            sidebarLabel="Features"
            emptyMessage="Selecione uma feature na barra lateral."
          >
            {selectedSpec ? (
              <FeatureContentPanel
                spec={selectedSpec}
                content={content}
                contentLoading={contentLoading}
                contentError={contentError}
              />
            ) : null}
          </SpecSidebarLayout>
        ) : (
          <div
            className="py-16 text-center text-sm"
            style={{
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <p>Nenhuma feature corresponde a &ldquo;{searchQuery.trim()}&rdquo;.</p>
            <button type="button" className="btn mt-4" onClick={() => setSearchQuery('')}>
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
          <p className="mt-3">Nenhuma feature encontrada para este projeto.</p>
          <p className="mt-1 text-xs">
            Adicione specs em <span className="text-[var(--color-text)]">.specs/features/</span> e
            registre em <span className="text-[var(--color-text)]">spec-checklist.json</span>.
          </p>
        </div>
      )}
    </div>
  );
}
