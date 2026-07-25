'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';
import type { Project } from './data';

type LocalChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

type LocalChecklistDocument = {
  version: 1;
  items: LocalChecklistItem[];
};

type ProjectLocalChecklistProps = {
  project: Project;
};

function createItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export default function ProjectLocalChecklist({ project }: ProjectLocalChecklistProps) {
  const [items, setItems] = useState<LocalChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const itemsRef = useRef<LocalChecklistItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/local-checklist`);
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
      const data = (await response.json()) as LocalChecklistDocument;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o checklist.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    (nextItems: LocalChecklistItem[]) => {
      itemsRef.current = nextItems;
      setItems(nextItems);
      setSaving(true);
      setError(null);

      const run = async () => {
        const response = await fetch(`/api/projects/${project.id}/local-checklist`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 1, items: nextItems }),
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

        const data = (await response.json()) as LocalChecklistDocument;
        setItems(Array.isArray(data.items) ? data.items : nextItems);
      };

      const queued = queueRef.current
        .catch(() => undefined)
        .then(run)
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Não foi possível salvar o checklist.');
          toast.error('Falha ao salvar checklist');
          void load();
        })
        .finally(() => {
          if (queueRef.current === queued) {
            setSaving(false);
          }
        });

      queueRef.current = queued;
    },
    [load, project.id],
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label || saving) return;
    if (label.length > 200) {
      setError('O item pode ter no máximo 200 caracteres.');
      return;
    }
    const next = [
      ...itemsRef.current,
      { id: createItemId(), label, done: false },
    ];
    setNewLabel('');
    persist(next);
  };

  const handleToggle = (id: string) => {
    if (saving) return;
    const next = itemsRef.current.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item,
    );
    persist(next);
  };

  const handleStartEdit = (item: LocalChecklistItem) => {
    if (saving) return;
    setEditingId(item.id);
    setEditingLabel(item.label);
  };

  const handleSaveEdit = () => {
    if (!editingId || saving) return;
    const label = editingLabel.trim();
    if (!label) {
      setError('Informe um texto para o item.');
      return;
    }
    if (label.length > 200) {
      setError('O item pode ter no máximo 200 caracteres.');
      return;
    }
    const next = itemsRef.current.map((item) =>
      item.id === editingId ? { ...item, label } : item,
    );
    setEditingId(null);
    setEditingLabel('');
    persist(next);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingLabel('');
  };

  const handleRemove = (id: string, label: string) => {
    if (saving) return;
    if (!window.confirm(`Remover o item "${label}"?`)) return;
    const next = itemsRef.current.filter((item) => item.id !== id);
    if (editingId === id) handleCancelEdit();
    persist(next);
  };

  const doneCount = items.filter((item) => item.done).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            className="text-[18px] font-semibold"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Checklist
          </h3>
          <p
            className="mt-1 text-[13px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            Itens simples do projeto Manual — sem vínculo com repositório, issues ou PRs.
          </p>
        </div>
        <div
          className="text-[12px] uppercase tracking-wider"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          {saving ? 'Salvando…' : `${doneCount}/${items.length} concluídos`}
        </div>
      </div>

      {error ? (
        <div
          className="border border-[var(--color-accent)] px-3 py-2.5 text-[13px]"
          style={{
            background: 'var(--color-accent-100)',
            color: 'var(--color-accent-800)',
            fontFamily: 'var(--font-body)',
          }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Novo item…"
          maxLength={200}
          disabled={loading || saving}
          aria-label="Novo item do checklist"
        />
        <button
          type="submit"
          className="btn"
          disabled={loading || saving || !newLabel.trim()}
        >
          Adicionar
        </button>
      </form>

      {loading ? (
        <p
          className="py-10 text-center text-sm"
          style={{
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Carregando checklist…
        </p>
      ) : items.length === 0 ? (
        <div
          className="border border-dashed border-[var(--color-divider)] px-4 py-12 text-center"
          style={{
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <p className="text-sm">Nenhum item ainda.</p>
          <p className="mt-1 text-xs">Adicione tarefas simples para acompanhar este projeto Manual.</p>
        </div>
      ) : (
        <ul className="border border-[var(--color-divider)]">
          {items.map((item) => {
            const editing = editingId === item.id;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-[var(--color-divider)] px-3 py-2.5 last:border-b-0"
              >
                <button
                  type="button"
                  className={cn(
                    'flex h-[18px] w-[18px] flex-none items-center justify-center border',
                    item.done
                      ? 'border-[var(--color-accent)]'
                      : 'border-[var(--color-neutral-400)]',
                  )}
                  aria-label={item.done ? `Desmarcar ${item.label}` : `Marcar ${item.label}`}
                  aria-pressed={item.done}
                  disabled={saving || editing}
                  onClick={() => handleToggle(item.id)}
                >
                  {item.done ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </button>

                {editing ? (
                  <input
                    className="input flex-1"
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    maxLength={200}
                    disabled={saving}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEdit();
                      }
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    aria-label="Renomear item"
                  />
                ) : (
                  <span
                    className="flex-1 text-[14px]"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: item.done
                        ? 'var(--color-text)'
                        : 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                      textDecoration: item.done ? 'line-through' : undefined,
                    }}
                  >
                    {item.label}
                  </span>
                )}

                <div className="flex flex-none items-center gap-1">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        disabled={saving || !editingLabel.trim()}
                        onClick={handleSaveEdit}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={saving}
                        onClick={handleCancelEdit}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn"
                        disabled={saving}
                        onClick={() => handleStartEdit(item)}
                      >
                        Renomear
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={saving}
                        onClick={() => handleRemove(item.id, item.label)}
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
