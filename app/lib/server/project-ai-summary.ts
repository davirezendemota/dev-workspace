import { ApiError } from './api-error';
import { normalizeCheckpoints } from '@/app/lib/checkpoints';
import { completeChat } from './project-ai';
import {
  getProject,
  getProjectSpecChecklist,
  listProjects,
  readProjectMeta,
  updateProjectAiField,
  type ProjectResponse,
  type ProjectSpecChecklistResponse,
} from './projects';
import { isAiConfigured, projectAiSummaryPrompt } from './workspace-config';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_MAX_CHARS = 6000;

const EMPTY_SUMMARY_PLACEHOLDERS = new Set([
  '',
  'Sem dica do agente ainda…',
  'Sem resumo ainda…',
]);

export type RefreshSummariesResult = {
  updated: string[];
  skipped: string[];
  errors: { id: string; error: string }[];
};

export function isAiSummaryStale(
  ai: string | undefined | null,
  meta: Record<string, unknown> | null,
): boolean {
  const text = String(ai ?? '').trim();
  if (!text || EMPTY_SUMMARY_PLACEHOLDERS.has(text)) {
    return true;
  }

  const updatedAt = meta?.ai_updated_at;
  if (typeof updatedAt !== 'string' || !updatedAt.trim()) {
    return true;
  }

  const timestamp = new Date(updatedAt).getTime();
  if (Number.isNaN(timestamp)) {
    return true;
  }

  return Date.now() - timestamp > ONE_DAY_MS;
}

export async function bootstrapGithubProject(
  projectId: string,
): Promise<ProjectResponse> {
  await getProjectSpecChecklist(projectId);

  if (!isAiConfigured()) {
    const project = getProject(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }
    return project;
  }

  try {
    return await generateProjectAiSummary(projectId);
  } catch {
    const project = getProject(projectId);
    if (!project) {
      throw new ApiError(404, 'Project not found');
    }
    return project;
  }
}

export async function generateProjectAiSummary(
  projectId: string,
): Promise<ProjectResponse> {
  if (!isAiConfigured()) {
    throw new ApiError(
      400,
      'Configure o provedor, modelo e API token em Settings.',
    );
  }

  const project = getProject(projectId);
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  const checklist = await getProjectSpecChecklist(projectId);
  const context = buildSummaryContext(project, checklist);
  const systemPrompt = projectAiSummaryPrompt();

  const userPrompt = [
    'Gere um resumo atualizado para o card deste projeto.',
    'Use apenas os dados abaixo; se houver spec_checklist, considere somente as specs desse bloco projects[] resolvido.',
    '',
    context,
  ].join('\n');

  const summary = (await completeChat(systemPrompt, userPrompt)).trim();
  if (!summary) {
    throw new ApiError(502, 'A IA retornou um resumo vazio.');
  }

  const updated = updateProjectAiField(projectId, summary);
  if (!updated) {
    throw new ApiError(404, 'Project not found');
  }

  return updated;
}

export async function refreshStaleProjectSummaries(): Promise<RefreshSummariesResult> {
  const result: RefreshSummariesResult = {
    updated: [],
    skipped: [],
    errors: [],
  };

  if (!isAiConfigured()) {
    return result;
  }

  const { items } = listProjects(0, 500);

  for (const project of items) {
    const ai = typeof project.json_data.ai === 'string' ? project.json_data.ai : '';
    const meta = readProjectMeta(project.id);

    if (!isAiSummaryStale(ai, meta)) {
      result.skipped.push(project.id);
      continue;
    }

    try {
      await generateProjectAiSummary(project.id);
      result.updated.push(project.id);
    } catch (error) {
      result.errors.push({
        id: project.id,
        error: error instanceof Error ? error.message : 'Falha ao gerar resumo.',
      });
    }
  }

  return result;
}

function buildSummaryContext(
  project: ProjectResponse,
  checklist: ProjectSpecChecklistResponse | null,
): string {
  const data = project.json_data ?? {};
  const cardChecklist = Array.isArray(data.checklist) ? data.checklist : [];
  const checkpoints = normalizeCheckpoints(
    data.checkpoints,
    typeof data.topDate === 'string' ? data.topDate : undefined,
  );

  const payload: Record<string, unknown> = {
    id: project.id,
    name: project.name,
    client: data.client ?? '—',
    repo: data.repo ?? project.github_repo_url ?? '—',
    source_type: project.source_type,
    topDate: data.topDate ?? '—',
    lastInteractionDays: data.lastInteractionDays ?? 0,
    openDemands: data.openDemands ?? 0,
    checkpoints,
    checklist: cardChecklist,
  };

  if (checklist?.project_id && checklist.specs.length > 0) {
    payload.spec_checklist = {
      project_id: checklist.project_id,
      project_name: checklist.project_name,
      updated_at: checklist.updated_at,
      stats: checklist.stats,
      specs: checklist.specs.map((spec) => ({
        specId: spec.specId,
        title: spec.title,
        checklist: spec.checklist.map((item) => ({
          ac: item.ac,
          description: item.description,
          status: item.status,
        })),
      })),
    };
  }

  const serialized = JSON.stringify(payload, null, 2);
  return truncate(serialized, STATUS_MAX_CHARS);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
