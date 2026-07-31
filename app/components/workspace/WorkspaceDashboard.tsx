'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AiResponseSkeleton from '@/app/components/AiResponseSkeleton';
import ProjectAiSummary from './ProjectAiSummary';
import AddProjectModal, { type ProjectApiResponse } from './AddProjectModal';
import AddAgentModal from './AddAgentModal';
import AgentCard from './AgentCard';
import AgentDetailModal from './AgentDetailModal';
import ProjectDetailModal from './ProjectDetailModal';
import SettingsPanel, { isAiConfigured, type WorkspaceSettings } from './SettingsPanel';
import {
  readPinnedPromptIds,
  writePinnedPromptIds,
} from '@/app/lib/pinned-prompts';
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  TABS,
  tabHref,
  mapApiAgentToCard,
  mapApiProjectToCard,
  resolveGithubHref,
  type Agent,
  type AgentApiResponse,
  type Project,
  type SortId,
  type TabId,
} from './data';
import { latestCheckpointSortKey } from '@/app/lib/checkpoints';

function IconSend() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconSort() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconPlus({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function detectProjectFromPrompt(prompt: string, projects: Project[]): string | null {
  const query = prompt.toLowerCase();
  for (const project of projects) {
    if (project.name && query.includes(project.name.toLowerCase())) {
      return project.id;
    }
    if (project.client && project.client !== '—' && query.includes(project.client.toLowerCase())) {
      return project.id;
    }
  }
  return null;
}

function ProjectCard({
  project,
  index,
  onExpand,
  onAiUpdated,
}: {
  project: Project;
  index: number;
  onExpand?: (project: Project) => void;
  onAiUpdated?: (projectId: string, ai: string) => void;
}) {
  const githubHref = resolveGithubHref(project);
  const repoBranch =
    project.sourceType === 'github' && githubHref
      ? project.githubBranch?.trim() || 'main'
      : project.sourceType === 'local_repo'
        ? project.localRepoBranch?.trim() || 'main'
        : null;
  const repoLabel =
    repoBranch && project.repo !== '—'
      ? `${project.repo}:${repoBranch}`
      : project.repo;

  const repoMutedStyle = {
    fontFamily: 'var(--font-body)',
    color: 'color-mix(in srgb, var(--color-text) 52%, transparent)',
  } as const;

  return (
    <article
      id={`project-card-${project.id}`}
      className="project-card group relative anim-fade-up flex h-full w-[330px] flex-none flex-col gap-[18px] border border-[var(--color-divider)] px-[22px] py-6"
      style={{ animationDelay: `${0.08 + index * 0.06}s` }}
    >
      {onExpand ? (
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center border border-[var(--color-divider)] bg-[var(--color-bg)] opacity-0 transition-[opacity,border-color,color] duration-150 group-hover:opacity-100 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
          aria-label={`Expandir ${project.name}`}
          onClick={() => onExpand(project)}
        >
          <IconExpand />
        </button>
      ) : null}
      <header className="border-b border-[var(--color-divider)] pb-4 text-center">
        <h3
          className="font-[family-name:var(--font-heading)] text-[27px] font-semibold leading-[1.1] tracking-[0.01em]"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          {project.name}
        </h3>
        {githubHref ? (
          <a
            href={githubHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-[3px] block text-[13px] italic transition-colors hover:text-[var(--color-accent)]"
            style={repoMutedStyle}
          >
            {repoLabel}
          </a>
        ) : (
          <p className="mt-[3px] text-[13px] italic" style={repoMutedStyle}>
            {repoLabel}
          </p>
        )}
      </header>

      <ProjectAiSummary
        projectId={project.id}
        summary={project.ai}
        onUpdated={(ai) => onAiUpdated?.(project.id, ai)}
      />

      <div>
        {project.checkpoints.length > 0 ? (
          <>
            <div className="mb-3 flex items-baseline gap-3">
              <span
                className="num text-[30px] font-semibold text-[var(--color-accent-700)]"
                style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
              >
                {project.topDate}
              </span>
              <span
                className="text-[14px] italic"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                }}
              >
                {project.checkpoints[0]?.summary ||
                  project.checkpoints[0]?.title ||
                  'checkpoint resume'}
              </span>
            </div>
            {project.checkpoints.length > 1 ? (
              <div className="flex flex-col">
                {project.checkpoints.slice(1).map((checkpoint, i) => (
                  <div
                    key={`${project.id}-cp-${i + 1}-${checkpoint.date}-${checkpoint.title}`}
                    className="flex items-baseline gap-3 border-t border-[var(--color-divider)] py-1.5"
                  >
                    <span
                      className="num min-w-[52px] text-[18px] font-semibold"
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 600,
                        color: 'color-mix(in srgb, var(--color-text) 62%, transparent)',
                      }}
                    >
                      {checkpoint.date || '—'}
                    </span>
                    <span
                      className="text-[13px]"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
                      }}
                    >
                      {checkpoint.summary || checkpoint.title || 'checkpoint resume'}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="border-t border-[var(--color-divider)] pt-1">
        {project.checklist.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 border-b border-[var(--color-divider)] py-2.5"
          >
            {item.done ? (
              <span className="flex h-[18px] w-[18px] flex-none items-center justify-center border border-[var(--color-accent)]">
                <IconCheck />
              </span>
            ) : (
              <span className="h-[18px] w-[18px] flex-none border border-[var(--color-neutral-400)]" />
            )}
            <span
              className="flex-1 text-[14px]"
              style={{
                fontFamily: 'var(--font-body)',
                color: item.done
                  ? 'var(--color-text)'
                  : 'color-mix(in srgb, var(--color-text) 45%, transparent)',
              }}
            >
              {item.label}
            </span>
            <span
              className="num text-[12px]"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
              }}
            >
              {item.date}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function WorkspaceDashboard({ activeTab }: { activeTab: TabId }) {
  const [prompt, setPrompt] = useState('');
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [referencedProject, setReferencedProject] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortId | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsFolder, setProjectsFolder] = useState<string | null>(null);
  const [agentsFolder, setAgentsFolder] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [pinnedAgentIds, setPinnedAgentIds] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [aiConfig, setAiConfig] = useState<
    Pick<WorkspaceSettings, 'ai_provider' | 'ai_model' | 'has_ai_token'>
  >({
    ai_provider: '',
    ai_model: '',
    has_ai_token: false,
  });

  const aiConfigured = settingsLoaded && isAiConfigured(aiConfig);

  const clients = useMemo(() => {
    const set = new Set(
      projects.map((p) => p.client).filter((c) => c && c !== '—'),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const handleSettingsChange = useCallback((settings: WorkspaceSettings) => {
    setProjectsFolder(settings.projects_folder);
    setAgentsFolder(settings.agents_folder);
    setAiConfig({
      ai_provider: settings.ai_provider,
      ai_model: settings.ai_model,
      has_ai_token: settings.has_ai_token,
    });
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) return;
        const data: WorkspaceSettings = await response.json();
        if (!cancelled) {
          setProjectsFolder(data.projects_folder);
          setAgentsFolder(data.agents_folder);
          setAiConfig({
            ai_provider: data.ai_provider,
            ai_model: data.ai_model,
            has_ai_token: data.has_ai_token,
          });
          setSettingsLoaded(true);
        }
      } catch {
        /* ignore */
      }
    };

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadingProjects(true);
        const response = await fetch('/api/projects', {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items: ProjectApiResponse[] = await response.json();
        if (cancelled) return;
        setProjects(items.map(mapApiProjectToCard));
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPinnedAgentIds(readPinnedPromptIds());
  }, []);

  const togglePinAgent = useCallback((agentId: string) => {
    setPinnedAgentIds((prev) => {
      const next = prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [agentId, ...prev];
      writePinnedPromptIds(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadingAgents(true);
        const response = await fetch('/api/agents', {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items: AgentApiResponse[] = await response.json();
        if (cancelled) return;
        setAgents(items.map(mapApiAgentToCard));
      } catch {
        if (!cancelled) setAgents([]);
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProjectCreated = (apiProject: ProjectApiResponse) => {
    const card = mapApiProjectToCard(apiProject);
    setProjects((prev) => {
      const without = prev.filter((p) => p.id !== card.id);
      return [card, ...without];
    });
  };

  const handleProjectUpdated = useCallback((apiProject: ProjectApiResponse) => {
    const card = mapApiProjectToCard(apiProject);
    setProjects((prev) => {
      const selectedId = selectedProject?.id;
      return [
        card,
        ...prev.filter((p) => p.id !== card.id && (selectedId ? p.id !== selectedId : true)),
      ];
    });
    setSelectedProject(card);
  }, [selectedProject?.id]);

  const handleProjectDeleted = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setSelectedProject((current) => (current?.id === id ? null : current));
  };

  const handleAiSummaryUpdated = useCallback((projectId: string, ai: string) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, ai } : project,
      ),
    );
  }, []);

  const handleAgentCreated = (apiAgent: AgentApiResponse) => {
    const card = mapApiAgentToCard(apiAgent);
    setAgents((prev) => {
      const without = prev.filter((a) => a.id !== card.id);
      return [card, ...without];
    });
  };

  const handleAgentUpdated = (apiAgent: AgentApiResponse) => {
    const card = mapApiAgentToCard(apiAgent);
    setAgents((prev) => {
      const without = prev.filter((a) => a.id !== card.id);
      return [card, ...without];
    });
  };

  const handleAgentDeleted = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    setSelectedAgent((current) => (current?.id === id ? null : current));
    setPinnedAgentIds((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((pinnedId) => pinnedId !== id);
      writePinnedPromptIds(next);
      return next;
    });
  };

  const filteredProjects = useMemo(() => {
    let list = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.repo.toLowerCase().includes(q),
      );
    }

    if (selectedClients.length > 0) {
      list = list.filter((p) => selectedClients.includes(p.client));
    }

    const activeSort = sortBy ?? DEFAULT_SORT;

    if (activeSort === 'checkpoint') {
      list.sort(
        (a, b) => latestCheckpointSortKey(b.checkpoints) - latestCheckpointSortKey(a.checkpoints),
      );
    } else if (activeSort === 'idle') {
      list.sort((a, b) => b.lastInteractionDays - a.lastInteractionDays);
    } else if (activeSort === 'demands') {
      list.sort((a, b) => b.openDemands - a.openDemands);
    } else if (activeSort === 'recent') {
      list.sort((a, b) => a.lastInteractionDays - b.lastInteractionDays);
    }

    return list;
  }, [projects, searchQuery, selectedClients, sortBy]);

  const filteredAgents = useMemo(() => {
    let list = [...agents];

    if (agentSearchQuery.trim()) {
      const q = agentSearchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.excerpt.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q),
      );
    }

    const pinnedOrder = new Map(pinnedAgentIds.map((id, index) => [id, index]));

    list.sort((a, b) => {
      const aPinned = pinnedOrder.has(a.id);
      const bPinned = pinnedOrder.has(b.id);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned) {
        return (pinnedOrder.get(a.id) ?? 0) - (pinnedOrder.get(b.id) ?? 0);
      }

      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
    return list;
  }, [agents, agentSearchQuery, pinnedAgentIds]);

  const toggleClient = (client: string) => {
    setSelectedClients((prev) =>
      prev.includes(client) ? prev.filter((c) => c !== client) : [...prev, client],
    );
  };

  const scrollToProject = useCallback((projectId: string) => {
    requestAnimationFrame(() => {
      document
        .getElementById(`project-card-${projectId}`)
        ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }, []);

  useEffect(() => {
    if (!referencedProject) return;

    const dismissReferencedProject = () => {
      setReferencedProject(null);
    };

    document.addEventListener('click', dismissReferencedProject);
    return () => {
      document.removeEventListener('click', dismissReferencedProject);
    };
  }, [referencedProject]);

  const submitPrompt = async (text: string) => {
    if (!aiConfigured || aiLoading) return;

    const question = text.trim();
    if (!question) return;

    setLastQuestion(question);
    setReferencedProject(null);
    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch('/api/projects/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
      });

      if (!response.ok) {
        let detail = 'Falha ao consultar a IA.';
        try {
          const body = await response.json();
          if (typeof body?.detail === 'string') detail = body.detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }

      const data: { answer?: string; referenced_project_id?: string | null } =
        await response.json();
      const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
      if (!answer) {
        throw new Error('A IA retornou uma resposta vazia.');
      }

      setAiReply(answer);

      const projectId =
        (typeof data.referenced_project_id === 'string' && data.referenced_project_id) ||
        detectProjectFromPrompt(question, projects);

      const referenced = projects.find((project) => project.id === projectId);
      if (referenced) {
        setReferencedProject({ id: referenced.id, name: referenced.name });
        scrollToProject(referenced.id);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao consultar a IA.';
      setAiError(message);
      setAiReply(null);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;
    setPrompt('');
    await submitPrompt(text);
  };

  const handleResend = async () => {
    if (!lastQuestion) return;
    await submitPrompt(lastQuestion);
  };

  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col px-6 pb-[72px] pt-8 md:px-10">
      {/* Tabs */}
      <nav
        className="anim-fade-up mb-9 flex shrink-0 items-baseline justify-center gap-10 pb-4"
        aria-label="Seções"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tabHref(tab.id)}
              className="cursor-pointer border-b-2 px-0.5 py-1 text-[18px] font-semibold tracking-[0.01em] transition-[color,border-color] duration-150"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                color: active
                  ? 'var(--color-accent)'
                  : 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                borderBottomColor: active ? 'var(--color-accent)' : 'transparent',
                background: 'transparent',
                textDecoration: 'none',
              }}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === 'projects' && (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)]">
          {/* Prompt panel */}
          <section
            className="anim-fade-up relative mb-[52px] flex shrink-0 flex-col gap-4"
            style={{
              animationDelay: '0.05s',
              minHeight: !aiConfigured && settingsLoaded ? 280 : undefined,
            }}
          >
            {!aiConfigured && settingsLoaded && (
              <div
                className="anim-fade-in absolute inset-0 z-10 flex items-center justify-center px-6 py-8"
                style={{
                  background:
                    'color-mix(in srgb, var(--color-bg) 88%, transparent)',
                }}
              >
                <div className="w-full max-w-[460px] border border-[var(--color-divider)] bg-[var(--color-bg)] px-8 py-7 text-center shadow-[var(--shadow-md)]">
                  <p className="chk mb-4">IA não configurada</p>
                  <p
                    className="mx-auto m-0 max-w-[34ch] text-[15px] leading-relaxed"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'color-mix(in srgb, var(--color-text) 78%, transparent)',
                    }}
                  >
                    Configure o provedor, modelo e API token em Settings antes de
                    usar o assistente de IA.
                  </p>
                  <Link href={tabHref('settings')} className="btn btn-primary mt-6">
                    Ir para Settings
                  </Link>
                </div>
              </div>
            )}

            <div
              className="flex flex-col gap-4"
              style={
                !aiConfigured && settingsLoaded
                  ? { opacity: 0.35, pointerEvents: 'none' }
                  : undefined
              }
              aria-hidden={!aiConfigured && settingsLoaded}
            >
              <div className="relative mx-auto w-1/2">
                <input
                  className="input input-ai w-full text-base"
                  style={{
                    minHeight: 50,
                    fontSize: 16,
                    paddingRight: prompt.trim() ? 52 : undefined,
                  }}
                  placeholder="Descreva a tarefa ou faça uma pergunta ao agente…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSend();
                  }}
                  disabled={!aiConfigured || aiLoading}
                />
                {prompt.trim() ? (
                  <button
                    type="button"
                    className="btn btn-primary anim-fade-in absolute top-1/2 right-1.5 -translate-y-1/2"
                    style={{ width: 38, minHeight: 38, padding: 0 }}
                    aria-label="Enviar"
                    onClick={() => void handleSend()}
                    disabled={!aiConfigured || aiLoading}
                  >
                    <IconSend />
                  </button>
                ) : null}
              </div>
              {lastQuestion && (aiLoading || aiReply || aiError) ? (
                <div className="anim-fade-in min-h-[150px] border border-[var(--color-divider)] p-5">
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <p
                      className="m-0 flex-1 text-[14px] leading-relaxed italic"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'color-mix(in srgb, var(--color-text) 68%, transparent)',
                      }}
                    >
                      {lastQuestion}
                    </p>
                    <button
                      type="button"
                      className="btn shrink-0"
                      style={{ width: 36, minHeight: 36, padding: 0, border: 'none' }}
                      onClick={() => void handleResend()}
                      disabled={!aiConfigured || aiLoading}
                      aria-label="Reenviar"
                    >
                      <IconRefresh />
                    </button>
                  </div>

                  {aiLoading ? (
                    <>
                      <div className="chk mb-3.5">Consultando os projetos…</div>
                      <AiResponseSkeleton />
                    </>
                  ) : null}

                  {!aiLoading && aiError ? (
                    <div
                      className="text-[14px]"
                      style={{
                        background: 'var(--color-accent-100)',
                        color: 'var(--color-accent-800)',
                        fontFamily: 'var(--font-body)',
                      }}
                      role="alert"
                    >
                      {aiError}
                    </div>
                  ) : null}

                  {!aiLoading && aiReply ? (
                    <>
                      <div className="chk mb-3.5">Resposta</div>
                      <p
                        className="m-0 text-[15px] leading-relaxed"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {aiReply}
                      </p>
                      {referencedProject ? (
                        <p
                          className="anim-fade-in m-0 mt-4 border-t border-[var(--color-divider)] pt-4 text-[14px]"
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          Projeto referenciado:{' '}
                          <strong>{referencedProject.name}</strong>
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {/* Projects header + controls */}
          <div
            className="anim-fade-up mb-1.5 flex min-h-10 shrink-0 items-start gap-5"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex flex-1 items-center gap-4 pt-2">
              <span className="chk">Projects</span>
              <span className="h-px flex-1 bg-[var(--color-divider)]" />
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  className="fbtn"
                  onClick={() => setAddOpen(true)}
                  aria-label="Criar novo projeto"
                >
                  <IconPlus size={15} />
                  Novo projeto
                </button>

                <div
                  className="fbtn transition-[width] duration-[220ms]"
                  style={{
                    width: searchOpen ? 300 : undefined,
                    background: searchOpen ? 'var(--color-accent-100)' : 'transparent',
                    borderColor: searchOpen ? 'var(--color-accent)' : 'var(--color-divider)',
                    color: searchOpen ? 'var(--color-accent-700)' : 'var(--color-text)',
                  }}
                  onClick={() => setSearchOpen(true)}
                >
                  <IconSearch />
                  {searchOpen ? (
                    <input
                      autoFocus
                      className="min-w-0 flex-1 border-0 bg-transparent text-[13px] italic outline-none"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text)',
                      }}
                      placeholder="buscar por nome do projeto…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => {
                        if (!searchQuery) setSearchOpen(false);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span>Buscar</span>
                  )}
                </div>

                <button
                  type="button"
                  className="fbtn"
                  onClick={() => {
                    setFilterOpen((o) => !o);
                    setSortOpen(false);
                  }}
                  style={{
                    background: filterOpen ? 'var(--color-accent-100)' : 'transparent',
                    borderColor: filterOpen ? 'var(--color-accent)' : 'var(--color-divider)',
                    color: filterOpen ? 'var(--color-accent-700)' : 'var(--color-text)',
                  }}
                >
                  <IconFilter />
                  Filtro
                </button>

                <button
                  type="button"
                  className="fbtn"
                  onClick={() => {
                    setSortOpen((o) => !o);
                    setFilterOpen(false);
                  }}
                  style={{
                    background: sortOpen ? 'var(--color-accent-100)' : 'transparent',
                    borderColor: sortOpen ? 'var(--color-accent)' : 'var(--color-divider)',
                    color: sortOpen ? 'var(--color-accent-700)' : 'var(--color-text)',
                  }}
                >
                  <IconSort />
                  Ordenar
                </button>
              </div>

              {filterOpen && (
                <div className="anim-fade-in flex flex-wrap items-center justify-end gap-2">
                  <span
                    className="text-[12px] italic"
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
                    }}
                  >
                    Cliente:
                  </span>
                  {clients.map((client) => {
                    const active = selectedClients.includes(client);
                    return (
                      <button
                        key={client}
                        type="button"
                        className={active ? 'tag tag-accent' : 'tag tag-outline'}
                        onClick={() => toggleClient(client)}
                      >
                        {client}
                        {active ? ' ✓' : ''}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="tag tag-neutral"
                    onClick={() => setSelectedClients([])}
                  >
                    todos
                  </button>
                </div>
              )}

              {sortOpen && (
                <div className="anim-fade-in flex flex-wrap justify-end gap-2">
                  {SORT_OPTIONS.map((opt) => {
                    const active = (sortBy ?? DEFAULT_SORT) === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={active ? 'tag tag-accent' : 'tag tag-outline'}
                        onClick={() => setSortBy(opt.id)}
                      >
                        {opt.label}
                        {active ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Project cards */}
          <div className="pcards">
            {filteredProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                onExpand={setSelectedProject}
                onAiUpdated={handleAiSummaryUpdated}
              />
            ))}
          </div>

          {loadingProjects && (
            <p
              className="mt-2 text-[12px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
              }}
            >
              Carregando projetos…
            </p>
          )}

          <AddProjectModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onCreated={handleProjectCreated}
            projectsFolder={projectsFolder}
          />

          <ProjectDetailModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            onUpdated={handleProjectUpdated}
            onDeleted={handleProjectDeleted}
          />
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
          <section
            className="anim-fade-up relative mb-[52px] flex shrink-0 flex-col gap-4"
            style={{ animationDelay: '0.05s' }}
          >
            <div className="relative mx-auto w-1/2">
              <span
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
                style={{ color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }}
              >
                <IconSearch />
              </span>
              <input
                className="input input-ai w-full text-base"
                style={{
                  minHeight: 50,
                  fontSize: 16,
                  paddingLeft: 44,
                }}
                placeholder="buscar por nome do prompt…"
                value={agentSearchQuery}
                onChange={(e) => setAgentSearchQuery(e.target.value)}
              />
            </div>
          </section>

          <div className="acards">
            {filteredAgents.map((agent, index) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                index={index}
                pinned={pinnedAgentIds.includes(agent.id)}
                onOpen={setSelectedAgent}
                onTogglePin={togglePinAgent}
              />
            ))}

            <button
              type="button"
              className="agent-card anim-fade-up flex cursor-pointer items-center justify-center border border-dashed border-[var(--color-neutral-400)] text-[var(--color-neutral-500)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              style={{ animationDelay: `${0.08 + filteredAgents.length * 0.06}s` }}
              aria-label="Adicionar prompt"
              onClick={() => setAddAgentOpen(true)}
            >
              <IconPlus />
            </button>
          </div>

          {loadingAgents && (
            <p
              className="mt-2 text-[12px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
              }}
            >
              Carregando prompts…
            </p>
          )}

          {!loadingAgents && filteredAgents.length === 0 && (
            <p
              className="mt-4 text-center text-[14px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              Nenhum prompt encontrado. Clique em + para criar o primeiro.
            </p>
          )}

          <AddAgentModal
            open={addAgentOpen}
            onClose={() => setAddAgentOpen(false)}
            onCreated={handleAgentCreated}
            agentsFolder={agentsFolder}
          />

          <AgentDetailModal
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
            onUpdated={handleAgentUpdated}
            onDeleted={handleAgentDeleted}
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <SettingsPanel onSettingsChange={handleSettingsChange} />
      )}
    </div>
  );
}
