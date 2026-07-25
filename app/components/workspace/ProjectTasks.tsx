'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';
import type { Project } from './data';

type TaskItem = {
  id: string;
  label: string;
  done: boolean;
};

type TasksDocument = {
  version: 1;
  items: TaskItem[];
  tasks_path?: string;
  source?: string;
  updated_at?: string | null;
};

type ProjectTasksProps = {
  project: Project;
  refreshKey?: number;
};

function createItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const iconBtnStyle: CSSProperties = {
  width: 34,
  minHeight: 34,
  padding: 0,
  justifyContent: 'center',
  border: 'none',
};

function IconEdit() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export default function ProjectTasks({ project, refreshKey = 0 }: ProjectTasksProps) {
  const [items, setItems] = useState<TaskItem[]>([]);
  const [tasksPath, setTasksPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const itemsRef = useRef<TaskItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const freshGithub = project.sourceType === 'github';
      const url = freshGithub
        ? `/api/projects/${project.id}/tasks?r=${refreshKey}&t=${Date.now()}`
        : `/api/projects/${project.id}/tasks`;
      const response = await fetch(url, { cache: 'no-store' });
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
      const data = (await response.json()) as TasksDocument;
      setItems(Array.isArray(data.items) ? data.items : []);
      setTasksPath(data.tasks_path ?? project.tasksPath ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as tasks.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [project.id, project.sourceType, project.tasksPath, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    (nextItems: TaskItem[]) => {
      itemsRef.current = nextItems;
      setItems(nextItems);
      setSaving(true);
      setError(null);

      const run = async () => {
        const response = await fetch(`/api/projects/${project.id}/tasks`, {
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

        const data = (await response.json()) as TasksDocument;
        setItems(Array.isArray(data.items) ? data.items : nextItems);
        setTasksPath(data.tasks_path ?? tasksPath);
      };

      const queued = queueRef.current
        .catch(() => undefined)
        .then(run)
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Não foi possível salvar as tasks.');
          toast.error('Falha ao salvar tasks');
          void load();
        })
        .finally(() => {
          if (queueRef.current === queued) {
            setSaving(false);
          }
        });

      queueRef.current = queued;
    },
    [load, project.id, tasksPath],
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

  const handleStartEdit = (item: TaskItem) => {
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
    if (!window.confirm(`Remover a task "${label}"?`)) return;
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
            Tasks
          </h3>
          <p
            className="mt-1 text-[13px]"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            {project.sourceType === 'local' || project.sourceType === 'local_repo' ? (
              <>Tarefas embutidas no JSON do projeto (workspace_data).</>
            ) : (
              <>
                Tarefas persistidas em{' '}
                <span className="text-[var(--color-text)]">
                  {tasksPath ?? project.tasksPath ?? 'tasks.json'}
                </span>
                {project.sourceType === 'github' ? ' no repositório GitHub.' : ''}
              </>
            )}
          </p>
        </div>
        <div
          className="text-[12px] uppercase tracking-wider"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          {saving ? 'Salvando…' : `${doneCount}/${items.length} concluídas`}
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
          placeholder="Nova task…"
          maxLength={200}
          disabled={loading || saving}
          aria-label="Nova task"
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
          Carregando tasks…
        </p>
      ) : items.length === 0 ? (
        <div
          className="border border-dashed border-[var(--color-divider)] px-4 py-12 text-center"
          style={{
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <p className="text-sm">Nenhuma task ainda.</p>
          <p className="mt-1 text-xs">Adicione tarefas simples para acompanhar este projeto.</p>
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
                    aria-label="Renomear task"
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
                        className="fbtn"
                        style={iconBtnStyle}
                        disabled={saving}
                        onClick={() => handleStartEdit(item)}
                        aria-label={`Renomear ${item.label}`}
                        title="Renomear"
                      >
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="fbtn"
                        style={iconBtnStyle}
                        disabled={saving}
                        onClick={() => handleRemove(item.id, item.label)}
                        aria-label={`Remover ${item.label}`}
                        title="Remover"
                      >
                        <IconTrash />
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
