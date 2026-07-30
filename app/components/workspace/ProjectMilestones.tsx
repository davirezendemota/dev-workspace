'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  formatMilestoneDate,
  milestoneDayKey,
  sortMilestonesForTimeline,
  type Milestone,
} from '@/app/lib/milestones';
import { cn } from '@/app/lib/utils';
import type { Project } from './data';
import type { ProjectSpecChecklistData, SpecChecklistSpec } from './spec-checklist-types';

type MilestonesDocument = {
  version: 1;
  items: Milestone[];
  updated_at?: string | null;
};

export type MilestoneDraft = {
  title?: string;
  description?: string;
};

type ProjectMilestonesProps = {
  project: Project;
  draft?: MilestoneDraft | null;
  onDraftConsumed?: () => void;
};

function createMilestoneId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const TIMELINE_DOT_SIZE = 15;
const TIMELINE_LINE_LEFT = 7;

type TimelineEntry = {
  milestone: Milestone;
  isDayAnchor: boolean;
  date: string;
  isFirstDayAnchor: boolean;
};

function buildTimelineEntries(milestones: Milestone[]): TimelineEntry[] {
  const sorted = sortMilestonesForTimeline(milestones);
  const entries: TimelineEntry[] = [];
  let lastDayKey = '';

  sorted.forEach((milestone) => {
    const date = milestone.targetDate.trim();
    const dayKey = milestoneDayKey(date);
    const isDayAnchor = Boolean(date) && dayKey !== lastDayKey;
    if (isDayAnchor) lastDayKey = dayKey;

    entries.push({
      milestone,
      isDayAnchor,
      date,
      isFirstDayAnchor: isDayAnchor && entries.every((e) => !e.isFirstDayAnchor),
    });
  });

  if (entries.length > 0 && !entries.some((e) => e.isFirstDayAnchor)) {
    const firstWithDate = entries.find((e) => e.isDayAnchor);
    if (firstWithDate) firstWithDate.isFirstDayAnchor = true;
    else entries[0].isFirstDayAnchor = true;
  }

  return entries;
}

function SpecChips({
  specIds,
  specsById,
}: {
  specIds: string[];
  specsById: Map<string, SpecChecklistSpec>;
}) {
  if (specIds.length === 0) {
    return (
      <span
        className="text-[12px] italic"
        style={{ color: 'color-mix(in srgb, var(--color-text) 45%, transparent)' }}
      >
        Sem specs vinculadas
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {specIds.map((specId) => {
        const spec = specsById.get(specId);
        const label = spec ? `${specId} · ${spec.title || spec.specFile}` : specId;
        return (
          <span
            key={specId}
            className="rounded border border-[var(--color-divider)] px-2 py-0.5 text-[11px]"
            style={{
              fontFamily: 'var(--font-heading)',
              background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function MilestoneForm({
  title,
  targetDate,
  description,
  selectedSpecIds,
  availableSpecs,
  saving,
  submitLabel,
  onTitleChange,
  onTargetDateChange,
  onDescriptionChange,
  onToggleSpec,
  onSubmit,
  onCancel,
}: {
  title: string;
  targetDate: string;
  description: string;
  selectedSpecIds: string[];
  availableSpecs: SpecChecklistSpec[];
  saving: boolean;
  submitLabel: string;
  onTitleChange: (value: string) => void;
  onTargetDateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onToggleSpec: (specId: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded border border-[var(--color-divider)] bg-[var(--color-neutral-100)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
            Título
          </span>
          <input
            type="text"
            className="input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Ex.: Q4 — Auth refresh"
            maxLength={200}
            disabled={saving}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
            Data alvo (opcional)
          </span>
          <input
            type="text"
            className="input"
            value={targetDate}
            onChange={(e) => onTargetDateChange(e.target.value)}
            placeholder="15/10/2026"
            disabled={saving}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
          Planejamento / notas
        </span>
        <textarea
          className="input min-h-[72px] resize-y"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Contexto do milestone, dependências, alinhamento com stakeholders…"
          maxLength={2000}
          disabled={saving}
        />
      </label>
      {availableSpecs.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-heading)' }}>
            Specs planejadas
          </span>
          <div className="flex flex-wrap gap-2">
            {availableSpecs.map((spec) => {
              const active = selectedSpecIds.includes(spec.specId);
              return (
                <button
                  key={spec.specId}
                  type="button"
                  className={cn(
                    'rounded border px-2.5 py-1 text-[12px] transition-colors',
                    active
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                      : 'border-[var(--color-divider)]',
                  )}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    background: active
                      ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                      : 'transparent',
                  }}
                  onClick={() => onToggleSpec(spec.specId)}
                  disabled={saving}
                >
                  {spec.specId} · {spec.title || spec.specFile}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p
          className="text-[12px] italic"
          style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}
        >
          Spec-checklist indisponível — vincule specs depois que o checklist estiver configurado.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={saving}>
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function ProjectMilestones({
  project,
  draft,
  onDraftConsumed,
}: ProjectMilestonesProps) {
  const [items, setItems] = useState<Milestone[]>([]);
  const [availableSpecs, setAvailableSpecs] = useState<SpecChecklistSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSpecIds, setFormSpecIds] = useState<string[]>([]);

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const itemsRef = useRef<Milestone[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const specsById = useMemo(() => {
    const map = new Map<string, SpecChecklistSpec>();
    for (const spec of availableSpecs) map.set(spec.specId, spec);
    return map;
  }, [availableSpecs]);

  const timelineEntries = useMemo(() => buildTimelineEntries(items), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [milestonesRes, checklistRes] = await Promise.all([
        fetch(`/api/projects/${project.id}/milestones`, { cache: 'no-store' }),
        fetch(`/api/projects/${project.id}/spec-checklist`, { cache: 'no-store' }),
      ]);

      if (!milestonesRes.ok) {
        let detail = `Erro ${milestonesRes.status}`;
        try {
          const body = await milestonesRes.json();
          if (typeof body?.detail === 'string') detail = body.detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      const milestonesData = (await milestonesRes.json()) as MilestonesDocument;
      setItems(Array.isArray(milestonesData.items) ? milestonesData.items : []);

      if (checklistRes.ok) {
        const checklistData = (await checklistRes.json()) as ProjectSpecChecklistData;
        setAvailableSpecs(Array.isArray(checklistData.specs) ? checklistData.specs : []);
      } else {
        setAvailableSpecs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar milestones.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!draft) return;
    setShowForm(true);
    setEditingId(null);
    setFormTitle(draft.title?.trim() ?? '');
    setFormDescription(draft.description?.trim() ?? '');
    setFormTargetDate('');
    setFormSpecIds([]);
    onDraftConsumed?.();
  }, [draft, onDraftConsumed]);

  const persist = useCallback(
    (nextItems: Milestone[]) => {
      itemsRef.current = nextItems;
      setItems(nextItems);
      setSaving(true);
      setError(null);

      const run = async () => {
        const response = await fetch(`/api/projects/${project.id}/milestones`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 1, items: nextItems }),
          cache: 'no-store',
        });

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

        const data = (await response.json()) as MilestonesDocument;
        setItems(Array.isArray(data.items) ? data.items : nextItems);
      };

      const queued = queueRef.current
        .catch(() => undefined)
        .then(run)
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Não foi possível salvar milestones.');
          toast.error('Falha ao salvar milestone');
          void load();
        })
        .finally(() => {
          if (queueRef.current === queued) setSaving(false);
        });

      queueRef.current = queued;
    },
    [load, project.id],
  );

  const cascadeRemovePlans = useCallback(
    async (milestoneId: string) => {
      try {
        const response = await fetch(`/api/projects/${project.id}/plans`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { items?: Array<{ milestoneId: string }> };
        const current = Array.isArray(data.items) ? data.items : [];
        const next = current.filter((plan) => plan.milestoneId !== milestoneId);
        if (next.length === current.length) return;
        await fetch(`/api/projects/${project.id}/plans`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 1, items: next }),
          cache: 'no-store',
        });
      } catch {
        /* ignore cascade failure */
      }
    },
    [project.id],
  );

  const resetForm = () => {
    setFormTitle('');
    setFormTargetDate('');
    setFormDescription('');
    setFormSpecIds([]);
    setEditingId(null);
    setShowForm(false);
  };

  const toggleFormSpec = (specId: string) => {
    setFormSpecIds((prev) =>
      prev.includes(specId) ? prev.filter((id) => id !== specId) : [...prev, specId],
    );
  };

  const handleCreate = () => {
    const title = formTitle.trim();
    if (!title || saving) return;
    const next: Milestone = {
      id: createMilestoneId(),
      title,
      targetDate: formTargetDate.trim(),
      description: formDescription.trim(),
      specIds: [...formSpecIds],
    };
    persist([...itemsRef.current, next]);
    resetForm();
    toast.success('Milestone criado.');
  };

  const handleStartEdit = (milestone: Milestone) => {
    if (saving) return;
    setEditingId(milestone.id);
    setShowForm(false);
    setFormTitle(milestone.title);
    setFormTargetDate(milestone.targetDate);
    setFormDescription(milestone.description);
    setFormSpecIds([...milestone.specIds]);
  };

  const handleSaveEdit = () => {
    if (!editingId || saving) return;
    const title = formTitle.trim();
    if (!title) {
      setError('Informe um título para o milestone.');
      return;
    }
    const next = itemsRef.current.map((item) =>
      item.id === editingId
        ? {
            ...item,
            title,
            targetDate: formTargetDate.trim(),
            description: formDescription.trim(),
            specIds: [...formSpecIds],
          }
        : item,
    );
    persist(next);
    resetForm();
    toast.success('Milestone atualizado.');
  };

  const handleRemove = (milestone: Milestone) => {
    if (saving) return;
    if (!window.confirm(`Remover o milestone "${milestone.title}"?`)) return;
    const next = itemsRef.current.filter((item) => item.id !== milestone.id);
    if (editingId === milestone.id) resetForm();
    persist(next);
    void cascadeRemovePlans(milestone.id);
    toast.success('Milestone removido.');
  };

  if (loading) {
    return (
      <p
        className="text-[13px]"
        style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
      >
        Carregando milestones…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            Milestones
          </h3>
          <p
            className="mt-1 text-[13px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            Planejamento futuro — specs que serão implementadas. Diferente de checkpoints
            (reuniões e entregas já realizadas).
          </p>
        </div>
        <div
          className="text-[12px] uppercase tracking-wider"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          {saving ? 'Salvando…' : `${items.length} milestone${items.length === 1 ? '' : 's'}`}
        </div>
      </div>

      {error ? (
        <p className="text-[13px] text-[var(--color-danger)]" role="alert">{error}</p>
      ) : null}

      {!showForm && !editingId ? (
        <button
          type="button"
          className="btn btn-primary self-start"
          onClick={() => setShowForm(true)}
          disabled={saving}
        >
          Novo milestone
        </button>
      ) : null}

      {showForm && !editingId ? (
        <MilestoneForm
          title={formTitle}
          targetDate={formTargetDate}
          description={formDescription}
          selectedSpecIds={formSpecIds}
          availableSpecs={availableSpecs}
          saving={saving}
          submitLabel="Criar milestone"
          onTitleChange={setFormTitle}
          onTargetDateChange={setFormTargetDate}
          onDescriptionChange={setFormDescription}
          onToggleSpec={toggleFormSpec}
          onSubmit={handleCreate}
          onCancel={resetForm}
        />
      ) : null}

      {editingId ? (
        <MilestoneForm
          title={formTitle}
          targetDate={formTargetDate}
          description={formDescription}
          selectedSpecIds={formSpecIds}
          availableSpecs={availableSpecs}
          saving={saving}
          submitLabel="Salvar alterações"
          onTitleChange={setFormTitle}
          onTargetDateChange={setFormTargetDate}
          onDescriptionChange={setFormDescription}
          onToggleSpec={toggleFormSpec}
          onSubmit={handleSaveEdit}
          onCancel={resetForm}
        />
      ) : null}

      {items.length === 0 ? (
        <div
          className="rounded border border-dashed border-[var(--color-divider)] px-6 py-10 text-center"
          style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
        >
          <p className="text-[15px] font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
            Nenhum milestone planejado
          </p>
          <p className="mt-2 text-[13px]">
            Crie marcos futuros e vincule às specs que serão implementadas.
          </p>
        </div>
      ) : (
        <ol className="relative m-0 list-none p-0" aria-label="Timeline de milestones">
          {timelineEntries.map((entry) => {
            const displayDate = formatMilestoneDate(entry.date);
            return (
              <li
                key={entry.milestone.id}
                className="relative pb-8 pl-8 last:pb-0"
                style={{ borderLeft: 'none' }}
              >
                <span
                  className="absolute left-0 top-1 rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-bg)]"
                  style={{
                    width: TIMELINE_DOT_SIZE,
                    height: TIMELINE_DOT_SIZE,
                    left: 0,
                    boxShadow: entry.isFirstDayAnchor
                      ? '0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent)'
                      : undefined,
                  }}
                  aria-hidden
                />
                <span
                  className="absolute top-0 bottom-0 w-px bg-[var(--color-divider)]"
                  style={{ left: TIMELINE_LINE_LEFT }}
                  aria-hidden
                />
                {entry.isDayAnchor && displayDate ? (
                  <p
                    className="mb-2 text-[12px] uppercase tracking-wider"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                    }}
                  >
                    {displayDate}
                  </p>
                ) : null}
                <div className="rounded border border-[var(--color-divider)] bg-[var(--color-bg)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4
                      className="text-[15px] font-semibold"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {entry.milestone.title}
                    </h4>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn text-[12px]"
                        onClick={() => handleStartEdit(entry.milestone)}
                        disabled={saving}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn text-[12px]"
                        onClick={() => handleRemove(entry.milestone)}
                        disabled={saving}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  {entry.milestone.description ? (
                    <p
                      className="mt-2 text-[13px] leading-relaxed"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'color-mix(in srgb, var(--color-text) 75%, transparent)',
                      }}
                    >
                      {entry.milestone.description}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <SpecChips specIds={entry.milestone.specIds} specsById={specsById} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
