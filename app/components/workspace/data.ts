export type ChecklistItem = {
  label: string;
  done: boolean;
  date: string;
};

import { normalizeCheckpoints, type Checkpoint } from '@/app/lib/checkpoints';

export type { Checkpoint };
export { normalizeCheckpoints };

export type ProjectSource = 'local' | 'local_repo' | 'github';

export type Project = {
  id: string;
  name: string;
  repo: string;
  client: string;
  ai: string;
  topDate: string;
  checkpoints: Checkpoint[];
  checklist: ChecklistItem[];
  lastInteractionDays: number;
  openDemands: number;
  sourceType?: ProjectSource;
  githubRepoUrl?: string | null;
  githubBranch?: string | null;
  githubFilePath?: string | null;
  localFilePath?: string | null;
  localRepoPath?: string | null;
  localRepoBranch?: string | null;
  localRepoCheckedOutBranch?: string | null;
  specProjectId?: string | null;
  specChecklistPath?: string | null;
  tasksPath?: string | null;
  hasGithubPat?: boolean;
  lastSyncedAt?: string | null;
};

export function resolveGithubHref(
  project: Pick<Project, 'githubRepoUrl' | 'sourceType' | 'repo'>,
): string | null {
  const configured = project.githubRepoUrl?.trim();
  if (configured) return configured;
  if (project.sourceType !== 'github') return null;
  const repo = project.repo?.trim();
  if (!repo || repo === '—') return null;
  if (/^https?:\/\//i.test(repo)) return repo;
  return `https://${repo.replace(/^\/+/, '')}`;
}

/** Maps API project (+ json_data) into the card shape used by the dashboard. */
export function mapApiProjectToCard(api: {
  id: string | number;
  name: string;
  source_type: ProjectSource;
  json_data: Record<string, unknown>;
  local_file_path?: string | null;
  local_path?: string | null;
  local_path_relative?: string | null;
  local_repo_branch?: string | null;
  local_repo_checked_out_branch?: string | null;
  github_repo_url?: string | null;
  github_branch?: string | null;
  github_file_path?: string | null;
  spec_project_id?: string | null;
  spec_checklist_path?: string | null;
  tasks_path?: string | null;
  has_github_pat?: boolean;
  last_synced_at?: string | null;
}): Project {
  const data = api.json_data ?? {};
  const checklist: ChecklistItem[] = [];

  const checkpoints = normalizeCheckpoints(data.checkpoints, String(data.topDate ?? ''));

  const repoFromGithub = api.github_repo_url
    ? api.github_repo_url.replace(/^https?:\/\//, '').replace(/\.git$/, '')
    : null;

  const repoFromLocal =
    api.local_path_relative && api.local_path_relative.trim()
      ? api.local_path_relative.trim()
      : api.local_path && api.local_path.trim()
        ? api.local_path.trim()
        : null;

  const repoFromData =
    typeof data.repo === 'string' && data.repo.trim() ? data.repo.trim() : null;

  const repoLabel =
    api.source_type === 'local'
      ? '—'
      : repoFromLocal ?? repoFromGithub ?? repoFromData ?? '—';

  return {
    id: String(api.id),
    name: String(data.name ?? api.name),
    repo: repoLabel,
    client: String(data.client ?? '—'),
    ai: String(data.ai ?? 'Sem resumo ainda…'),
    topDate: String(data.topDate ?? '—'),
    checkpoints,
    checklist,
    lastInteractionDays: Number(data.lastInteractionDays ?? 0),
    openDemands: Number(data.openDemands ?? 0),
    sourceType: api.source_type,
    githubRepoUrl: api.github_repo_url ?? null,
    githubBranch: api.github_branch ?? null,
    githubFilePath: api.github_file_path ?? null,
    localFilePath: api.local_file_path ?? null,
    localRepoPath: api.local_path ?? null,
    localRepoBranch: api.local_repo_branch ?? null,
    localRepoCheckedOutBranch: api.local_repo_checked_out_branch ?? null,
    specProjectId: api.spec_project_id ?? null,
    specChecklistPath: api.spec_checklist_path ?? null,
    tasksPath: api.tasks_path ?? null,
    hasGithubPat: api.has_github_pat ?? false,
    lastSyncedAt: api.last_synced_at ?? null,
  };
}

export type TabId = 'projects' | 'prompts' | 'settings';

export const TABS: { id: TabId; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'settings', label: 'Settings' },
];

export function tabHref(tabId: TabId): string {
  return `/${tabId}`;
}

export const CLIENTS = ['Acme', 'Globex', 'Umbrella', 'Initech'] as const;

export const SORT_OPTIONS = [
  { id: 'checkpoint', label: 'Checkpoint mais recente' },
  { id: 'idle', label: 'Mais tempo sem interação' },
  { id: 'demands', label: 'Mais demandas' },
  { id: 'recent', label: 'Recentes' },
] as const;

export type SortId = (typeof SORT_OPTIONS)[number]['id'];

export const DEFAULT_SORT: SortId = 'checkpoint';

export type Agent = {
  id: string;
  name: string;
  content: string;
  excerpt: string;
  localFilePath: string | null;
  updatedAt: string | null;
};

export type AgentApiResponse = {
  id: string;
  name: string;
  content: string;
  local_file_path: string;
  created_at: string | null;
  updated_at: string | null;
};

export function extractAgentExcerpt(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    return trimmed.replace(/^[#>*\-\s]+/, '').slice(0, 160);
  }
  return 'Sem descrição ainda…';
}

export function mapApiAgentToCard(api: AgentApiResponse): Agent {
  return {
    id: api.id,
    name: api.name,
    content: api.content,
    excerpt: extractAgentExcerpt(api.content),
    localFilePath: api.local_file_path ?? null,
    updatedAt: api.updated_at ?? null,
  };
}

function mkChecklist(
  labels: string[],
  doneCount: number,
  dates: string[],
): ChecklistItem[] {
  return labels.map((label, i) => ({
    label,
    done: i < doneCount,
    date: i < doneCount ? dates[i] : '—',
  }));
}

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'acme-api',
    name: 'Acme API',
    repo: 'github.com/acme/api',
    client: 'Acme',
    ai: 'Recomenda revisar o deploy pendente na branch main…',
    topDate: '25/07',
    checkpoints: [
      {
        date: '25/07',
        title: 'Deploy da v2.1 em staging',
        summary: 'Deploy da v2.1 em staging com auth refresh e rate limiting validados.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '23/07',
        title: 'Review de PRs pendentes',
        summary: 'Dois PRs críticos revisados e mergeados na main.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '20/07',
        title: 'Alinhamento com cliente sobre webhooks',
        summary: 'Escopo de webhooks v2 fechado com o cliente.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '18/07',
        title: 'Kickoff da migração Postgres',
        summary: 'Planejamento inicial da migração para Postgres 16.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
    ],
    checklist: mkChecklist(
      ['Auth refresh token', 'Rate limiting', 'Webhooks v2', 'Migração Postgres 16', 'Docs OpenAPI'],
      3,
      ['25/07', '23/07', '20/07'],
    ),
    lastInteractionDays: 0,
    openDemands: 2,
  },
  {
    id: 'globex-web',
    name: 'Globex Web',
    repo: 'github.com/globex/web',
    client: 'Globex',
    ai: '2 PRs aguardando review há 3 dias…',
    topDate: '24/07',
    checkpoints: [
      {
        date: '24/07',
        title: 'Dark mode mergeado na main',
        summary: 'Tema escuro disponível em todas as páginas principais.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '22/07',
        title: 'Testes A/B do hero',
        summary: 'Experimento A/B do hero iniciado com duas variantes.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '19/07',
        title: 'Refatoração do checkout',
        summary: 'Checkout refatorado para reduzir abandono de carrinho.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '15/07',
        title: 'Sprint planning Q3',
        summary: 'Prioridades do Q3 definidas com o time de produto.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
    ],
    checklist: mkChecklist(
      ['Refatorar checkout', 'Dark mode', 'A/B do hero', 'Lighthouse 90+', 'Remover jQuery legado'],
      2,
      ['24/07', '22/07'],
    ),
    lastInteractionDays: 3,
    openDemands: 2,
  },
  {
    id: 'umbrella-app',
    name: 'Umbrella App',
    repo: 'github.com/umbrella/app',
    client: 'Umbrella',
    ai: '3 demandas abertas sem resposta do cliente…',
    topDate: '21/07',
    checkpoints: [
      {
        date: '21/07',
        title: 'Push notifications em beta',
        summary: 'Notificações push liberadas para grupo beta no iOS.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '17/07',
        title: 'Correção crash iOS 17',
        summary: 'Crash em cold start no iOS 17 corrigido.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '14/07',
        title: 'Onboarding redesenhado',
        summary: 'Novo fluxo de onboarding com menos etapas.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
    ],
    checklist: mkChecklist(
      ['Push notifications', 'Fluxo de onboarding', 'Crash em iOS 17', 'Eventos de analytics'],
      3,
      ['21/07', '17/07', '14/07'],
    ),
    lastInteractionDays: 6,
    openDemands: 3,
  },
  {
    id: 'initech-cli',
    name: 'Initech CLI',
    repo: 'github.com/initech/cli',
    client: 'Initech',
    ai: 'Sem interação há 12 dias — considerar arquivar…',
    topDate: '12/07',
    checkpoints: [
      {
        date: '12/07',
        title: 'Autocomplete zsh entregue',
        summary: 'Autocomplete para zsh publicado na v0.4.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
      {
        date: '08/07',
        title: 'Config schema v1 publicada',
        summary: 'Schema de configuração v1 documentado e validado.',
        description: '',
        atas: [],
        summaryUpdatedAt: null,
      },
    ],
    checklist: mkChecklist(
      ['Autocomplete zsh', 'Config schema', 'Binário Windows', 'Testes e2e'],
      1,
      ['12/07'],
    ),
    lastInteractionDays: 12,
    openDemands: 1,
  },
];
