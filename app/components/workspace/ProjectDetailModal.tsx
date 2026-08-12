'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useLockBodyScroll } from '@/app/lib/use-lock-body-scroll';
import { cn } from '@/app/lib/utils';
import type { ProjectApiResponse } from './AddProjectModal';
import type { Project } from './data';
import ProjectCheckpoints from './ProjectCheckpoints';
import ProjectMilestones, { type MilestoneDraft } from './ProjectMilestones';
import ProjectPlans from './ProjectPlans';
import ProjectTasks from './ProjectTasks';
import ProjectSettingsPanel from './ProjectSettingsPanel';
import ProjectFeatures from './ProjectFeatures';
import ProjectSpecGraph from './ProjectSpecGraph';

type ProjectDetailModalProps = {
  project: Project | null;
  onClose: () => void;
  onUpdated?: (project: ProjectApiResponse) => void;
  onDeleted?: (id: string) => void;
};

type TabId =
  | 'graph'
  | 'features'
  | 'milestones'
  | 'plans'
  | 'checkpoints'
  | 'tasks'
  | 'settings';

type TabDef = {
  id: TabId;
  label: string;
};

function IconRefresh({ spinning }: { spinning?: boolean }) {
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
      className={cn('shrink-0', spinning && 'animate-spin')}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function TabIcon({ id }: { id: TabId }) {
  const props = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (id) {
    case 'graph':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="8" r="2.5" />
          <circle cx="8" cy="18" r="2.5" />
          <circle cx="17" cy="17" r="2.5" />
          <path d="M8 7.5 16 9M7.5 8.2 9.5 15.5M16.2 10.2 15.5 14.8M10.2 17.5 14.5 17.2" />
        </svg>
      );
    case 'features':
      return (
        <svg {...props}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8M8 11h8M8 15h5" />
        </svg>
      );
    case 'milestones':
      return (
        <svg {...props}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      );
    case 'plans':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
          <line x1="8" y1="9" x2="10" y2="9" />
        </svg>
      );
    case 'checkpoints':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'tasks':
      return (
        <svg {...props}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
  }
}

export default function ProjectDetailModal({ project, onClose, onUpdated, onDeleted }: ProjectDetailModalProps) {
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<TabId>('graph');
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneDraft | null>(null);
  const [featuresSpecId, setFeaturesSpecId] = useState<string | null>(null);

  useLockBodyScroll(project !== null);

  const tabs = useMemo(
    (): TabDef[] => [
      { id: 'graph', label: 'Grafo' },
      { id: 'features', label: 'Features' },
      { id: 'milestones', label: 'Milestones' },
      { id: 'plans', label: 'Planos' },
      { id: 'checkpoints', label: 'Checkpoints' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'settings', label: 'Settings' },
    ],
    [],
  );

  const handleOpenSpecFromGraph = useCallback((specId: string) => {
    setFeaturesSpecId(specId);
    setActiveTab('features');
  }, []);

  const consumeFeaturesSpecId = useCallback(() => {
    setFeaturesSpecId(null);
  }, []);

  const consumeMilestoneDraft = useCallback(() => {
    setMilestoneDraft(null);
  }, []);

  const handlePlanMilestone = useCallback((draft: { title: string; description: string }) => {
    setMilestoneDraft({
      title: draft.title,
      description: draft.description,
    });
    setActiveTab('milestones');
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing || !project) return;

    setRefreshing(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, { cache: 'no-store' });
      if (!response.ok) return;

      const data: ProjectApiResponse = await response.json();
      onUpdated?.(data);
      setDataRefreshKey((key) => key + 1);
      setTasksRefreshKey((key) => key + 1);
    } catch {
      /* keep current data */
    } finally {
      setRefreshing(false);
    }
  }, [onUpdated, project, refreshing]);

  useEffect(() => {
    if (!project) return;
    setActiveTab('graph');
    setTasksRefreshKey((key) => key + 1);
    setDataRefreshKey((key) => key + 1);
    setMilestoneDraft(null);
    setFeaturesSpecId(null);
  }, [project?.id]);

  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, onClose]);

  if (!project) return null;

  const mountTasks = activeTab === 'tasks' || project.sourceType === 'github';

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer border-0 backdrop-blur-[6px]"
        style={{ background: 'color-mix(in srgb, var(--color-text) 28%, transparent)' }}
        aria-label="Fechar"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-fade-up relative z-10 flex h-[min(92vh,900px)] w-full max-w-[min(96vw,1180px)] flex-col border border-[var(--color-divider)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
      >
        <header className="flex flex-none items-center justify-between gap-3 border-b border-[var(--color-divider)] px-5 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <h2
              id={titleId}
              className="min-w-0 truncate text-[1.25rem] font-semibold leading-tight sm:text-[1.375rem]"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
            >
              {project.name}
            </h2>
            <span
              className="shrink-0 font-mono text-[12px]"
              style={{
                color: 'color-mix(in srgb, var(--color-text) 50%, transparent)',
              }}
            >
              {project.specProjectId ?? project.id}
            </span>
          </div>
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              className="btn flex-none"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              aria-label="Atualizar projeto"
              title="Atualizar projeto"
            >
              <IconRefresh spinning={refreshing} />
            </button>
            <button
              type="button"
              className="btn flex-none"
              onClick={onClose}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </header>

        <nav
          className="flex flex-none gap-1 border-b border-[var(--color-divider)] px-5 sm:px-6"
          aria-label="Abas do projeto"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  'relative flex items-center gap-2 px-3 py-2.5 text-[13px] transition-colors',
                  active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]',
                )}
                style={{ fontFamily: 'var(--font-heading)' }}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
              >
                <TabIcon id={tab.id} />
                {tab.label}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-accent)]" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div
          className={cn(
            'min-h-0 flex-1 px-5 py-4 sm:px-6 sm:py-5',
            activeTab === 'features' || activeTab === 'graph'
              ? 'flex flex-col overflow-hidden'
              : 'overflow-y-auto',
          )}
        >
          {activeTab === 'graph' ? (
            <div key={dataRefreshKey} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ProjectSpecGraph project={project} onOpenSpec={handleOpenSpecFromGraph} />
            </div>
          ) : null}
          {activeTab === 'features' ? (
            <div key={dataRefreshKey} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ProjectFeatures
                project={project}
                initialSpecId={featuresSpecId}
                onInitialSpecConsumed={consumeFeaturesSpecId}
              />
            </div>
          ) : null}
          {activeTab === 'milestones' ? (
            <ProjectMilestones
              key={dataRefreshKey}
              project={project}
              draft={milestoneDraft}
              onDraftConsumed={consumeMilestoneDraft}
            />
          ) : null}
          {activeTab === 'plans' ? <ProjectPlans key={dataRefreshKey} project={project} /> : null}
          {activeTab === 'checkpoints' ? (
            <ProjectCheckpoints
              key={dataRefreshKey}
              project={project}
              onUpdated={(updated) => onUpdated?.(updated)}
              onPlanMilestone={handlePlanMilestone}
            />
          ) : null}
          {mountTasks ? (
            <div
              key={dataRefreshKey}
              className={activeTab === 'tasks' ? undefined : 'hidden'}
              aria-hidden={activeTab !== 'tasks'}
            >
              <ProjectTasks project={project} refreshKey={tasksRefreshKey} />
            </div>
          ) : null}
          {activeTab === 'settings' ? (
            <ProjectSettingsPanel
              key={dataRefreshKey}
              project={project}
              onUpdated={(updated) => onUpdated?.(updated)}
              onDeleted={(id) => onDeleted?.(id)}
              onClose={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
