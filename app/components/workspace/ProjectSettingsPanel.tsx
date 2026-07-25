'use client';

import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import type { ProjectApiResponse } from './AddProjectModal';
import type { Project, ProjectSource } from './data';

type ProjectSettingsPanelProps = {
  project: Project;
  onUpdated: (project: ProjectApiResponse) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

const SOURCE_OPTIONS: { id: ProjectSource; label: string }[] = [
  { id: 'local', label: 'Manual' },
  { id: 'local_repo', label: 'Manual · repo' },
  { id: 'github', label: 'GitHub' },
];

function sourceDescription(source: ProjectSource): string {
  if (source === 'local') {
    return 'Projeto sem repositório — apenas dados no JSON local.';
  }
  if (source === 'local_repo') {
    return 'Projeto com referência a um repositório local no disco.';
  }
  return 'Projeto sincronizado a partir do GitHub.';
}

export default function ProjectSettingsPanel({
  project,
  onUpdated,
  onDeleted,
  onClose,
}: ProjectSettingsPanelProps) {
  const formId = useId();
  const [source, setSource] = useState<ProjectSource>(project.sourceType ?? 'local');
  const [projectId, setProjectId] = useState(project.id);
  const [specProjectId, setSpecProjectId] = useState(project.specProjectId ?? '');
  const [specChecklistPath, setSpecChecklistPath] = useState(
    project.specChecklistPath ?? '.specs/spec-checklist.json',
  );
  const [tasksPath, setTasksPath] = useState(project.tasksPath ?? 'tasks.json');
  const [localPath, setLocalPath] = useState(project.localRepoPath ?? '');
  const [repoUrl, setRepoUrl] = useState(project.githubRepoUrl ?? '');
  const [pat, setPat] = useState('');
  const [hasGithubPat, setHasGithubPat] = useState(project.hasGithubPat ?? false);
  const [branch, setBranch] = useState(project.githubBranch ?? 'main');
  const [filePath, setFilePath] = useState(project.githubFilePath ?? 'project.json');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSource(project.sourceType ?? 'local');
    setProjectId(project.id);
    setSpecProjectId(project.specProjectId ?? '');
    setSpecChecklistPath(project.specChecklistPath ?? '.specs/spec-checklist.json');
    setTasksPath(project.tasksPath ?? 'tasks.json');
    setLocalPath(project.localRepoPath ?? '');
    setRepoUrl(project.githubRepoUrl ?? '');
    setPat('');
    setHasGithubPat(project.hasGithubPat ?? false);
    setBranch(project.githubBranch ?? 'main');
    setFilePath(project.githubFilePath ?? 'project.json');
    setError(null);
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId.trim()) {
      setError('Informe o ID do projeto.');
      return;
    }

    if (source === 'local_repo' && !localPath.trim()) {
      setError('Informe o caminho local do repositório.');
      return;
    }

    if (source === 'github') {
      if (!repoUrl.trim() || !branch.trim() || !filePath.trim()) {
        setError('Preencha link do repo, branch e caminho do arquivo.');
        return;
      }
      if (!hasGithubPat && !pat.trim()) {
        setError('Informe o PAT do GitHub.');
        return;
      }
    }

    const payload: Record<string, string> = {
      source_type: source,
      new_id: projectId.trim(),
      spec_project_id: specProjectId.trim(),
      spec_checklist_path: specChecklistPath.trim() || '.specs/spec-checklist.json',
    };

    if (source === 'github') {
      payload.tasks_path = tasksPath.trim() || 'tasks.json';
    }

    if (source === 'local_repo') {
      payload.local_path = localPath.trim();
    }

    if (source === 'github') {
      payload.github_repo_url = repoUrl.trim();
      payload.github_branch = branch.trim();
      payload.github_file_path = filePath.trim();
      if (pat.trim()) {
        payload.github_pat = pat.trim();
      }
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

      const updated: ProjectApiResponse = await response.json();
      toast.success('Configurações do projeto salvas.');
      onUpdated(updated);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível salvar as configurações.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Remover o projeto "${project.name}" da lista? O arquivo JSON será renomeado para .json.backup e deixará de aparecer no app.`,
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
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

      toast.success('Projeto removido da lista.');
      onDeleted(project.id);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível apagar o projeto.';
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <form id={formId} onSubmit={handleSubmit} className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
      <div>
        <p
          className="text-[13px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          {sourceDescription(source)}
        </p>
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

      <section className="flex flex-col gap-4">
        <h3
          className="text-[12px] tracking-[0.08em] uppercase"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
          }}
        >
          Tipo de origem
        </h3>
        <div className="flex flex-wrap gap-2">
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={source === option.id ? 'tag tag-accent' : 'tag tag-outline'}
              onClick={() => setSource(option.id)}
              disabled={busy}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-[var(--color-divider)] pt-6">
        <h3
          className="text-[12px] tracking-[0.08em] uppercase"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
          }}
        >
          Identificação
        </h3>

        <Field
          label="ID do projeto"
          htmlFor="ps-project-id"
          hint="Slug do arquivo JSON na pasta de projetos. Alterar renomeia o arquivo."
        >
          <input
            id="ps-project-id"
            className="input"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="meu-projeto"
            disabled={busy}
            required
            autoComplete="off"
          />
        </Field>

        <Field
          label="ID no spec-checklist"
          htmlFor="ps-spec-project-id"
          hint="Valor de projects[].id no .specs/spec-checklist.json do repositório."
        >
          <input
            id="ps-spec-project-id"
            className="input"
            value={specProjectId}
            onChange={(e) => setSpecProjectId(e.target.value)}
            placeholder="workspace"
            disabled={busy}
            autoComplete="off"
          />
        </Field>

        {source !== 'local' ? (
          <Field
            label="Caminho do spec-checklist"
            htmlFor="ps-spec-checklist-path"
            hint="Caminho relativo ao repositório. Padrão: .specs/spec-checklist.json"
          >
            <input
              id="ps-spec-checklist-path"
              className="input"
              value={specChecklistPath}
              onChange={(e) => setSpecChecklistPath(e.target.value)}
              placeholder=".specs/spec-checklist.json"
              disabled={busy}
              autoComplete="off"
            />
          </Field>
        ) : null}

        {source === 'github' ? (
          <Field
            label="Caminho do tasks.json"
            htmlFor="ps-tasks-path"
            hint="Caminho relativo ao repositório no GitHub. Padrão: tasks.json"
          >
            <input
              id="ps-tasks-path"
              className="input"
              value={tasksPath}
              onChange={(e) => setTasksPath(e.target.value)}
              placeholder="tasks.json"
              disabled={busy}
              autoComplete="off"
            />
          </Field>
        ) : null}
      </section>

      {source === 'local_repo' ? (
        <section className="flex flex-col gap-4 border-t border-[var(--color-divider)] pt-6">
          <h3
            className="text-[12px] tracking-[0.08em] uppercase"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
            }}
          >
            Repositório local
          </h3>

          <Field
            label="Caminho local do repositório"
            htmlFor="ps-local-path"
            hint="Pasta no disco onde o código do projeto está."
          >
            <input
              id="ps-local-path"
              className="input"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="/Users/voce/workspace/meu-projeto"
              disabled={busy}
              required
            />
          </Field>
        </section>
      ) : null}

      {source === 'github' ? (
        <section className="flex flex-col gap-4 border-t border-[var(--color-divider)] pt-6">
          <h3
            className="text-[12px] tracking-[0.08em] uppercase"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
            }}
          >
            GitHub
          </h3>

          <Field label="Link do repositório" htmlFor="ps-gh-repo">
            <input
              id="ps-gh-repo"
              className="input"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              disabled={busy}
              required
              autoComplete="off"
            />
          </Field>

          <Field
            label="PAT do GitHub"
            htmlFor="ps-gh-pat"
            hint={
              hasGithubPat
                ? 'Deixe em branco para manter o token atual.'
                : 'Personal Access Token com leitura no repositório.'
            }
          >
            <input
              id="ps-gh-pat"
              type="password"
              className="input"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder={hasGithubPat ? '••••••••' : 'ghp_…'}
              disabled={busy}
              required={!hasGithubPat}
              autoComplete="off"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Branch" htmlFor="ps-gh-branch">
              <input
                id="ps-gh-branch"
                className="input"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                disabled={busy}
                required
              />
            </Field>

            <Field label="Caminho do project.json" htmlFor="ps-gh-path">
              <input
                id="ps-gh-path"
                className="input"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="project.json"
                disabled={busy}
                required
              />
            </Field>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-[var(--color-divider)] pt-6">
        <h3
          className="text-[12px] tracking-[0.08em] uppercase"
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
          }}
        >
          Zona de perigo
        </h3>
        <p
          className="text-[13px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Remove o projeto da listagem renomeando o arquivo para .json.backup.
        </p>
        <div>
          <button
            type="button"
            className="btn"
            onClick={handleDelete}
            disabled={busy}
            style={{
              color: 'var(--color-accent-800)',
              borderColor: 'var(--color-accent)',
            }}
          >
            {deleting ? 'Apagando…' : 'Apagar projeto'}
          </button>
        </div>
      </section>

      <div className="flex justify-end border-t border-[var(--color-divider)] pt-6">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </div>
    </form>
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
