import { normalizeCheckpoints, type Checkpoint } from '@/app/lib/checkpoints';
import { ApiError } from './api-error';
import { completeChat } from './project-ai';
import {
  getProject,
  getProjectSpecChecklist,
  updateProjectCheckpoints,
  type ProjectResponse,
  type ProjectSpecChecklistResponse,
} from './projects';
import { isAiConfigured } from './workspace-config';

const CONTEXT_MAX_CHARS = 6000;

const CHECKPOINT_SUMMARY_PROMPT = `Você resume um checkpoint (marco) de entrega de um projeto de software.
Use apenas os dados fornecidos. Não invente entregas, PRs ou datas.
Responda em português do Brasil, em tom direto e objetivo.
Máximo de 2 frases curtas (até ~220 caracteres no total).
Descreva o que foi entregue ou alcançado naquele marco, com base no título do checkpoint e no contexto do projeto.
Responda APENAS com o texto do resumo, sem JSON, markdown ou aspas extras.`;

export async function generateCheckpointSummary(
  projectId: string,
  index: number,
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

  const data = project.json_data ?? {};
  const checkpoints = normalizeCheckpoints(
    data.checkpoints,
    typeof data.topDate === 'string' ? data.topDate : undefined,
  );

  if (index < 0 || index >= checkpoints.length) {
    throw new ApiError(404, 'Checkpoint não encontrado.');
  }

  const checkpoint = checkpoints[index];
  const checklist = await getProjectSpecChecklist(projectId);
  const context = buildCheckpointContext(project, checklist, checkpoints, checkpoint, index);

  const userPrompt = [
    'Gere o resumo deste checkpoint do projeto.',
    '',
    context,
  ].join('\n');

  const summary = (await completeChat(CHECKPOINT_SUMMARY_PROMPT, userPrompt)).trim();
  if (!summary) {
    throw new ApiError(502, 'A IA retornou um resumo vazio.');
  }

  const nextCheckpoints = checkpoints.map((item, i) =>
    i === index
      ? {
          ...item,
          summary,
          summaryUpdatedAt: new Date().toISOString(),
        }
      : item,
  );

  const updated = updateProjectCheckpoints(projectId, nextCheckpoints);
  if (!updated) {
    throw new ApiError(404, 'Project not found');
  }

  return updated;
}

function buildCheckpointContext(
  project: ProjectResponse,
  checklist: ProjectSpecChecklistResponse | null,
  checkpoints: Checkpoint[],
  checkpoint: Checkpoint,
  index: number,
): string {
  const data = project.json_data ?? {};

  const payload: Record<string, unknown> = {
    project: {
      id: project.id,
      name: project.name,
      client: data.client ?? '—',
      repo: data.repo ?? project.github_repo_url ?? '—',
      source_type: project.source_type,
    },
    checkpoint: {
      index,
      date: checkpoint.date || null,
      title: checkpoint.title || null,
      current_summary: checkpoint.summary || null,
    },
    other_checkpoints: checkpoints
      .filter((_, i) => i !== index)
      .map((item, i) => ({
        position: i < index ? 'anterior' : 'posterior',
        date: item.date || null,
        title: item.title || null,
        summary: item.summary || null,
      })),
  };

  if (checklist?.project_id && checklist.specs.length > 0) {
    payload.spec_checklist = {
      project_id: checklist.project_id,
      stats: checklist.stats,
      specs: checklist.specs.map((spec) => ({
        specId: spec.specId,
        title: spec.title,
        checklist: spec.checklist.map((item) => ({
          ac: item.ac,
          description: item.description,
          status: item.status,
          completedAt: item.completedAt,
        })),
      })),
    };
  }

  const serialized = JSON.stringify(payload, null, 2);
  return truncate(serialized, CONTEXT_MAX_CHARS);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
