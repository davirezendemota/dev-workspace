'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import CustomSelect from '@/app/components/CustomSelect';
import { useUiTheme } from '@/app/components/ThemeProvider';
import type { UiMode, UiTheme } from '@/app/lib/theme';

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'mistral', label: 'Mistral AI' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'aws-bedrock', label: 'AWS Bedrock' },
  { value: 'groq', label: 'Groq' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'xai', label: 'xAI' },
] as const;

const UI_THEME_OPTIONS = [
  { value: 'classic', label: 'Classic' },
  { value: 'github', label: 'GitHub' },
] as const;

const UI_MODE_OPTIONS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
] as const;

type VectorKnowledgeProjectStatus = {
  id: string;
  name: string;
  expected_chunks: number;
  indexed_chunks: number;
  embedded_chunks: number;
  last_indexed_at: string | null;
  status: 'synced' | 'partial' | 'pending' | 'empty';
};

type VectorKnowledgeStatus = {
  enabled: boolean;
  database_configured: boolean;
  embedding_configured: boolean;
  embedding_provider: string;
  embedding_model: string;
  has_embedding_token: boolean;
  projects_total: number;
  projects_indexed: number;
  expected_chunks_total: number;
  indexed_chunks_total: number;
  embedded_chunks_total: number;
  progress_percent: number;
  last_indexed_at: string | null;
  projects: VectorKnowledgeProjectStatus[];
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function projectStatusLabel(status: VectorKnowledgeProjectStatus['status']): string {
  switch (status) {
    case 'synced':
      return 'Sincronizado';
    case 'partial':
      return 'Parcial';
    case 'empty':
      return 'Sem conteúdo';
    default:
      return 'Pendente';
  }
}

export type WorkspaceSettings = {
  projects_folder: string;
  agents_folder: string;
  config_path: string;
  ai_provider: string;
  ai_model: string;
  has_ai_token: boolean;
  ai_project_summary_prompt: string;
  default_ai_project_summary_prompt: string;
  uses_custom_ai_project_summary_prompt: boolean;
  ui_theme: UiTheme;
  ui_mode: UiMode;
};

export function isAiConfigured(
  settings: Pick<WorkspaceSettings, 'ai_provider' | 'ai_model' | 'has_ai_token'>,
): boolean {
  return Boolean(
    settings.ai_provider.trim() &&
      settings.ai_model.trim() &&
      settings.has_ai_token,
  );
}

type SettingsPanelProps = {
  onSettingsChange?: (settings: WorkspaceSettings) => void;
};

export default function SettingsPanel({ onSettingsChange }: SettingsPanelProps) {
  const { setAppearance } = useUiTheme();
  const [projectsFolder, setProjectsFolder] = useState('');
  const [agentsFolder, setAgentsFolder] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [aiProvider, setAiProvider] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiApiToken, setAiApiToken] = useState('');
  const [hasAiToken, setHasAiToken] = useState(false);
  const [aiProjectSummaryPrompt, setAiProjectSummaryPrompt] = useState('');
  const [defaultAiProjectSummaryPrompt, setDefaultAiProjectSummaryPrompt] =
    useState('');
  const [usesCustomAiProjectSummaryPrompt, setUsesCustomAiProjectSummaryPrompt] =
    useState(false);
  const [uiTheme, setUiTheme] = useState<UiTheme>('classic');
  const [uiMode, setUiMode] = useState<UiMode>('light');
  const [loading, setLoading] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [savingSummaryPrompt, setSavingSummaryPrompt] = useState(false);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [summaryPromptError, setSummaryPromptError] = useState<string | null>(null);
  const [appearanceError, setAppearanceError] = useState<string | null>(null);
  const [vectorStatus, setVectorStatus] = useState<VectorKnowledgeStatus | null>(null);
  const [vectorLoading, setVectorLoading] = useState(true);
  const [vectorSyncing, setVectorSyncing] = useState(false);
  const [vectorError, setVectorError] = useState<string | null>(null);

  const loadVectorStatus = async () => {
    try {
      setVectorError(null);
      const response = await fetch('/api/settings/vector-knowledge');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: VectorKnowledgeStatus = await response.json();
      setVectorStatus(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o status do banco vetorial.';
      setVectorError(message);
    } finally {
      setVectorLoading(false);
    }
  };

  const applySettings = (data: WorkspaceSettings) => {
    setProjectsFolder(data.projects_folder);
    setAgentsFolder(data.agents_folder);
    setConfigPath(data.config_path);
    setAiProvider(data.ai_provider);
    setAiModel(data.ai_model);
    setHasAiToken(data.has_ai_token);
    setAiApiToken('');
    setDefaultAiProjectSummaryPrompt(data.default_ai_project_summary_prompt);
    setUsesCustomAiProjectSummaryPrompt(data.uses_custom_ai_project_summary_prompt);
    setAiProjectSummaryPrompt(
      data.uses_custom_ai_project_summary_prompt
        ? data.ai_project_summary_prompt
        : data.default_ai_project_summary_prompt,
    );
    setUiTheme(data.ui_theme);
    setUiMode(data.ui_mode);
    setAppearance(data.ui_theme, data.ui_mode);
    onSettingsChange?.(data);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setWorkspaceError(null);
        setAiError(null);
        setSummaryPromptError(null);
        setAppearanceError(null);
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: WorkspaceSettings = await response.json();
        if (cancelled) return;
        applySettings(data);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar as configurações.';
          setWorkspaceError(message);
          setAiError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    void loadVectorStatus();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSettingsChange]);

  useEffect(() => {
    if (!vectorSyncing) return;

    const interval = window.setInterval(() => {
      void loadVectorStatus();
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [vectorSyncing]);

  const handleReindexVectorKnowledge = async () => {
    try {
      setVectorSyncing(true);
      setVectorError(null);

      const response = await fetch('/api/settings/vector-knowledge', {
        method: 'POST',
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

      toast.success('Reindexação do banco vetorial iniciada.');
      await loadVectorStatus();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao iniciar reindexação.';
      setVectorError(message);
      toast.error(message);
      setVectorSyncing(false);
    }
  };

  useEffect(() => {
    if (!vectorSyncing || !vectorStatus) return;
    if (vectorStatus.progress_percent >= 100) {
      setVectorSyncing(false);
    }
  }, [vectorSyncing, vectorStatus]);

  const persistSettings = async (
    payload: Record<string, string>,
    setSaving: (value: boolean) => void,
    setError: (value: string | null) => void,
    successMessage: string,
  ) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/settings', {
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

      const data: WorkspaceSettings = await response.json();
      applySettings(data);
      toast.success(successMessage);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectsFolder.trim()) {
      setWorkspaceError('Informe a pasta de projetos.');
      return;
    }
    if (!agentsFolder.trim()) {
      setWorkspaceError('Informe a pasta de prompts.');
      return;
    }

    await persistSettings(
      {
        projects_folder: projectsFolder.trim(),
        agents_folder: agentsFolder.trim(),
      },
      setSavingWorkspace,
      setWorkspaceError,
      'Configurações de workspace salvas.',
    );
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Record<string, string> = {
      ai_provider: aiProvider.trim(),
      ai_model: aiModel.trim(),
    };
    if (aiApiToken.trim()) {
      payload.ai_api_token = aiApiToken.trim();
    }

    await persistSettings(
      payload,
      setSavingAi,
      setAiError,
      'Configurações de IA salvas.',
    );
  };

  const handleRestoreSummaryPrompt = () => {
    setAiProjectSummaryPrompt(defaultAiProjectSummaryPrompt);
    setUsesCustomAiProjectSummaryPrompt(false);
  };

  const handleSaveSummaryPrompt = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = aiProjectSummaryPrompt.trim();
    if (!trimmed) {
      setSummaryPromptError('O prompt não pode ficar vazio.');
      return;
    }

    const isDefault = trimmed === defaultAiProjectSummaryPrompt.trim();

    await persistSettings(
      { ai_project_summary_prompt: isDefault ? '' : trimmed },
      setSavingSummaryPrompt,
      setSummaryPromptError,
      isDefault
        ? 'Prompt padrão restaurado.'
        : 'Prompt do resumo de projetos salvo.',
    );
  };

  const handleSaveAppearance = async (e: React.FormEvent) => {
    e.preventDefault();

    await persistSettings(
      { ui_theme: uiTheme, ui_mode: uiMode },
      setSavingAppearance,
      setAppearanceError,
      'Aparência salva.',
    );
  };

  if (loading) {
    return (
      <section className="anim-fade-up border border-[var(--color-divider)] p-10 text-center">
        <p className="chk mb-4">Settings</p>
        <p
          className="m-0 text-[16px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Carregando…
        </p>
      </section>
    );
  }

  return (
    <div className="anim-fade-up flex w-full flex-row flex-wrap gap-8">
      <section className="min-w-[min(100%,520px)] flex-[1_1_calc(50%-1rem)] border border-[var(--color-divider)] p-8">
        <h2
          className="mb-2 text-[28px] font-semibold"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          Aparência
        </h2>
        <p
          className="mb-7 text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Escolha o tema visual do dashboard. A preferência é salva em{' '}
          <code>config.json</code>.
        </p>

        {appearanceError && (
          <div
            className="mb-4 border border-[var(--color-accent)] px-3 py-2.5 text-[13px]"
            style={{
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              fontFamily: 'var(--font-body)',
            }}
            role="alert"
          >
            {appearanceError}
          </div>
        )}

        <form onSubmit={handleSaveAppearance} className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="ui-theme"
              className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              }}
            >
              Tema
            </label>
            <CustomSelect
              id="ui-theme"
              value={uiTheme}
              onChange={(value) => setUiTheme(value as UiTheme)}
              options={[...UI_THEME_OPTIONS]}
              placeholder="Selecione…"
              disabled={savingAppearance}
            />
            <p
              className="mt-1.5 text-[12px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
              }}
            >
              Classic preserva a identidade visual atual; GitHub usa fontes,
              cores e componentes inspirados na interface do GitHub.
            </p>
          </div>

          <div>
            <label
              htmlFor="ui-mode"
              className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              }}
            >
              Modo
            </label>
            <CustomSelect
              id="ui-mode"
              value={uiMode}
              onChange={(value) => setUiMode(value as UiMode)}
              options={[...UI_MODE_OPTIONS]}
              placeholder="Selecione…"
              disabled={savingAppearance}
            />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={savingAppearance}>
              {savingAppearance ? 'Salvando…' : 'Salvar aparência'}
            </button>
          </div>
        </form>
      </section>

      <section className="min-w-[min(100%,520px)] flex-[1_1_calc(50%-1rem)] border border-[var(--color-divider)] p-8">
        <h2
          className="mb-2 text-[28px] font-semibold"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          Workspace
        </h2>
        <p
          className="mb-7 text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Preferências persistidas em <code>config.json</code>. Projetos e prompts são
          gravados nas pastas abaixo.
        </p>

        {workspaceError && (
          <div
            className="mb-4 border border-[var(--color-accent)] px-3 py-2.5 text-[13px]"
            style={{
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              fontFamily: 'var(--font-body)',
            }}
            role="alert"
          >
            {workspaceError}
          </div>
        )}

        <form onSubmit={handleSaveWorkspace} className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="projects-folder"
              className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              }}
            >
              Pasta de projetos
            </label>
            <input
              id="projects-folder"
              className="input"
              value={projectsFolder}
              onChange={(e) => setProjectsFolder(e.target.value)}
              placeholder="/data/projects"
              disabled={savingWorkspace}
              required
            />
            <p
              className="mt-1.5 text-[12px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
              }}
            >
              No Docker, o volume padrão é <code>/data/projects</code> (host:{' '}
              <code>./workspace_data/projects</code>).
            </p>
          </div>

          <div>
            <label
              htmlFor="agents-folder"
              className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              }}
            >
              Pasta de prompts
            </label>
            <input
              id="agents-folder"
              className="input"
              value={agentsFolder}
              onChange={(e) => setAgentsFolder(e.target.value)}
              placeholder="/data/agents"
              disabled={savingWorkspace}
              required
            />
            <p
              className="mt-1.5 text-[12px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
              }}
            >
              No Docker, o volume padrão é <code>/data/agents</code> (host:{' '}
              <code>./workspace_data/agents</code>).
            </p>
          </div>

          {configPath ? (
            <p
              className="text-[12px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
              }}
            >
              config.json: <code>{configPath}</code>
            </p>
          ) : null}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={savingWorkspace}>
              {savingWorkspace ? 'Salvando…' : 'Salvar workspace'}
            </button>
          </div>
        </form>
      </section>

      <section className="min-w-[min(100%,520px)] flex-[1_1_calc(50%-1rem)] border border-[var(--color-divider)] p-8">
        <h2
          className="mb-2 text-[28px] font-semibold"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          IA
        </h2>
        <p
          className="mb-7 text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Provedor, modelo e token usados pelo AI input na aba Projects.
        </p>

        {aiError && (
          <div
            className="mb-4 border border-[var(--color-accent)] px-3 py-2.5 text-[13px]"
            style={{
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              fontFamily: 'var(--font-body)',
            }}
            role="alert"
          >
            {aiError}
          </div>
        )}

        <form onSubmit={handleSaveAi} className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="ai-provider"
              className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              }}
            >
              Provedor
            </label>
            <CustomSelect
              id="ai-provider"
              value={aiProvider}
              onChange={setAiProvider}
              options={[...AI_PROVIDERS]}
              placeholder="Selecione…"
              disabled={savingAi}
            />
          </div>

          <div>
            <label
              htmlFor="ai-model"
              className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              }}
            >
              Modelo
            </label>
            <input
              id="ai-model"
              className="input"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="gpt-4o-mini"
              disabled={savingAi}
            />
          </div>

          <div>
            <label
              htmlFor="ai-api-token"
              className="mb-1.5 block text-[12px] tracking-[0.08em] uppercase"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
              }}
            >
              API token
            </label>
            <input
              id="ai-api-token"
              type="password"
              className="input"
              value={aiApiToken}
              onChange={(e) => setAiApiToken(e.target.value)}
              placeholder={hasAiToken ? 'Token configurado — deixe em branco para manter' : 'sk-…'}
              disabled={savingAi}
              autoComplete="off"
            />
            {hasAiToken && (
              <p
                className="mt-1.5 text-[12px]"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-accent-700)',
                }}
              >
                Token já salvo no backend.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={savingAi}>
              {savingAi ? 'Salvando…' : 'Salvar IA'}
            </button>
          </div>
        </form>
      </section>

      <section className="min-w-[min(100%,520px)] flex-[1_1_calc(50%-1rem)] border border-[var(--color-divider)] p-8">
        <h2
          className="mb-2 text-[28px] font-semibold"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          Banco vetorial
        </h2>
        <p
          className="mb-7 text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Progresso da indexação de embeddings usada pela IA de consulta (RAG).
        </p>

        {vectorError ? (
          <div
            className="mb-4 border border-[var(--color-accent)] px-3 py-2.5 text-[13px]"
            style={{
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              fontFamily: 'var(--font-body)',
            }}
            role="alert"
          >
            {vectorError}
          </div>
        ) : null}

        {vectorLoading ? (
          <p
            className="m-0 text-[14px] italic"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
            }}
          >
            Carregando status…
          </p>
        ) : vectorStatus ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="chk mb-1">
                  {vectorStatus.enabled ? 'RAG ativo' : 'RAG indisponível'}
                </p>
                <p
                  className="m-0 text-[13px]"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
                  }}
                >
                  {vectorStatus.embedding_provider} · {vectorStatus.embedding_model}
                </p>
              </div>
              <span
                className="text-[12px] tracking-[0.06em] uppercase"
                style={{
                  fontFamily: 'var(--font-heading)',
                  color: vectorStatus.enabled
                    ? 'var(--color-accent-700)'
                    : 'color-mix(in srgb, var(--color-text) 48%, transparent)',
                }}
              >
                {vectorStatus.progress_percent}%
              </span>
            </div>

            <div
              className="h-[6px] w-full bg-[color-mix(in_srgb,var(--color-text)_10%,transparent)]"
              role="progressbar"
              aria-valuenow={vectorStatus.progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso de embedding"
            >
              <div
                className="h-full bg-[var(--color-accent)] transition-[width] duration-500"
                style={{ width: `${vectorStatus.progress_percent}%` }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <p
                className="m-0 text-[13px]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Projetos:{' '}
                <strong>
                  {vectorStatus.projects_indexed}/{vectorStatus.projects_total}
                </strong>{' '}
                sincronizados
              </p>
              <p
                className="m-0 text-[13px]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Chunks:{' '}
                <strong>
                  {vectorStatus.embedded_chunks_total}/{vectorStatus.expected_chunks_total}
                </strong>{' '}
                com embedding
              </p>
              <p
                className="m-0 text-[13px] sm:col-span-2"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
                }}
              >
                Última indexação: {formatDateTime(vectorStatus.last_indexed_at)}
              </p>
            </div>

            {!vectorStatus.database_configured ? (
              <p
                className="m-0 text-[13px]"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-accent-800)',
                }}
              >
                Configure <code>DATABASE_URL</code> para habilitar o Postgres com pgvector.
              </p>
            ) : null}

            {vectorStatus.database_configured && !vectorStatus.embedding_configured ? (
              <p
                className="m-0 text-[13px]"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-accent-800)',
                }}
              >
                Configure <code>AI_EMBEDDING_API_TOKEN</code> (OpenAI) no ambiente para gerar
                embeddings.
              </p>
            ) : null}

            {vectorStatus.projects.length > 0 ? (
              <div className="border border-[var(--color-divider)]">
                <div
                  className="grid grid-cols-[minmax(0,1.4fr)_auto_auto] gap-3 border-b border-[var(--color-divider)] px-3 py-2 text-[11px] tracking-[0.06em] uppercase"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                  }}
                >
                  <span>Projeto</span>
                  <span>Chunks</span>
                  <span>Status</span>
                </div>
                <ul className="m-0 max-h-[220px] list-none overflow-y-auto p-0">
                  {vectorStatus.projects.map((project) => (
                    <li
                      key={project.id}
                      className="grid grid-cols-[minmax(0,1.4fr)_auto_auto] items-center gap-3 border-b border-[var(--color-divider)] px-3 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p
                          className="m-0 truncate text-[13px] font-medium"
                          style={{ fontFamily: 'var(--font-body)' }}
                          title={project.name}
                        >
                          {project.name}
                        </p>
                        <p
                          className="m-0 truncate text-[11px]"
                          style={{
                            fontFamily: 'var(--font-body)',
                            color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
                          }}
                        >
                          {project.id}
                        </p>
                      </div>
                      <span
                        className="text-[12px] tabular-nums"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {project.embedded_chunks}/{project.expected_chunks}
                      </span>
                      <span
                        className="text-[11px] tracking-[0.04em] uppercase"
                        style={{
                          fontFamily: 'var(--font-heading)',
                          color:
                            project.status === 'synced'
                              ? 'var(--color-accent-700)'
                              : 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                        }}
                      >
                        {projectStatusLabel(project.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => void loadVectorStatus()}
                disabled={vectorLoading || vectorSyncing}
              >
                Atualizar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleReindexVectorKnowledge()}
                disabled={!vectorStatus.enabled || vectorSyncing}
              >
                {vectorSyncing ? 'Reindexando…' : 'Reindexar agora'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="min-w-[min(100%,520px)] flex-[1_1_calc(50%-1rem)] border border-[var(--color-divider)] p-8">
        <h2
          className="mb-2 text-[28px] font-semibold"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          Resumo de projetos
        </h2>
        <p
          className="mb-7 text-[14px] italic"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
          }}
        >
          Prompt de sistema usado para gerar o resumo IA nos cards da aba Projects.
          Deixe igual ao padrão ou personalize em <code>config.json</code> com a
          chave <code>ai_project_summary_prompt</code>.
        </p>

        {summaryPromptError && (
          <div
            className="mb-4 border border-[var(--color-accent)] px-3 py-2.5 text-[13px]"
            style={{
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              fontFamily: 'var(--font-body)',
            }}
            role="alert"
          >
            {summaryPromptError}
          </div>
        )}

        <form onSubmit={handleSaveSummaryPrompt} className="flex flex-col gap-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor="ai-project-summary-prompt"
                className="block text-[12px] tracking-[0.08em] uppercase"
                style={{
                  fontFamily: 'var(--font-heading)',
                  color: 'color-mix(in srgb, var(--color-text) 70%, transparent)',
                }}
              >
                Prompt do resumo
              </label>
              <span
                className="text-[11px] italic"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: usesCustomAiProjectSummaryPrompt
                    ? 'var(--color-accent-700)'
                    : 'color-mix(in srgb, var(--color-text) 48%, transparent)',
                }}
              >
                {usesCustomAiProjectSummaryPrompt ? 'Personalizado' : 'Padrão'}
              </span>
            </div>
            <textarea
              id="ai-project-summary-prompt"
              className="input h-[360px] resize-none font-mono text-[12px] leading-relaxed"
              value={aiProjectSummaryPrompt}
              onChange={(e) => {
                setAiProjectSummaryPrompt(e.target.value);
                setUsesCustomAiProjectSummaryPrompt(
                  e.target.value.trim() !== defaultAiProjectSummaryPrompt.trim(),
                );
              }}
              disabled={savingSummaryPrompt}
              spellCheck={false}
            />
            <p
              className="mt-1.5 text-[12px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 48%, transparent)',
              }}
            >
              Os dados do projeto são enviados separadamente como contexto. Este campo
              define apenas as instruções do sistema.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn"
              onClick={handleRestoreSummaryPrompt}
              disabled={
                savingSummaryPrompt ||
                aiProjectSummaryPrompt.trim() ===
                  defaultAiProjectSummaryPrompt.trim()
              }
            >
              Restaurar padrão
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingSummaryPrompt}
            >
              {savingSummaryPrompt ? 'Salvando…' : 'Salvar prompt'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
