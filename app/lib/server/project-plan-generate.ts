import type { Milestone } from '@/app/lib/milestones';
import {
  formatPlanBody,
  formatPlanTitle,
  nextPlanCode,
  normalizePlanNameInput,
  type Plan,
  type PlanStep,
} from '@/app/lib/plans';
import { ApiError } from './api-error';
import { completeChat } from './project-ai';
import {
  getProjectFeatureContent,
  getProjectMilestones,
  getProjectPlans,
  getProjectSpecChecklist,
  addProjectPlan,
  type ProjectPlansDocument,
  type ProjectSpecChecklistResponse,
} from './projects';
import { isAiConfigured } from './workspace-config';

const CONTEXT_MAX_CHARS = 12000;

const PLAN_GENERATE_PROMPT = `Você cria planos de implementação para milestones de software.
Use apenas os dados fornecidos (milestone, specs vinculadas, checklist e trechos de markdown).
Não invente funcionalidades fora do escopo das specs.
Respeite dependências before/after do checklist quando existirem.
Ordene os passos de forma lógica para implementação incremental.
O plano gerado será cadastrado automaticamente no Dev Workspace do projeto (lista plans vinculada à milestone), cada um com um id único para referência no agent-cli.
Após aprovação humana em fluxos manuais, o agente deve persistir o plano via PUT /api/projects/{id}/plans no projeto respectivo — nunca deixar só no chat; incluir id único no payload e comunicar esse id ao usuário.
Tasks do Dev Workspace são somente leitura para agentes: não incluir passos de atualizar tasks via API.
Responda em português do Brasil.
Responda APENAS com JSON válido no formato:
{
  "name": "nome curto do plano (sem prefixo PXXX)",
  "items": [
    {
      "title": "Título do passo",
      "description": "O que fazer neste passo",
      "specRef": { "specId": "004", "ac": "AC1" },
      "dependsOnTitles": ["Título de passo anterior se houver dependência"]
    }
  ]
}
Regras:
- O título final no DW será atribuído automaticamente como PXXX - {name} (próximo código disponível)
- name: apenas o nome descritivo, sem "Plano —" nem "P001 -"
- specRef é opcional mas preferível quando o passo cobre um AC específico
- ac deve ser AC1, AC2, etc.
- dependsOnTitles referencia títulos de outros passos nesta mesma lista (não ids)
- Entre 3 e 20 passos
- Passos devem ser acionáveis por um desenvolvedor ou agente de IA`;

type GeneratePlanInput = {
  projectId: string;
  milestoneId: string;
};

type AiPlanStep = {
  title?: string;
  description?: string;
  specRef?: { specId?: string; ac?: string };
  dependsOnTitles?: string[];
};

type AiPlanResponse = {
  name?: string;
  title?: string;
  items?: AiPlanStep[];
};

export async function generateProjectPlan(
  input: GeneratePlanInput,
): Promise<ProjectPlansDocument> {
  if (!isAiConfigured()) {
    throw new ApiError(
      400,
      'Configure o provedor, modelo e API token em Settings.',
    );
  }

  const milestoneId = input.milestoneId.trim();
  if (!milestoneId) {
    throw new ApiError(400, 'Informe milestoneId.');
  }

  const { items: milestones } = getProjectMilestones(input.projectId);
  const milestone = milestones.find((m) => m.id === milestoneId);
  if (!milestone) {
    throw new ApiError(404, 'Milestone não encontrado.');
  }

  const checklist = await getProjectSpecChecklist(input.projectId);
  const context = await buildPlanGenerateContext(
    input.projectId,
    milestone,
    checklist,
  );

  const userPrompt = [
    'Gere um plano de implementação para esta milestone.',
    '',
    context,
  ].join('\n');

  const raw = await completeChat(PLAN_GENERATE_PROMPT, userPrompt);
  const parsed = parseAiPlanResponse(raw);
  const { items: existingPlans } = getProjectPlans(input.projectId);
  let plan: Plan;
  try {
    plan = buildPlanFromAi(milestone, parsed, existingPlans);
  } catch (error) {
    if (error instanceof Error && error.message.includes('P999')) {
      throw new ApiError(400, error.message);
    }
    throw error;
  }

  return addProjectPlan(input.projectId, plan);
}

async function buildPlanGenerateContext(
  projectId: string,
  milestone: Milestone,
  checklist: ProjectSpecChecklistResponse | null,
): Promise<string> {
  const linkedSpecs =
    checklist?.specs.filter((spec) => milestone.specIds.includes(spec.specId)) ?? [];

  const featureSnippets: Array<{ specId: string; title: string; excerpt: string }> = [];
  for (const specId of milestone.specIds) {
    try {
      const feature = await getProjectFeatureContent(projectId, specId);
      if (feature?.content) {
        featureSnippets.push({
          specId,
          title: feature.title,
          excerpt: truncate(feature.content.replace(/\s+/g, ' ').trim(), 1200),
        });
      }
    } catch {
      /* spec file may be missing */
    }
  }

  const payload: Record<string, unknown> = {
    milestone: {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description || null,
      targetDate: milestone.targetDate || null,
      specIds: milestone.specIds,
    },
    specs: linkedSpecs.map((spec) => ({
      specId: spec.specId,
      title: spec.title,
      specFile: spec.specFile,
      checklist: spec.checklist.map((item) => ({
        ac: item.ac,
        description: item.description,
        status: item.status,
      })),
    })),
    feature_excerpts: featureSnippets,
  };

  return truncate(JSON.stringify(payload, null, 2), CONTEXT_MAX_CHARS);
}

function parseAiPlanResponse(text: string): AiPlanResponse {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = (fenced?.[1] ?? trimmed).trim();

  try {
    const parsed = JSON.parse(jsonCandidate) as AiPlanResponse;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid');
    }
    return parsed;
  } catch {
    throw new ApiError(502, 'A IA retornou um plano em formato inválido.');
  }
}

function buildPlanFromAi(
  milestone: Milestone,
  parsed: AiPlanResponse,
  existingPlans: Plan[],
): Plan {
  const code = nextPlanCode(existingPlans);
  const rawName =
    (typeof parsed.name === 'string' && parsed.name.trim()) ||
    (typeof parsed.title === 'string' && parsed.title.trim()) ||
    milestone.title;
  const name = normalizePlanNameInput(rawName) || milestone.title;
  const title = formatPlanTitle(code, name).slice(0, 200);

  const rawSteps = Array.isArray(parsed.items) ? parsed.items : [];
  if (rawSteps.length === 0) {
    throw new ApiError(502, 'A IA retornou um plano sem passos.');
  }

  const stepsWithTitles: Array<{
    id: string;
    order: number;
    title: string;
    description: string;
    specRef?: PlanStep['specRef'];
    dependsOnTitles: string[];
  }> = [];

  rawSteps.forEach((step, index) => {
    const stepTitle = typeof step.title === 'string' ? step.title.trim() : '';
    if (!stepTitle) return;

    const description =
      typeof step.description === 'string' ? step.description.trim().slice(0, 2000) : '';

    let specRef: PlanStep['specRef'];
    if (step.specRef && typeof step.specRef === 'object') {
      const specId =
        typeof step.specRef.specId === 'string' ? step.specRef.specId.trim() : '';
      const ac = typeof step.specRef.ac === 'string' ? step.specRef.ac.trim() : '';
      if (specId && milestone.specIds.includes(specId)) {
        specRef = ac ? { specId, ac } : { specId };
      }
    }

    const dependsOnTitles: string[] = [];
    if (Array.isArray(step.dependsOnTitles)) {
      for (const dep of step.dependsOnTitles) {
        if (typeof dep === 'string' && dep.trim()) dependsOnTitles.push(dep.trim());
      }
    }

    stepsWithTitles.push({
      id: createStepId(index),
      order: index + 1,
      title: stepTitle.slice(0, 200),
      description,
      specRef,
      dependsOnTitles,
    });
  });

  if (stepsWithTitles.length === 0) {
    throw new ApiError(502, 'A IA retornou um plano sem passos válidos.');
  }

  const titleToId = new Map(stepsWithTitles.map((s) => [s.title, s.id]));

  const items: PlanStep[] = stepsWithTitles.map((step) => ({
    id: step.id,
    order: step.order,
    title: step.title,
    description: step.description,
    specRef: step.specRef,
    dependsOn: step.dependsOnTitles
      .map((t) => titleToId.get(t))
      .filter((id): id is string => Boolean(id)),
    status: 'todo',
  }));

  const plan: Plan = {
    id: createPlanId(),
    milestoneId: milestone.id,
    title,
    source: 'ai',
    generatedAt: new Date().toISOString(),
    content: '',
    items,
  };
  plan.content = formatPlanBody(plan);

  return plan;
}

function createPlanId(): string {
  return `plan${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function createStepId(index: number): string {
  return `step${index + 1}-${Date.now().toString(36).slice(-4)}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
