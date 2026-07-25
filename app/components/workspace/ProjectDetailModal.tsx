'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { cn } from '@/app/lib/utils';
import type { ProjectApiResponse } from './AddProjectModal';
import type { Project } from './data';
import ProjectTasks from './ProjectTasks';
import ProjectSettingsPanel from './ProjectSettingsPanel';
import ProjectSpecChecklist from './ProjectSpecChecklist';

type ProjectDetailModalProps = {
  project: Project | null;
  onClose: () => void;
  onUpdated?: (project: ProjectApiResponse) => void;
};

type TabId = 'spec-checklist' | 'tasks' | 'settings';

export default function ProjectDetailModal({ project, onClose, onUpdated }: ProjectDetailModalProps) {
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<TabId>('spec-checklist');
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);

  const tabs = useMemo(
    (): { id: TabId; label: string }[] => [
      { id: 'spec-checklist', label: 'Spec checklist' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'settings', label: 'Settings' },
    ],
    [],
  );

  useEffect(() => {
    if (!project) return;
    setActiveTab('spec-checklist');
    setTasksRefreshKey((key) => key + 1);
  }, [project]);

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
        className="anim-fade-up relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-[min(96vw,1180px)] flex-col border border-[var(--color-divider)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[var(--color-divider)] px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="chk mb-2">Projeto</p>
            <h2
              id={titleId}
              className="truncate text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}
            >
              {project.name}
            </h2>
            <p
              className="mt-1.5 truncate text-[13px] italic"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
              }}
            >
              {project.repo}
            </p>
          </div>
          <button
            type="button"
            className="btn flex-none"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <nav
          className="flex flex-none gap-1 border-b border-[var(--color-divider)] px-6 sm:px-8"
          aria-label="Abas do projeto"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  'relative px-4 py-3 text-[13px] transition-colors',
                  active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]',
                )}
                style={{ fontFamily: 'var(--font-heading)' }}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
              >
                {tab.label}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-accent)]" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
          {activeTab === 'spec-checklist' ? <ProjectSpecChecklist project={project} /> : null}
          {mountTasks ? (
            <div className={activeTab === 'tasks' ? undefined : 'hidden'} aria-hidden={activeTab !== 'tasks'}>
              <ProjectTasks project={project} refreshKey={tasksRefreshKey} />
            </div>
          ) : null}
          {activeTab === 'settings' ? (
            <ProjectSettingsPanel
              project={project}
              onUpdated={(updated) => onUpdated?.(updated)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
