'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ProjectSource } from './data';

export type CreateProjectPayload = {
  source_type: ProjectSource;
  json_content?: Record<string, unknown>;
  local_path?: string;
  spec_project_id?: string;
  spec_checklist_path?: string;
  github_repo_url?: string;
  github_pat?: string;
  github_branch?: string;
};

export type ProjectApiResponse = {
  id: string;
  name: string;
  source_type: ProjectSource;
  json_data: Record<string, unknown>;
  local_file_path: string | null;
  local_path: string | null;
  local_path_relative: string | null;
  github_repo_url: string | null;
  github_branch: string | null;
  github_file_path: string | null;
  spec_project_id: string | null;
  spec_checklist_path: string | null;
  tasks_path: string | null;
  has_github_pat: boolean;
  last_synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AddProjectModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectApiResponse) => void;
  projectsFolder?: string | null;
};

type ManualForm = {
  name: string;
  client: string;
};

const EMPTY_MANUAL: ManualForm = {
  name: '',
  client: '',
};

const SOURCE_OPTIONS: { id: ProjectSource; label: string }[] = [
  { id: 'local', label: 'Manual' },
  { id: 'local_repo', label: 'Manual · repo' },
  { id: 'github', label: 'GitHub' },
];

function sourceDescription(source: ProjectSource): string {
  if (source === 'local') {
    return 'Projeto sem repositório — informe ao menos o nome.';
  }
  if (source === 'local_repo') {
    return 'Projeto manual com referência a um repositório local no disco.';
  }
  return 'Conecte um repositório GitHub para specs via .specs/spec-checklist.json; tasks ficam no JSON local.';
}

export default function AddProjectModal({
  open,
  onClose,
  onCreated,
  projectsFolder,
}: AddProjectModalProps) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<ProjectSource>('local');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manual, setManual] = useState<ManualForm>(EMPTY_MANUAL);
  const [localPath, setLocalPath] = useState('');

  const [repoUrl, setRepoUrl] = useState('');
  const [pat, setPat] = useState('');
  const [branch, setBranch] = useState('main');
  const [specProjectId, setSpecProjectId] = useState('');
  const [specChecklistPath, setSpecChecklistPath] = useState('.specs/spec-checklist.json');

  useEffect(() => {
    if (!open) return;
    setError(null);
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, source]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const resetForm = () => {
    setSource('local');
    setManual(EMPTY_MANUAL);
    setLocalPath('');
    setRepoUrl('');
    setPat('');
    setBranch('main');
    setSpecProjectId('');
    setSpecChecklistPath('.specs/spec-checklist.json');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const updateManual = <K extends keyof ManualForm>(key: K, value: ManualForm[K]) => {
    setManual((prev) => ({ ...prev, [key]: value }));
  };

  const buildManualJson = (): Record<string, unknown> | null => {
    if (!manual.name.trim()) {
      setError('Informe o nome do projeto.');
      return null;
    }
    return {
      name: manual.name.trim(),
      client: manual.client.trim() || '—',
      ai: '',
      topDate: '—',
      checkpoints: [],
      tasks: [],
      lastInteractionDays: 0,
      openDemands: 0,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let payload: CreateProjectPayload;

    if (source === 'local') {
      const json_content = buildManualJson();
      if (!json_content) return;
      payload = { source_type: 'local', json_content };
    } else if (source === 'local_repo') {
      const json_content = buildManualJson();
      if (!json_content) return;
      if (!localPath.trim()) {
        setError('Informe o caminho local do repositório.');
        return;
      }
      payload = {
        source_type: 'local_repo',
        json_content,
        local_path: localPath.trim(),
      };
    } else {
      const json_content = buildManualJson();
      if (!json_content) return;
      if (!repoUrl.trim() || !pat.trim() || !branch.trim()) {
        setError('Preencha link do repo, PAT e branch.');
        return;
      }
      payload = {
        source_type: 'github',
        json_content,
        github_repo_url: repoUrl.trim(),
        github_pat: pat.trim(),
        github_branch: branch.trim(),
        ...(specProjectId.trim() ? { spec_project_id: specProjectId.trim() } : {}),
        ...(specChecklistPath.trim()
          ? { spec_checklist_path: specChecklistPath.trim() }
          : {}),
      };
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let detail = `Erro ${response.status}`;
        try {
          const body = await response.json();
          if (typeof body?.detail === 'string') detail = body.detail;
          else if (Array.isArray(body?.detail)) {
            detail = body.detail
              .map((d: { msg?: string }) => d.msg)
              .filter(Boolean)
              .join('; ');
          }
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      const created: ProjectApiResponse = await response.json();
      toast.success(
        source === 'github'
          ? 'Projeto GitHub adicionado.'
          : 'project.json criado na pasta de projetos.',
      );
      resetForm();
      onCreated(created);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao criar projeto';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer border-0"
        style={{ background: 'color-mix(in srgb, var(--color-text) 42%, transparent)' }}
        aria-label="Fechar"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-fade-up relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-[520px] flex-col border border-[var(--color-divider)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-divider)] px-6 py-5">
          <div>
            <p className="chk mb-2">Novo projeto</p>
            <h2
              id={titleId}
              className="text-[28px] font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
            >
              Adicionar projeto
            </h2>
            <p
              className="mt-1.5 text-[13px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              {sourceDescription(source)}
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-5 flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={source === option.id ? 'tag tag-accent' : 'tag tag-outline'}
                  onClick={() => setSource(option.id)}
                  disabled={submitting}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {error && (
              <div
                className="mb-4 border border-[var(--color-accent)] px-3 py-2.5 text-[13px]"
                style={{
                  background: 'var(--color-accent-100)',
                  color: 'var(--color-accent-800)',
                  fontFamily: 'var(--font-body)',
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            {source === 'github' ? (
              <div className="flex flex-col gap-4">
                <Field label="Nome" htmlFor="gh-name">
                  <input
                    ref={firstFieldRef}
                    id="gh-name"
                    className="input"
                    value={manual.name}
                    onChange={(e) => updateManual('name', e.target.value)}
                    placeholder="Acme API"
                    disabled={submitting}
                    required
                  />
                </Field>

                <Field label="Client (opcional)" htmlFor="gh-client">
                  <input
                    id="gh-client"
                    className="input"
                    value={manual.client}
                    onChange={(e) => updateManual('client', e.target.value)}
                    placeholder="Acme"
                    disabled={submitting}
                  />
                </Field>

                <Field label="Link do repositório" htmlFor="gh-repo">
                  <input
                    id="gh-repo"
                    className="input"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    disabled={submitting}
                    required
                    autoComplete="off"
                  />
                </Field>

                <Field
                  label="PAT do GitHub"
                  htmlFor="gh-pat"
                  hint="Personal Access Token com leitura no repositório."
                >
                  <input
                    id="gh-pat"
                    type="password"
                    className="input"
                    value={pat}
                    onChange={(e) => setPat(e.target.value)}
                    placeholder="ghp_…"
                    disabled={submitting}
                    required
                    autoComplete="off"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Branch" htmlFor="gh-branch">
                    <input
                      id="gh-branch"
                      className="input"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      disabled={submitting}
                      required
                    />
                  </Field>

                  <Field
                    label="ID no spec-checklist"
                    htmlFor="gh-spec-project-id"
                    hint="Opcional — projects[].id no checklist remoto."
                  >
                    <input
                      id="gh-spec-project-id"
                      className="input"
                      value={specProjectId}
                      onChange={(e) => setSpecProjectId(e.target.value)}
                      placeholder="workspace"
                      disabled={submitting}
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <Field
                  label="Caminho do spec-checklist"
                  htmlFor="gh-spec-checklist-path"
                  hint="Padrão: .specs/spec-checklist.json"
                >
                  <input
                    id="gh-spec-checklist-path"
                    className="input"
                    value={specChecklistPath}
                    onChange={(e) => setSpecChecklistPath(e.target.value)}
                    placeholder=".specs/spec-checklist.json"
                    disabled={submitting}
                    autoComplete="off"
                  />
                </Field>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {projectsFolder ? (
                  <p
                    className="text-[13px] italic"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                    }}
                  >
                    Destino:{' '}
                    <span style={{ color: 'var(--color-text)' }}>
                      {projectsFolder}/&lt;slug&gt;.json
                    </span>
                  </p>
                ) : null}

                <Field label="Nome" htmlFor="p-name">
                  <input
                    ref={firstFieldRef}
                    id="p-name"
                    className="input"
                    value={manual.name}
                    onChange={(e) => updateManual('name', e.target.value)}
                    placeholder="Acme API"
                    disabled={submitting}
                    required
                  />
                </Field>

                <Field label="Client (opcional)" htmlFor="p-client">
                  <input
                    id="p-client"
                    className="input"
                    value={manual.client}
                    onChange={(e) => updateManual('client', e.target.value)}
                    placeholder="Acme"
                    disabled={submitting}
                  />
                </Field>

                {source === 'local_repo' ? (
                  <Field
                    label="Caminho local do repositório"
                    htmlFor="p-local-path"
                    hint="Pasta no disco onde o código do projeto está."
                  >
                    <input
                      id="p-local-path"
                      className="input"
                      value={localPath}
                      onChange={(e) => setLocalPath(e.target.value)}
                      placeholder="/Users/voce/workspace/meu-projeto"
                      disabled={submitting}
                      required
                    />
                  </Field>
                ) : null}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-[var(--color-divider)] px-6 py-4">
            <button
              type="button"
              className="btn"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting
                ? source === 'github'
                  ? 'Carregando specs e resumo…'
                  : 'Criando…'
                : source === 'github'
                  ? 'Adicionar projeto'
                  : 'Criar projeto'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
        style={{
          fontFamily: 'var(--font-heading)',
          color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
        }}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p
          className="mt-1.5 text-[12px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
