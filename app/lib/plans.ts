export type PlanStepStatus = 'todo' | 'in-progress' | 'done' | 'blocked';

export type PlanSource = 'manual' | 'ai';

export type PlanSpecRef = {
  specId: string;
  ac?: string;
};

export type PlanStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  specRef?: PlanSpecRef;
  dependsOn: string[];
  status: PlanStepStatus;
};

export type Plan = {
  id: string;
  milestoneId: string;
  title: string;
  source: PlanSource;
  generatedAt: string;
  content: string;
  items: PlanStep[];
};

/** Display title: `P001 - nome do plano` (P + 3 dígitos, espaço, hífen, espaço, nome). */
export const PLAN_TITLE_PATTERN = /^P\d{3} - .+$/;

const PLAN_CODE_EXTRACT = /^P(\d{3}) - /;

const STEP_STATUSES: PlanStepStatus[] = ['todo', 'in-progress', 'done', 'blocked'];
const PLAN_SOURCES: PlanSource[] = ['manual', 'ai'];

function isPlanStepStatus(value: string): value is PlanStepStatus {
  return STEP_STATUSES.includes(value as PlanStepStatus);
}

function isPlanSource(value: string): value is PlanSource {
  return PLAN_SOURCES.includes(value as PlanSource);
}

function parseSpecRef(raw: unknown): PlanSpecRef | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const specId = typeof obj.specId === 'string' ? obj.specId.trim() : '';
  if (!specId) return undefined;
  const ac = typeof obj.ac === 'string' ? obj.ac.trim() : '';
  return ac ? { specId, ac } : { specId };
}

export function normalizePlanSteps(raw: unknown): PlanStep[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const items: PlanStep[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;

    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    if (!id || seen.has(id)) continue;

    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!title) continue;

    seen.add(id);

    const order = typeof obj.order === 'number' && Number.isFinite(obj.order) ? obj.order : items.length + 1;
    const description = typeof obj.description === 'string' ? obj.description.trim() : '';
    const statusRaw = typeof obj.status === 'string' ? obj.status.trim() : 'todo';
    const status = isPlanStepStatus(statusRaw) ? statusRaw : 'todo';
    const specRef = parseSpecRef(obj.specRef);

    const dependsOn: string[] = [];
    if (Array.isArray(obj.dependsOn)) {
      for (const dep of obj.dependsOn) {
        if (typeof dep === 'string' && dep.trim() && !dependsOn.includes(dep.trim())) {
          dependsOn.push(dep.trim());
        }
      }
    }

    items.push({ id, order, title, description, specRef, dependsOn, status });
  }

  return items.sort((a, b) => a.order - b.order);
}

export function normalizePlans(raw: unknown): Plan[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const items: Plan[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;

    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    const milestoneId = typeof obj.milestoneId === 'string' ? obj.milestoneId.trim() : '';
    if (!id || !milestoneId || seen.has(id)) continue;

    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!title) continue;

    seen.add(id);

    const sourceRaw = typeof obj.source === 'string' ? obj.source.trim() : 'manual';
    const source = isPlanSource(sourceRaw) ? sourceRaw : 'manual';
    const generatedAt =
      typeof obj.generatedAt === 'string' && obj.generatedAt.trim()
        ? obj.generatedAt.trim()
        : new Date(0).toISOString();
    const content = typeof obj.content === 'string' ? obj.content.trim() : '';
    const steps = normalizePlanSteps(obj.items);

    items.push({ id, milestoneId, title, source, generatedAt, content, items: steps });
  }

  return items;
}

export function serializePlanStep(step: PlanStep): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: step.id,
    order: step.order,
    title: step.title,
    status: step.status,
    dependsOn: [...step.dependsOn],
  };
  if (step.description.trim()) payload.description = step.description.trim();
  if (step.specRef) payload.specRef = { ...step.specRef };
  return payload;
}

export function serializePlan(plan: Plan): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: plan.id,
    milestoneId: plan.milestoneId,
    title: plan.title,
    source: plan.source,
    generatedAt: plan.generatedAt,
    items: plan.items.map(serializePlanStep),
  };
  if (plan.content.trim()) payload.content = plan.content.trim();
  return payload;
}

export function serializePlans(plans: Plan[]): Record<string, unknown>[] {
  return plans.map(serializePlan);
}

export function plansByMilestoneId(plans: Plan[], milestoneId: string): Plan[] {
  return sortPlansByGeneratedAt(
    plans.filter((plan) => plan.milestoneId === milestoneId),
  );
}

export function sortPlansByGeneratedAt(plans: Plan[]): Plan[] {
  return [...plans].sort(
    (a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt),
  );
}

export function formatPlanBody(plan: Plan): string {
  if (plan.content.trim()) return plan.content.trim();

  const steps = sortPlanSteps(plan.items);
  if (steps.length === 0) return 'Sem conteúdo.';

  return steps
    .map((step, index) => {
      const lines = [`${index + 1}. ${step.title}`];
      if (step.description.trim()) lines.push(`   ${step.description.trim()}`);
      if (step.specRef) {
        const ref = step.specRef.ac
          ? `${step.specRef.specId}/${step.specRef.ac}`
          : step.specRef.specId;
        lines.push(`   spec: ${ref}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

export function sortPlanSteps(steps: PlanStep[]): PlanStep[] {
  return [...steps].sort((a, b) => a.order - b.order);
}

export function isValidPlanTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!PLAN_TITLE_PATTERN.test(trimmed)) return false;
  const parsed = parsePlanTitle(trimmed);
  return parsed !== null && parsed.name.length > 0;
}

export function parsePlanTitle(title: string): { code: string; name: string } | null {
  const match = title.trim().match(/^P(\d{3}) - (.+)$/);
  if (!match) return null;
  const name = match[2].trim();
  if (!name) return null;
  return { code: `P${match[1]}`, name };
}

export function extractPlanCodes(plans: Plan[]): number[] {
  const codes: number[] = [];
  for (const plan of plans) {
    const match = plan.title.trim().match(PLAN_CODE_EXTRACT);
    if (match) codes.push(Number(match[1]));
  }
  return codes;
}

export function nextPlanCode(plans: Plan[]): string {
  const codes = extractPlanCodes(plans);
  const next = codes.length === 0 ? 1 : Math.max(...codes) + 1;
  if (next > 999) {
    throw new Error('Limite de códigos de plano (P999) atingido.');
  }
  return `P${String(next).padStart(3, '0')}`;
}

export function formatPlanTitle(code: string, name: string): string {
  const normalizedName = normalizePlanNameInput(name);
  if (!normalizedName) {
    throw new Error('Nome do plano não pode ser vazio.');
  }
  if (!/^P\d{3}$/.test(code)) {
    throw new Error('Código do plano deve ser PXXX (ex.: P001).');
  }
  return `${code} - ${normalizedName}`;
}

/** Nome sem prefixo PXXX ou legado "Plano —". */
export function normalizePlanNameInput(raw: string): string {
  return raw
    .trim()
    .replace(/^Plano\s*[—-]\s*/i, '')
    .replace(/^P\d{3}\s*-\s*/, '')
    .trim();
}
