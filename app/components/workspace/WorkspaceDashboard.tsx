'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import ProjectAiChatPanel from './ProjectAiChatPanel';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspaceNavSidebar from './WorkspaceNavSidebar';
import { WorkspaceGradientDefs } from './WorkspaceGradientDefs';
import ProjectAiSummary from './ProjectAiSummary';
import AddProjectModal, { type ProjectApiResponse } from './AddProjectModal';
import AddAgentModal from './AddAgentModal';
import AgentCard from './AgentCard';
import AgentDetailModal from './AgentDetailModal';
import ProjectDetailModal from './ProjectDetailModal';
import RepoBadge, { RepoHueContext, buildRepoHueMap, useRepoBadgeStyle } from './RepoBadge';
import ProjectsTableView from './ProjectsTableView';
import SettingsPanel, { isAiConfigured, type WorkspaceSettings } from './SettingsPanel';
import {
  readPinnedPromptIds,
  writePinnedPromptIds,
} from '@/app/lib/pinned-prompts';
import { cn } from '@/app/lib/utils';
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  mapApiAgentToCard,
  mapApiProjectToCard,
  resolveGithubHref,
  type Agent,
  type AgentApiResponse,
  type Project,
  type SortId,
  type TabId,
} from './data';
import {
  getCheckpointDisplayDateTime,
  latestCheckpointSortKey,
  type Checkpoint,
} from '@/app/lib/checkpoints';

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

function IconKanban() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="12" rx="1" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
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

const checkpointTimeMutedStyle = {
  fontFamily: 'var(--font-body)',
  color: 'color-mix(in srgb, var(--color-text) 45%, transparent)',
} as const;

function CheckpointCardDateRow({
  checkpoint,
  fallbackDate = '',
  dateClassName,
  dateStyle,
}: {
  checkpoint: Checkpoint;
  fallbackDate?: string;
  dateClassName: string;
  dateStyle?: CSSProperties;
}) {
  const { date, time } = getCheckpointDisplayDateTime(checkpoint, fallbackDate);

  return (
    <div className="flex w-full items-baseline gap-2">
      <span
        className={dateClassName}
        style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, ...dateStyle }}
      >
        {date || '—'}
      </span>
      {time ? (
        <span className="num text-[11px] leading-none" style={checkpointTimeMutedStyle}>
          {time}
        </span>
      ) : null}
    </div>
  );
}

function ProjectCard({
  project,
  index,
  onExpand,
}: {
  project: Project;
  index: number;
  onExpand?: (project: Project) => void;
}) {
  const githubHref = resolveGithubHref(project);
  const repoBranch =
    project.sourceType === 'github' && githubHref
      ? project.githubBranch?.trim() || 'main'
      : project.sourceType === 'local_repo'
        ? project.localRepoBranch?.trim() || 'main'
        : null;
  const repoTitle =
    repoBranch && project.repo !== '—'
      ? `${project.repo}:${repoBranch}`
      : project.repo;
  const hasRepo = project.repo !== '—';
  const repoBadgeStyle = useRepoBadgeStyle(project.repo);
  const repoBadge =
    hasRepo ? (
      <RepoBadge repo={project.repo} title={repoTitle} className="mt-2" />
    ) : null;

  const openProject = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => {
    onExpand?.(project);
    event.currentTarget.blur();
  };

  return (
    <article
      id={`project-card-${project.id}`}
      className="project-card group relative anim-fade-up flex w-[330px] flex-none cursor-pointer flex-col gap-[18px] border border-[var(--color-divider)] px-[22px] py-6"
      style={{
        animationDelay: `${0.08 + index * 0.06}s`,
        ...(hasRepo
          ? {
              ...repoBadgeStyle,
              borderTopWidth: 2,
              borderTopColor:
                'hsl(calc(var(--repo-badge-hue) * 1deg) 48% 48% / 0.72)',
            }
          : {}),
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${project.name}`}
      onClick={openProject}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProject(event);
        }
      }}
    >
      <header className="border-b border-[var(--color-divider)] pb-4 text-center">
        <h3
          className="font-[family-name:var(--font-heading)] text-[27px] font-semibold leading-[1.1] tracking-[0.01em]"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
        >
          {project.name}
        </h3>
        {githubHref && repoBadge ? (
          <a
            href={githubHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex justify-center transition-opacity hover:opacity-80"
            onClick={(event) => event.stopPropagation()}
          >
            {repoBadge}
          </a>
        ) : (
          repoBadge
        )}
      </header>

      <div className="flex flex-col gap-5">
        <ProjectAiSummary summary={project.ai} />

        {project.checkpoints.map((checkpoint, i) => (
          <div
            key={`${project.id}-cp-${i}-${checkpoint.date}-${checkpoint.title}`}
            className="flex flex-col items-start gap-1"
          >
            <CheckpointCardDateRow
              checkpoint={checkpoint}
              fallbackDate={i === 0 ? project.topDate : undefined}
              dateClassName={
                i === 0
                  ? 'num text-[30px] leading-none text-[var(--color-accent-700)]'
                  : 'num text-[18px] leading-none'
              }
              dateStyle={
                i === 0
                  ? undefined
                  : { color: 'color-mix(in srgb, var(--color-text) 62%, transparent)' }
              }
            />
            <span
              className={cn(
                'mt-2 line-clamp-5 w-full min-w-0 text-left text-[12px] leading-snug',
                i === 0 && 'italic',
              )}
              style={{
                fontFamily: 'var(--font-body)',
                color:
                  i === 0
                    ? 'color-mix(in srgb, var(--color-text) 55%, transparent)'
                    : 'color-mix(in srgb, var(--color-text) 45%, transparent)',
              }}
            >
              {checkpoint.summary || checkpoint.title || 'checkpoint resume'}
            </span>
          </div>
        ))}
      </div>

      <div>
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortId | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [groupByRepo, setGroupByRepo] = useState(false);
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

  const repos = useMemo(() => {
    const set = new Set(
      projects.map((p) => p.repo).filter((r) => r && r !== '—'),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const repoHueMap = useMemo(() => buildRepoHueMap(repos), [repos]);

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

    if (selectedRepo) {
      list = list.filter((p) => p.repo === selectedRepo);
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
  }, [projects, searchQuery, selectedClients, selectedRepo, sortBy]);

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

  const toggleRepo = (repo: string) => {
    setSelectedRepo((prev) => (prev === repo ? null : repo));
  };

  const [navOpen, setNavOpen] = useState(false);

  const scrollToProject = useCallback((projectId: string) => {
    requestAnimationFrame(() => {
      if (viewMode === 'table') {
        document
          .getElementById(`project-table-group-${projectId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      const card = document.getElementById(`project-card-${projectId}`);
      const scroller = card?.closest('.pcards');
      if (!(card instanceof HTMLElement) || !(scroller instanceof HTMLElement)) {
        return;
      }

      const containerRect = scroller.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const delta =
        cardRect.left +
        cardRect.width / 2 -
        (containerRect.left + containerRect.width / 2);

      scroller.scrollTo({
        left: scroller.scrollLeft + delta,
        behavior: 'smooth',
      });
    });
  }, [viewMode]);

  return (
    <div className="workspace-shell flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <WorkspaceGradientDefs />
      <WorkspaceNavSidebar
        activeTab={activeTab}
        open={navOpen}
        onOpenChange={setNavOpen}
      />

      <WorkspaceHeader open={navOpen} onOpenChange={setNavOpen} />

      <div className="workspace-app-shell flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-[88px] pt-6 md:px-10">
      {activeTab === 'projects' && (
        <RepoHueContext.Provider value={repoHueMap}>
        <div className="flex flex-col">
          {/* Projects header + controls */}
          <div
            className="anim-fade-up mb-1.5 flex shrink-0 flex-col gap-3"
            style={{ animationDelay: '0.05s' }}
          >
            <div className="flex min-h-10 flex-wrap items-center gap-3 pt-2">
              <span className="chk shrink-0">Projects</span>

              <div className="projects-view-toggle shrink-0">
                <button
                  type="button"
                  className="fbtn"
                  aria-pressed={viewMode === 'kanban'}
                  onClick={() => setViewMode('kanban')}
                  style={{
                    background: viewMode === 'kanban' ? 'var(--color-accent-100)' : 'transparent',
                    color: viewMode === 'kanban' ? 'var(--color-accent-700)' : 'var(--color-text)',
                  }}
                >
                  <IconKanban />
                  Kanban
                </button>
                <button
                  type="button"
                  className="fbtn"
                  aria-pressed={viewMode === 'table'}
                  onClick={() => setViewMode('table')}
                  style={{
                    background: viewMode === 'table' ? 'var(--color-accent-100)' : 'transparent',
                    color: viewMode === 'table' ? 'var(--color-accent-700)' : 'var(--color-text)',
                  }}
                >
                  <IconTable />
                  Tabela
                </button>
              </div>

              {viewMode === 'table' ? (
                <button
                  type="button"
                  className="fbtn shrink-0"
                  aria-pressed={groupByRepo}
                  onClick={() => setGroupByRepo((value) => !value)}
                  style={{
                    background: groupByRepo ? 'var(--color-accent-100)' : 'transparent',
                    borderColor: groupByRepo ? 'var(--color-accent)' : 'var(--color-divider)',
                    color: groupByRepo ? 'var(--color-accent-700)' : 'var(--color-text)',
                  }}
                >
                  <IconLayers />
                  Agrupar por repositório
                </button>
              ) : null}

              <span className="h-px min-w-8 flex-1 bg-[var(--color-divider)]" />
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
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {repos.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {repos.map((repo) => (
                      <RepoBadge
                        key={repo}
                        repo={repo}
                        active={selectedRepo === repo}
                        onClick={() => toggleRepo(repo)}
                      />
                    ))}
                  </div>
                ) : null}

                {repos.length > 0 ? (
                  <span
                    className="hidden h-5 w-px bg-[var(--color-divider)] sm:block"
                    aria-hidden
                  />
                ) : null}

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
                <div className="anim-fade-in flex flex-wrap items-center gap-2">
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
                <div className="anim-fade-in flex flex-wrap gap-2">
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

          {viewMode === 'kanban' ? (
            <div className="pcards">
              {filteredProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  onExpand={setSelectedProject}
                />
              ))}
            </div>
          ) : (
            <ProjectsTableView
              projects={filteredProjects}
              groupByRepo={groupByRepo}
              onExpand={setSelectedProject}
            />
          )}

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

          <ProjectAiChatPanel
            projects={projects}
            aiConfigured={aiConfigured}
            settingsLoaded={settingsLoaded}
            onReferencedProject={scrollToProject}
          />
        </div>
        </RepoHueContext.Provider>
      )}

      {activeTab === 'prompts' && (
        <div className="flex flex-col">
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
    </div>
  );
}
