import { execFileSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';

import { ApiError } from './api-error';
import { normalizeCheckpoints, serializeCheckpoints, type Checkpoint } from '@/app/lib/checkpoints';
import {
  normalizeMilestones,
  serializeMilestones,
  type Milestone,
} from '@/app/lib/milestones';
import {
  isValidPlanTitle,
  normalizePlans,
  parsePlanTitle,
  serializePlans,
  type Plan,
  type PlanSource,
  type PlanSpecRef,
  type PlanStep,
  type PlanStepStatus,
} from '@/app/lib/plans';
import { LOCAL_PROJECTS_MOUNT, serverEnv } from './env';
import {
  fetchGithubCommitDate,
  fetchGithubTextFile,
} from './github-json';
import { slugify } from './slugify';
import { projectsFolder } from './workspace-config';
import {
  generateConsumerToken,
  logConsumerTokenBanner,
  normalizeLocalPath,
  readConsumerTokenIndex,
  writeConsumerTokenIndex,
  syncConsumerTokensToEnv,
  getConsumerTokenForProject,
} from './consumer-api-token';

const META_KEY = '_meta';

export type ProjectSourceType = 'local' | 'local_repo' | 'github';

export type ProjectResponse = {
  id: string;
  name: string;
  source_type: string;
  json_data: Record<string, unknown>;
  local_file_path: string | null;
  github_repo_url: string | null;
  github_branch: string | null;
  github_file_path: string | null;
  local_path: string | null;
  local_path_relative: string | null;
  spec_project_id: string | null;
  spec_checklist_path: string | null;
  tasks_path: string | null;
  has_github_pat: boolean;
  last_synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProjectCreateInput = {
  source_type: ProjectSourceType;
  json_content?: string | Record<string, unknown> | null;
  local_path?: string | null;
  spec_project_id?: string | null;
  spec_checklist_path?: string | null;
  github_repo_url?: string | null;
  github_pat?: string | null;
  github_branch?: string | null;
  /** @deprecated GitHub projects no longer sync project.json from the repo */
  github_file_path?: string | null;
};

export type ProjectUpdateInput = {
  json_content?: string | Record<string, unknown> | null;
  source_type?: ProjectSourceType;
  new_id?: string | null;
  local_path?: string | null;
  spec_project_id?: string | null;
  spec_checklist_path?: string | null;
  tasks_path?: string | null;
  github_repo_url?: string | null;
  github_pat?: string | null;
  github_branch?: string | null;
  github_file_path?: string | null;
};

export function listProjects(skip = 0, limit = 100) {
  const files = listProjectFiles();
  const items = files.map((filePath) => fileToResponse(filePath));
  return {
    items: items.slice(skip, skip + limit),
    total: items.length,
    skip,
    limit,
  };
}

export function getProject(id: string): ProjectResponse | null {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  return fileToResponse(filePath);
}

export async function createProject(
  data: ProjectCreateInput,
): Promise<ProjectResponse> {
  validateProjectCreate(data);

  if (data.source_type === 'local') {
    const jsonData = parseJsonContent(data.json_content);
    const name = requireNameFromJson(jsonData);
    const body = stripRepoFields(jsonData);
    const payload = withMeta(body, { source_type: 'local' });
    const filePath = writeProjectFile(name, payload);
    rebuildConsumerTokenRegistry();
    return fileToResponse(filePath);
  }

  if (data.source_type === 'local_repo') {
    const localPath = requireLocalPath(data.local_path);
    const jsonData = parseJsonContent(data.json_content);
    const name = requireNameFromJson(jsonData);
    const body = stripRepoFields(jsonData);
    const payload = withMeta(body, {
      source_type: 'local_repo',
      local_path: localPath,
    });
    const filePath = writeProjectFile(name, payload);
    rebuildConsumerTokenRegistry();
    return fileToResponse(filePath);
  }

  const jsonData = parseJsonContent(data.json_content);
  const name = requireNameFromJson(jsonData);
  const body = stripRepoFields(jsonData);
  const checklistPath =
    typeof data.spec_checklist_path === 'string' && data.spec_checklist_path.trim()
      ? data.spec_checklist_path.trim().replace(/^\//, '')
      : DEFAULT_CHECKLIST_PATH;

  try {
    await fetchGithubTextFile({
      repoUrl: data.github_repo_url!,
      pat: data.github_pat!,
      branch: data.github_branch!,
      filePath: checklistPath,
    });
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error
        ? error.message
        : 'Falha ao buscar spec-checklist no GitHub.',
    );
  }

  const meta: Record<string, unknown> = {
    source_type: 'github',
    github_repo_url: data.github_repo_url!.trim(),
    github_pat: data.github_pat!.trim(),
    github_branch: data.github_branch!.trim(),
    spec_checklist_path: checklistPath,
    last_synced_at: new Date().toISOString(),
  };
  if (typeof data.spec_project_id === 'string' && data.spec_project_id.trim()) {
    meta.spec_project_id = data.spec_project_id.trim();
  }

  const payload = withMeta(body, meta);
  const filePath = writeProjectFile(name, payload);
  rebuildConsumerTokenRegistry();
  return fileToResponse(filePath);
}

export function updateProject(
  id: string,
  data: ProjectUpdateInput,
): ProjectResponse | null {
  let filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  const current = readJsonFile(filePath);
  const meta = { ...((current[META_KEY] as Record<string, unknown>) ?? {}) };

  if (data.json_content !== undefined) {
    const jsonData = parseJsonContent(data.json_content);
    requireNameFromJson(jsonData);
    const body = Object.fromEntries(
      Object.entries(jsonData).filter(([key]) => key !== META_KEY),
    );
    applyProjectMetaUpdates(meta, data);
    overwriteJsonFile(filePath, withMeta(body, meta));
  } else {
    const body = Object.fromEntries(
      Object.entries(current).filter(([key]) => key !== META_KEY),
    );
    applyProjectMetaUpdates(meta, data);
    overwriteJsonFile(filePath, withMeta(body, meta));
  }

  if (data.new_id !== undefined && data.new_id !== null) {
    const nextId = slugify(String(data.new_id).trim(), 'projeto');
    if (nextId !== id) {
      filePath = renameProjectFile(id, nextId);
    }
  }

  rebuildConsumerTokenRegistry();
  return fileToResponse(filePath);
}

export async function syncProject(id: string): Promise<ProjectResponse> {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Project not found');
  }

  const current = readJsonFile(filePath);
  const meta = { ...((current[META_KEY] as Record<string, unknown>) ?? {}) };

  if (meta.source_type !== 'github') {
    throw new ApiError(400, 'Apenas projetos GitHub podem ser sincronizados.');
  }

  const repo = meta.github_repo_url;
  const pat = meta.github_pat;
  const branch = meta.github_branch;
  if (!repo || !pat || !branch) {
    throw new ApiError(400, 'Configuração GitHub incompleta para sincronizar.');
  }

  const checklistPath =
    typeof meta.spec_checklist_path === 'string' && meta.spec_checklist_path.trim()
      ? meta.spec_checklist_path.trim().replace(/^\//, '')
      : DEFAULT_CHECKLIST_PATH;

  try {
    await fetchGithubTextFile({
      repoUrl: String(repo),
      pat: String(pat),
      branch: String(branch),
      filePath: checklistPath,
    });
    meta.last_synced_at = new Date().toISOString();
    delete meta.github_file_path;
    delete meta.tasks_path;
    delete meta.checklist_path;
    const body = Object.fromEntries(
      Object.entries(current).filter(([key]) => key !== META_KEY),
    );
    overwriteJsonFile(filePath, withMeta(body, meta));
    return fileToResponse(filePath);
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error ? error.message : 'Falha ao sincronizar spec-checklist.',
    );
  }
}

export function updateProjectAiField(
  id: string,
  ai: string,
): ProjectResponse | null {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  const current = readJsonFile(filePath);
  const meta = { ...((current[META_KEY] as Record<string, unknown>) ?? {}) };
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );
  body.ai = ai;
  meta.ai_updated_at = new Date().toISOString();
  overwriteJsonFile(filePath, withMeta(body, meta));
  return fileToResponse(filePath);
}

export function updateProjectCheckpoints(
  id: string,
  checkpoints: Checkpoint[],
): ProjectResponse | null {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  const current = readJsonFile(filePath);
  const meta = { ...((current[META_KEY] as Record<string, unknown>) ?? {}) };
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );

  body.checkpoints = serializeCheckpoints(checkpoints);

  const latestDate = checkpoints.find((item) => item.date.trim())?.date.trim();
  if (latestDate) {
    body.topDate = latestDate;
  }

  overwriteJsonFile(filePath, withMeta(body, meta));
  return fileToResponse(filePath);
}

export function getProjectCheckpoints(id: string): Checkpoint[] {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Project not found');
  }

  const current = readJsonFile(filePath);
  const topDate = typeof current.topDate === 'string' ? current.topDate : undefined;
  return normalizeCheckpoints(current.checkpoints, topDate);
}

export function readProjectMeta(id: string): Record<string, unknown> | null {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  const current = readJsonFile(filePath);
  const meta = current[META_KEY];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return {};
  }
  return meta as Record<string, unknown>;
}

export function deleteProject(id: string): boolean {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const backupPath = backupPathForProjectFile(filePath);
  fs.renameSync(filePath, backupPath);

  rebuildConsumerTokenRegistry();
  return true;
}

export type ProjectTaskItem = {
  id: string;
  label: string;
  done: boolean;
};

export type ProjectTasksDocument = {
  version: 1;
  items: ProjectTaskItem[];
  tasks_path: string | null;
  source: ProjectSourceType;
  updated_at: string | null;
};

const TASK_LABEL_MAX = 200;
const MILESTONE_TITLE_MAX = 200;
const MILESTONE_DESCRIPTION_MAX = 2000;
const PLAN_TITLE_MAX = 200;
const PLAN_CONTENT_MAX = 20000;
const PLAN_STEP_TITLE_MAX = 200;
const PLAN_STEP_DESCRIPTION_MAX = 2000;
const DEFAULT_REPO_TASKS_PATH = 'tasks.json';

function legacyLocalChecklistPathForId(projectId: string): string {
  const slug = slugify(projectId, 'projeto');
  return path.join(projectsFolder(), `${slug}.spec-checklist.json`);
}

function legacyProjectTasksPathForId(projectId: string): string {
  const slug = slugify(projectId, 'projeto');
  return path.join(projectsFolder(), `${slug}.checklist.json`);
}

function defaultProjectTasksPath(sourceType: ProjectSourceType): string {
  return DEFAULT_REPO_TASKS_PATH;
}

function resolveProjectTasksPath(
  meta: Record<string, unknown>,
  sourceType: ProjectSourceType,
): string {
  if (typeof meta.tasks_path === 'string' && meta.tasks_path.trim()) {
    return meta.tasks_path.trim().replace(/^\//, '');
  }
  if (typeof meta.checklist_path === 'string' && meta.checklist_path.trim()) {
    return meta.checklist_path.trim().replace(/^\//, '');
  }
  return defaultProjectTasksPath(sourceType);
}

function resolveProjectTasksPathForResponse(
  _meta: Record<string, unknown>,
  _sourceType: ProjectSourceType,
): string | null {
  return null;
}

function usesEmbeddedProjectTasks(_sourceType: ProjectSourceType): boolean {
  return true;
}

function createTaskItemId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function readTaskItemsFromRaw(raw: unknown): ProjectTaskItem[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const items: ProjectTaskItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!label) continue;

    let id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id || seen.has(id)) {
      id = createTaskItemId();
    }
    seen.add(id);

    items.push({
      id,
      label,
      done: row.done === true,
    });
  }

  return items;
}

function parseProjectTasksDocument(raw: unknown): {
  version: 1;
  items: ProjectTaskItem[];
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'O arquivo de tasks deve ser um objeto JSON.');
  }

  const data = raw as Record<string, unknown>;
  if (data.version !== 1) {
    throw new ApiError(400, 'version do arquivo de tasks deve ser 1.');
  }
  if (!Array.isArray(data.items)) {
    throw new ApiError(400, 'items do arquivo de tasks deve ser um array.');
  }

  const seen = new Set<string>();
  const items: ProjectTaskItem[] = data.items.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ApiError(400, `Item ${index} de tasks é inválido.`);
    }
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!id) {
      throw new ApiError(400, `Item ${index} precisa de id não vazio.`);
    }
    if (seen.has(id)) {
      throw new ApiError(400, `id duplicado em tasks: ${id}`);
    }
    seen.add(id);
    if (!label) {
      throw new ApiError(400, `Item ${index} precisa de label não vazia.`);
    }
    if (label.length > TASK_LABEL_MAX) {
      throw new ApiError(
        400,
        `Label do item ${index} excede ${TASK_LABEL_MAX} caracteres.`,
      );
    }
    if (typeof row.done !== 'boolean') {
      throw new ApiError(400, `Item ${index} precisa de done booleano.`);
    }
    return { id, label, done: row.done };
  });

  return { version: 1, items };
}


function overwriteJsonFileAtomic(
  filePath: string,
  jsonData: Record<string, unknown>,
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(
      tempPath,
      `${JSON.stringify(jsonData, null, 2)}\n`,
      'utf-8',
    );
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      /* ignore cleanup errors */
    }
    throw error;
  }
}

function writeTasksFileToDisk(
  absolutePath: string,
  items: ProjectTaskItem[],
): string {
  overwriteJsonFileAtomic(absolutePath, {
    version: 1,
    items,
  } as unknown as Record<string, unknown>);
  return fs.statSync(absolutePath).mtime.toISOString();
}

function readTasksFileFromDisk(
  absolutePath: string,
): { items: ProjectTaskItem[]; updatedAt: string | null } | null {
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
    const document = parseProjectTasksDocument(raw);
    return {
      items: document.items,
      updatedAt: fs.statSync(absolutePath).mtime.toISOString(),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof SyntaxError) {
      throw new ApiError(
        400,
        `Arquivo inválido (${path.basename(absolutePath)}): ${error.message}`,
      );
    }
    throw new ApiError(
      400,
      `Não foi possível ler ${path.basename(absolutePath)}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function readEmbeddedTasksFromProject(
  data: Record<string, unknown>,
): ProjectTaskItem[] {
  return readTaskItemsFromRaw(data.tasks);
}

function writeEmbeddedTasksToProject(
  id: string,
  items: ProjectTaskItem[],
): string {
  const filePath = pathForId(id);
  const current = readJsonFile(filePath);
  const meta = {
    ...((current[META_KEY] as Record<string, unknown>) ?? {}),
  };
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );
  body.tasks = items;
  overwriteJsonFile(filePath, withMeta(body, meta));
  return fs.statSync(filePath).mtime.toISOString();
}

function localProjectTasksSidecarPath(projectId: string): string {
  const slug = slugify(projectId, 'projeto');
  return path.join(projectsFolder(), `${slug}.tasks.json`);
}

function removeLegacyChecklistFieldFromProjectJson(id: string): void {
  const filePath = pathForId(id);
  const current = readJsonFile(filePath);
  if (!('checklist' in current)) return;

  const meta = {
    ...((current[META_KEY] as Record<string, unknown>) ?? {}),
  };
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY && key !== 'checklist'),
  );
  overwriteJsonFile(filePath, withMeta(body, meta));
}

type ProjectTasksContext = {
  id: string;
  sourceType: ProjectSourceType;
  tasksPath: string | null;
  workspaceFilePath: string | null;
  github: {
    repoUrl: string;
    pat: string;
    branch: string;
  } | null;
};

function resolveProjectTasksContext(id: string): ProjectTasksContext {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Project not found');
  }

  const data = readJsonFile(filePath);
  const meta =
    data[META_KEY] && typeof data[META_KEY] === 'object' && !Array.isArray(data[META_KEY])
      ? (data[META_KEY] as Record<string, unknown>)
      : {};
  const sourceType = resolveSourceType(meta);

  return {
    id,
    sourceType,
    tasksPath: null,
    workspaceFilePath: null,
    github: null,
  };
}

function migrateEmbeddedProjectTasks(
  id: string,
  ctx: ProjectTasksContext,
  data: Record<string, unknown>,
  filePath: string,
): void {
  let embedded = readEmbeddedTasksFromProject(data);

  const importSidecarItems = (sidecarPath: string): ProjectTaskItem[] => {
    if (!fs.existsSync(sidecarPath) || !fs.statSync(sidecarPath).isFile()) {
      return [];
    }
    try {
      const raw = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8'));
      const legacy = parseProjectTasksDocument(raw);
      fs.unlinkSync(sidecarPath);
      return legacy.items;
    } catch {
      return [];
    }
  };

  if (!embedded.length) {
    embedded = importSidecarItems(legacyLocalChecklistPathForId(id));
  }
  if (!embedded.length) {
    embedded = importSidecarItems(legacyProjectTasksPathForId(id));
  }
  if (!embedded.length) {
    embedded = importSidecarItems(localProjectTasksSidecarPath(id));
  }
  if (!embedded.length) {
    embedded = readTaskItemsFromRaw(data.checklist);
  }

  if (!embedded.length && ctx.sourceType === 'local_repo') {
    const meta =
      data[META_KEY] && typeof data[META_KEY] === 'object' && !Array.isArray(data[META_KEY])
        ? (data[META_KEY] as Record<string, unknown>)
        : {};
    const localPath =
      typeof meta.local_path === 'string' ? meta.local_path.trim() : '';
    if (localPath) {
      const resolvedRoot = resolveLocalProjectPath(localPath);
      if (resolvedRoot) {
        const legacyRepoTasks = path.join(
          resolvedRoot,
          resolveProjectTasksPath(meta, 'local_repo'),
        );
        const legacyFile = readTasksFileFromDisk(legacyRepoTasks);
        if (legacyFile?.items.length) {
          embedded = legacyFile.items;
        }
      }
    }
  }

  if (embedded.length > 0 || Array.isArray(data.tasks) || 'checklist' in data) {
    writeEmbeddedTasksToProject(id, embedded);
    removeLegacyChecklistFieldFromProjectJson(id);
    data = readJsonFile(filePath);
  }

  const meta = {
    ...((data[META_KEY] as Record<string, unknown>) ?? {}),
  };
  if ('tasks_path' in meta) {
    delete meta.tasks_path;
    const body = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== META_KEY),
    );
    overwriteJsonFile(filePath, withMeta(body, meta));
  }
}

async function migrateGithubRemoteTasksToEmbedded(id: string): Promise<void> {
  const filePath = pathForId(id);
  let data = readJsonFile(filePath);
  const meta =
    data[META_KEY] && typeof data[META_KEY] === 'object' && !Array.isArray(data[META_KEY])
      ? (data[META_KEY] as Record<string, unknown>)
      : {};

  if (resolveSourceType(meta) !== 'github') {
    return;
  }

  const embedded = readEmbeddedTasksFromProject(data);
  if (!embedded.length) {
    const tasksPath = resolveProjectTasksPath(meta, 'github');
    const repo = meta.github_repo_url;
    const pat = meta.github_pat;
    const branch = meta.github_branch;
    if (repo && pat && branch && tasksPath) {
      try {
        const remote = await fetchGithubTextFile({
          repoUrl: String(repo),
          pat: String(pat),
          branch: String(branch),
          filePath: tasksPath,
        });
        const document = parseProjectTasksDocument(JSON.parse(remote.content));
        if (document.items.length > 0) {
          writeEmbeddedTasksToProject(id, document.items);
        }
      } catch {
        /* ignore missing or invalid remote tasks */
      }
    }
  }

  data = readJsonFile(filePath);
  const nextMeta = {
    ...((data[META_KEY] as Record<string, unknown>) ?? {}),
  };
  let changed = false;
  for (const key of ['tasks_path', 'checklist_path', 'github_file_path'] as const) {
    if (key in nextMeta) {
      delete nextMeta[key];
      changed = true;
    }
  }
  if (changed) {
    const body = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== META_KEY),
    );
    overwriteJsonFile(filePath, withMeta(body, nextMeta));
  }
}

function migrateLegacyTasksSources(
  id: string,
  ctx: ProjectTasksContext,
): Promise<void> {
  return migrateGithubRemoteTasksToEmbedded(id).then(() => {
    const filePath = pathForId(id);
    let data = readJsonFile(filePath);

    migrateEmbeddedProjectTasks(id, ctx, data, filePath);
  });
}

function buildProjectTasksResponse(
  ctx: ProjectTasksContext,
  items: ProjectTaskItem[],
  updatedAt: string | null,
): ProjectTasksDocument {
  return {
    version: 1,
    items,
    tasks_path: ctx.tasksPath,
    source: ctx.sourceType,
    updated_at: updatedAt,
  };
}

export async function getProjectTasks(id: string): Promise<ProjectTasksDocument> {
  const ctx = resolveProjectTasksContext(id);
  await migrateLegacyTasksSources(id, ctx);

  const data = readJsonFile(pathForId(id));
  const items = readEmbeddedTasksFromProject(data);
  const stat = fs.statSync(pathForId(id));
  return buildProjectTasksResponse(ctx, items, stat.mtime.toISOString());
}

export async function saveProjectTasks(
  id: string,
  payload: unknown,
): Promise<ProjectTasksDocument> {
  const ctx = resolveProjectTasksContext(id);
  const document = parseProjectTasksDocument(payload);
  const updatedAt = writeEmbeddedTasksToProject(id, document.items);
  return buildProjectTasksResponse(ctx, document.items, updatedAt);
}

export type ProjectMilestonesDocument = {
  version: 1;
  items: Milestone[];
  updated_at: string | null;
};

function readEmbeddedMilestonesFromProject(data: Record<string, unknown>): Milestone[] {
  return normalizeMilestones(data.milestones);
}

function writeEmbeddedMilestonesToProject(id: string, items: Milestone[]): string {
  const filePath = pathForId(id);
  const current = readJsonFile(filePath);
  const meta = {
    ...((current[META_KEY] as Record<string, unknown>) ?? {}),
  };
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );
  body.milestones = serializeMilestones(items);
  overwriteJsonFile(filePath, withMeta(body, meta));
  return fs.statSync(filePath).mtime.toISOString();
}

function parseProjectMilestonesDocument(raw: unknown): { version: 1; items: Milestone[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'O documento de milestones deve ser um objeto JSON.');
  }

  const data = raw as Record<string, unknown>;
  if (data.version !== 1) {
    throw new ApiError(400, 'version do documento de milestones deve ser 1.');
  }
  if (!Array.isArray(data.items)) {
    throw new ApiError(400, 'items do documento de milestones deve ser um array.');
  }

  const seen = new Set<string>();
  const items: Milestone[] = data.items.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ApiError(400, `Item ${index} de milestones é inválido.`);
    }
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!id) {
      throw new ApiError(400, `Item ${index} precisa de id não vazio.`);
    }
    if (seen.has(id)) {
      throw new ApiError(400, `id duplicado em milestones: ${id}`);
    }
    seen.add(id);
    if (!title) {
      throw new ApiError(400, `Item ${index} precisa de title não vazio.`);
    }
    if (title.length > MILESTONE_TITLE_MAX) {
      throw new ApiError(
        400,
        `Title do item ${index} excede ${MILESTONE_TITLE_MAX} caracteres.`,
      );
    }

    const targetDate = typeof row.targetDate === 'string' ? row.targetDate.trim() : '';
    const description =
      typeof row.description === 'string' ? row.description.trim() : '';
    if (description.length > MILESTONE_DESCRIPTION_MAX) {
      throw new ApiError(
        400,
        `Description do item ${index} excede ${MILESTONE_DESCRIPTION_MAX} caracteres.`,
      );
    }

    const specIds: string[] = [];
    if (Array.isArray(row.specIds)) {
      for (const specId of row.specIds) {
        if (typeof specId !== 'string' || !specId.trim()) {
          throw new ApiError(400, `specIds do item ${index} deve conter strings não vazias.`);
        }
        const normalized = specId.trim();
        if (!specIds.includes(normalized)) specIds.push(normalized);
      }
    }

    return { id, title, targetDate, description, specIds };
  });

  return { version: 1, items };
}

export function getProjectMilestones(id: string): ProjectMilestonesDocument {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Project not found');
  }

  const current = readJsonFile(filePath);
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );
  const items = readEmbeddedMilestonesFromProject(body);
  const stat = fs.statSync(filePath);

  return {
    version: 1,
    items,
    updated_at: stat.mtime.toISOString(),
  };
}

export function saveProjectMilestones(
  id: string,
  payload: unknown,
): ProjectMilestonesDocument {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Project not found');
  }

  const document = parseProjectMilestonesDocument(payload);
  const updatedAt = writeEmbeddedMilestonesToProject(id, document.items);

  return {
    version: 1,
    items: document.items,
    updated_at: updatedAt,
  };
}

export type ProjectPlansDocument = {
  version: 1;
  items: Plan[];
  updated_at: string | null;
};

function readEmbeddedPlansFromProject(data: Record<string, unknown>): Plan[] {
  return normalizePlans(data.plans);
}

function writeEmbeddedPlansToProject(id: string, items: Plan[]): string {
  const filePath = pathForId(id);
  const current = readJsonFile(filePath);
  const meta = {
    ...((current[META_KEY] as Record<string, unknown>) ?? {}),
  };
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );
  body.plans = serializePlans(items);
  overwriteJsonFile(filePath, withMeta(body, meta));
  return fs.statSync(filePath).mtime.toISOString();
}

const PLAN_STEP_STATUSES: PlanStepStatus[] = ['todo', 'in-progress', 'done', 'blocked'];
const PLAN_SOURCES: PlanSource[] = ['manual', 'ai'];

function parsePlanSpecRef(raw: unknown, stepIndex: number, planIndex: number): PlanSpecRef | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, `specRef do passo ${stepIndex} do plano ${planIndex} é inválido.`);
  }
  const row = raw as Record<string, unknown>;
  const specId = typeof row.specId === 'string' ? row.specId.trim() : '';
  if (!specId) {
    throw new ApiError(400, `specRef do passo ${stepIndex} do plano ${planIndex} precisa de specId.`);
  }
  const ac = typeof row.ac === 'string' ? row.ac.trim() : '';
  return ac ? { specId, ac } : { specId };
}

function parseProjectPlansDocument(
  raw: unknown,
  milestoneIds?: Set<string>,
): { version: 1; items: Plan[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'O documento de plans deve ser um objeto JSON.');
  }

  const data = raw as Record<string, unknown>;
  if (data.version !== 1) {
    throw new ApiError(400, 'version do documento de plans deve ser 1.');
  }
  if (!Array.isArray(data.items)) {
    throw new ApiError(400, 'items do documento de plans deve ser um array.');
  }

  const seenPlanIds = new Set<string>();
  const seenPlanCodes = new Set<string>();
  const items: Plan[] = data.items.map((entry, planIndex) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ApiError(400, `Item ${planIndex} de plans é inválido.`);
    }
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const milestoneId = typeof row.milestoneId === 'string' ? row.milestoneId.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    if (!id) {
      throw new ApiError(400, `Item ${planIndex} de plans precisa de id não vazio.`);
    }
    if (seenPlanIds.has(id)) {
      throw new ApiError(400, `id duplicado em plans: ${id}`);
    }
    seenPlanIds.add(id);
    if (!milestoneId) {
      throw new ApiError(400, `Item ${planIndex} de plans precisa de milestoneId não vazio.`);
    }
    if (milestoneIds && !milestoneIds.has(milestoneId)) {
      throw new ApiError(400, `milestoneId desconhecido: ${milestoneId}`);
    }
    if (!title) {
      throw new ApiError(400, `Item ${planIndex} de plans precisa de title não vazio.`);
    }
    if (!isValidPlanTitle(title)) {
      throw new ApiError(
        400,
        `Title do plano ${planIndex} deve seguir o padrão PXXX - nome (ex.: P001 - Auth refresh).`,
      );
    }
    const planTitle = parsePlanTitle(title);
    if (!planTitle) {
      throw new ApiError(400, `Title do plano ${planIndex} é inválido.`);
    }
    if (seenPlanCodes.has(planTitle.code)) {
      throw new ApiError(400, `Código de plano duplicado: ${planTitle.code}`);
    }
    seenPlanCodes.add(planTitle.code);
    if (title.length > PLAN_TITLE_MAX) {
      throw new ApiError(
        400,
        `Title do plano ${planIndex} excede ${PLAN_TITLE_MAX} caracteres.`,
      );
    }

    const sourceRaw = typeof row.source === 'string' ? row.source.trim() : 'manual';
    if (!PLAN_SOURCES.includes(sourceRaw as PlanSource)) {
      throw new ApiError(400, `source do plano ${planIndex} deve ser manual ou ai.`);
    }
    const source = sourceRaw as PlanSource;

    const generatedAt =
      typeof row.generatedAt === 'string' && row.generatedAt.trim()
        ? row.generatedAt.trim()
        : new Date().toISOString();

    const content = typeof row.content === 'string' ? row.content.trim() : '';
    if (content.length > PLAN_CONTENT_MAX) {
      throw new ApiError(
        400,
        `Content do plano ${planIndex} excede ${PLAN_CONTENT_MAX} caracteres.`,
      );
    }

    if (!Array.isArray(row.items)) {
      throw new ApiError(400, `items do plano ${planIndex} deve ser um array.`);
    }

    const seenStepIds = new Set<string>();
    const steps: PlanStep[] = row.items.map((stepEntry, stepIndex) => {
      if (!stepEntry || typeof stepEntry !== 'object' || Array.isArray(stepEntry)) {
        throw new ApiError(400, `Passo ${stepIndex} do plano ${planIndex} é inválido.`);
      }
      const stepRow = stepEntry as Record<string, unknown>;
      const stepId = typeof stepRow.id === 'string' ? stepRow.id.trim() : '';
      const stepTitle = typeof stepRow.title === 'string' ? stepRow.title.trim() : '';
      if (!stepId) {
        throw new ApiError(400, `Passo ${stepIndex} do plano ${planIndex} precisa de id.`);
      }
      if (seenStepIds.has(stepId)) {
        throw new ApiError(400, `id duplicado em passos do plano ${planIndex}: ${stepId}`);
      }
      seenStepIds.add(stepId);

      if (!stepTitle) {
        throw new ApiError(400, `Passo ${stepIndex} do plano ${planIndex} precisa de title.`);
      }
      if (stepTitle.length > PLAN_STEP_TITLE_MAX) {
        throw new ApiError(
          400,
          `Title do passo ${stepIndex} do plano ${planIndex} excede ${PLAN_STEP_TITLE_MAX} caracteres.`,
        );
      }

      const order =
        typeof stepRow.order === 'number' && Number.isFinite(stepRow.order)
          ? stepRow.order
          : stepIndex + 1;
      const description =
        typeof stepRow.description === 'string' ? stepRow.description.trim() : '';
      if (description.length > PLAN_STEP_DESCRIPTION_MAX) {
        throw new ApiError(
          400,
          `Description do passo ${stepIndex} do plano ${planIndex} excede ${PLAN_STEP_DESCRIPTION_MAX} caracteres.`,
        );
      }

      const statusRaw = typeof stepRow.status === 'string' ? stepRow.status.trim() : 'todo';
      if (!PLAN_STEP_STATUSES.includes(statusRaw as PlanStepStatus)) {
        throw new ApiError(400, `status inválido no passo ${stepIndex} do plano ${planIndex}.`);
      }

      const specRef = parsePlanSpecRef(stepRow.specRef, stepIndex, planIndex);

      const dependsOn: string[] = [];
      if (Array.isArray(stepRow.dependsOn)) {
        for (const dep of stepRow.dependsOn) {
          if (typeof dep !== 'string' || !dep.trim()) {
            throw new ApiError(
              400,
              `dependsOn do passo ${stepIndex} do plano ${planIndex} deve conter strings.`,
            );
          }
          const normalized = dep.trim();
          if (!dependsOn.includes(normalized)) dependsOn.push(normalized);
        }
      }

      return {
        id: stepId,
        order,
        title: stepTitle,
        description,
        specRef,
        dependsOn,
        status: statusRaw as PlanStepStatus,
      };
    });

    for (const step of steps) {
      for (const dep of step.dependsOn) {
        if (!seenStepIds.has(dep)) {
          throw new ApiError(
            400,
            `dependsOn "${dep}" no plano ${planIndex} referencia passo inexistente.`,
          );
        }
      }
    }

    steps.sort((a, b) => a.order - b.order);

    const normalizedTitle = `${planTitle.code} - ${planTitle.name}`;

    return { id, milestoneId, title: normalizedTitle, source, generatedAt, content, items: steps };
  });

  return { version: 1, items };
}

export function getProjectPlans(id: string): ProjectPlansDocument {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Project not found');
  }

  const current = readJsonFile(filePath);
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );
  const items = readEmbeddedPlansFromProject(body);
  const stat = fs.statSync(filePath);

  return {
    version: 1,
    items,
    updated_at: stat.mtime.toISOString(),
  };
}

export function saveProjectPlans(id: string, payload: unknown): ProjectPlansDocument {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Project not found');
  }

  const current = readJsonFile(filePath);
  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );
  const milestones = readEmbeddedMilestonesFromProject(body);
  const milestoneIds = new Set(milestones.map((m) => m.id));

  const document = parseProjectPlansDocument(payload, milestoneIds);
  const updatedAt = writeEmbeddedPlansToProject(id, document.items);

  return {
    version: 1,
    items: document.items,
    updated_at: updatedAt,
  };
}

export function addProjectPlan(id: string, plan: Plan): ProjectPlansDocument {
  const current = getProjectPlans(id);
  return saveProjectPlans(id, { version: 1, items: [...current.items, plan] });
}

export type AcStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

export type SpecChecklistAc = {
  ac: string;
  description: string;
  status: AcStatus;
  completedCommit: string | null;
  completedAt: string | null;
  issues: number[];
  prs: number[];
};

export type SpecChecklistSpec = {
  specId: string;
  specFile: string;
  title: string;
  checklist: SpecChecklistAc[];
};

export type ProjectSpecChecklistResponse = {
  checklist_path: string;
  updated_at: string | null;
  global_updated_at: string | null;
  project_id: string | null;
  project_name: string | null;
  specs: SpecChecklistSpec[];
  source: 'local' | 'local_repo' | 'github' | null;
  stats: {
    total: number;
    done: number;
    in_progress: number;
    blocked: number;
    todo: number;
  };
};

const DEFAULT_CHECKLIST_PATH = '.specs/spec-checklist.json';

type RawChecklistFile = {
  updatedAt?: string;
  projects?: Array<{
    id: string;
    name: string;
    specs?: Array<{
      specId: string;
      specFile: string;
      title?: string;
      checklist?: Array<{
        ac: string;
        description?: string;
        status?: string;
        completedCommit?: string;
        issues?: number[];
        prs?: number[];
      }>;
    }>;
  }>;
};

function normalizeAcStatus(value: string | undefined): AcStatus {
  if (value === 'done' || value === 'in-progress' || value === 'blocked' || value === 'todo') {
    return value;
  }
  return 'todo';
}

const COMMIT_HASH_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function normalizeCommitHash(value: string | undefined): string | null {
  const commit = value?.trim().toLowerCase() ?? '';
  return COMMIT_HASH_RE.test(commit) ? commit : null;
}

function parseChecklistFile(raw: string): RawChecklistFile | null {
  try {
    const data = JSON.parse(raw) as RawChecklistFile;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function checklistProjectCandidates(
  projectId: string,
  projectName: string,
  meta: Record<string, unknown>,
  localPath: string | null,
): string[] {
  const candidates: string[] = [];

  if (typeof meta.spec_project_id === 'string' && meta.spec_project_id.trim()) {
    candidates.push(meta.spec_project_id.trim());
  }

  candidates.push(projectId);
  candidates.push(projectId.replace(/_/g, '-'));
  candidates.push(projectId.replace(/-/g, '_'));

  if (localPath) {
    const base = path.basename(localPath);
    candidates.push(base, base.replace(/_/g, '-'), base.replace(/-/g, '_'));
  }

  const nameSlug = slugify(projectName, projectId);
  candidates.push(nameSlug);

  return [...new Set(candidates.filter(Boolean))];
}

function findChecklistProject(
  data: RawChecklistFile,
  candidates: string[],
) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  if (projects.length === 0 || candidates.length === 0) return null;

  // Respect candidate priority (spec_project_id first) — do not match the first
  // checklist project that appears in the set; that breaks when multiple projects
  // share the same local repo path (e.g. erp-varejo vs analise-credito).
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    const match = projects.find((project) => project.id.toLowerCase() === normalized);
    if (match) return match;
  }

  return null;
}

function mapChecklistSpecs(
  specs: NonNullable<RawChecklistFile['projects']>[number]['specs'],
): SpecChecklistSpec[] {
  if (!Array.isArray(specs)) return [];

  return specs.map((spec) => ({
    specId: spec.specId,
    specFile: spec.specFile,
    title: spec.title?.trim() || `Spec ${spec.specId}`,
    checklist: Array.isArray(spec.checklist)
      ? spec.checklist.map((item) => ({
          ac: item.ac,
          description: item.description?.trim() || item.ac,
          status: normalizeAcStatus(item.status),
          completedCommit: normalizeCommitHash(item.completedCommit),
          completedAt: null,
          issues: Array.isArray(item.issues) ? item.issues : [],
          prs: Array.isArray(item.prs) ? item.prs : [],
        }))
      : [],
  }));
}

function resolveLocalCompletionDates(
  specs: SpecChecklistSpec[],
  repositoryRoot: string,
): SpecChecklistSpec[] {
  const dates = new Map<string, string | null>();

  for (const item of specs.flatMap((spec) => spec.checklist)) {
    const commit = item.completedCommit;
    if (!commit || dates.has(commit)) continue;
    try {
      const committedAt = execFileSync(
        'git',
        ['show', '-s', '--format=%cI', '--no-show-signature', commit],
        {
          cwd: repositoryRoot,
          encoding: 'utf-8',
          timeout: 5_000,
          stdio: ['ignore', 'pipe', 'ignore'],
        },
      ).trim();
      dates.set(commit, committedAt && !Number.isNaN(Date.parse(committedAt)) ? committedAt : null);
    } catch {
      dates.set(commit, null);
    }
  }

  return specs.map((spec) => ({
    ...spec,
    checklist: spec.checklist.map((item) => ({
      ...item,
      completedAt: item.completedCommit ? (dates.get(item.completedCommit) ?? null) : null,
    })),
  }));
}

async function resolveGithubCompletionDates(
  specs: SpecChecklistSpec[],
  repoUrl: string,
  pat: string,
): Promise<SpecChecklistSpec[]> {
  const commits = [
    ...new Set(
      specs.flatMap((spec) =>
        spec.checklist.flatMap((item) => (item.completedCommit ? [item.completedCommit] : [])),
      ),
    ),
  ];
  const entries = await Promise.all(
    commits.map(async (commit) => {
      try {
        return [
          commit,
          await fetchGithubCommitDate({ repoUrl, pat, commit }),
        ] as const;
      } catch {
        return [commit, null] as const;
      }
    }),
  );
  const dates = new Map<string, string | null>(entries);

  return specs.map((spec) => ({
    ...spec,
    checklist: spec.checklist.map((item) => ({
      ...item,
      completedAt: item.completedCommit ? (dates.get(item.completedCommit) ?? null) : null,
    })),
  }));
}

function computeChecklistStats(specs: SpecChecklistSpec[]) {
  const stats = {
    total: 0,
    done: 0,
    in_progress: 0,
    blocked: 0,
    todo: 0,
  };

  for (const spec of specs) {
    for (const item of spec.checklist) {
      stats.total += 1;
      if (item.status === 'done') stats.done += 1;
      else if (item.status === 'in-progress') stats.in_progress += 1;
      else if (item.status === 'blocked') stats.blocked += 1;
      else stats.todo += 1;
    }
  }

  return stats;
}

function buildChecklistResponse(options: {
  checklistPath: string;
  updatedAt: string | null;
  globalUpdatedAt: string | null;
  projectId: string | null;
  projectName: string | null;
  specs: SpecChecklistSpec[];
  source: 'local' | 'local_repo' | 'github' | null;
}): ProjectSpecChecklistResponse {
  return {
    checklist_path: options.checklistPath,
    updated_at: options.updatedAt,
    global_updated_at: options.globalUpdatedAt,
    project_id: options.projectId,
    project_name: options.projectName,
    specs: options.specs,
    source: options.source,
    stats: computeChecklistStats(options.specs),
  };
}

function readLocalSpecChecklist(
  resolvedRoot: string,
  checklistPath: string,
  candidates: string[],
): ProjectSpecChecklistResponse {
  const checklistFile = path.join(resolvedRoot, checklistPath);
  if (!fs.existsSync(checklistFile) || !fs.statSync(checklistFile).isFile()) {
    return buildChecklistResponse({
      checklistPath,
      updatedAt: null,
      globalUpdatedAt: null,
      projectId: null,
      projectName: null,
      specs: [],
      source: 'local',
    });
  }

  const raw = fs.readFileSync(checklistFile, 'utf-8');
  const parsed = parseChecklistFile(raw);
  const stat = fs.statSync(checklistFile);

  if (!parsed) {
    return buildChecklistResponse({
      checklistPath,
      updatedAt: stat.mtime.toISOString(),
      globalUpdatedAt: null,
      projectId: null,
      projectName: null,
      specs: [],
      source: 'local',
    });
  }

  const match = findChecklistProject(parsed, candidates);
  const specs = resolveLocalCompletionDates(
    mapChecklistSpecs(match?.specs),
    resolvedRoot,
  );

  return buildChecklistResponse({
    checklistPath,
    updatedAt: stat.mtime.toISOString(),
    globalUpdatedAt:
      typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
        ? parsed.updatedAt.trim()
        : null,
    projectId: match?.id ?? null,
    projectName: match?.name ?? null,
    specs,
    source: 'local',
  });
}

export async function getProjectSpecChecklist(
  id: string,
): Promise<ProjectSpecChecklistResponse | null> {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  const data = readJsonFile(filePath);
  const meta =
    data[META_KEY] && typeof data[META_KEY] === 'object' && !Array.isArray(data[META_KEY])
      ? (data[META_KEY] as Record<string, unknown>)
      : {};

  const checklistPath =
    typeof meta.spec_checklist_path === 'string' && meta.spec_checklist_path.trim()
      ? meta.spec_checklist_path.trim()
      : DEFAULT_CHECKLIST_PATH;

  const projectName =
    typeof data.name === 'string' && data.name.trim() ? data.name.trim() : id;

  const localPath =
    typeof meta.local_path === 'string' && meta.local_path.trim()
      ? meta.local_path.trim()
      : null;

  const candidates = checklistProjectCandidates(id, projectName, meta, localPath);

  if (localPath) {
    const resolvedRoot = resolveLocalProjectPath(localPath);
    if (!resolvedRoot) {
      return buildChecklistResponse({
        checklistPath,
        updatedAt: null,
        globalUpdatedAt: null,
        projectId: null,
        projectName: null,
        specs: [],
        source: 'local',
      });
    }
    return readLocalSpecChecklist(resolvedRoot, checklistPath, candidates);
  }

  const sourceType = resolveSourceType(meta);

  if (sourceType === 'github') {
    const repo = meta.github_repo_url;
    const pat = meta.github_pat;
    const branch = meta.github_branch;
    if (!repo || !pat || !branch) {
      return buildChecklistResponse({
        checklistPath,
        updatedAt: null,
        globalUpdatedAt: null,
        projectId: null,
        projectName: null,
        specs: [],
        source: 'github',
      });
    }

    try {
      const remote = await fetchGithubTextFile({
        repoUrl: String(repo),
        pat: String(pat),
        branch: String(branch),
        filePath: checklistPath,
      });
      const parsed = parseChecklistFile(remote.content);
      const match = parsed ? findChecklistProject(parsed, candidates) : null;
      const specs = await resolveGithubCompletionDates(
        mapChecklistSpecs(match?.specs),
        String(repo),
        String(pat),
      );

      return buildChecklistResponse({
        checklistPath,
        updatedAt:
          typeof meta.last_synced_at === 'string' ? meta.last_synced_at : null,
        globalUpdatedAt:
          parsed && typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
            ? parsed.updatedAt.trim()
            : null,
        projectId: match?.id ?? null,
        projectName: match?.name ?? null,
        specs,
        source: 'github',
      });
    } catch {
      return buildChecklistResponse({
        checklistPath,
        updatedAt: null,
        globalUpdatedAt: null,
        projectId: null,
        projectName: null,
        specs: [],
        source: 'github',
      });
    }
  }

  return buildChecklistResponse({
    checklistPath,
    updatedAt: null,
    globalUpdatedAt: null,
    projectId: null,
    projectName: null,
    specs: [],
    source: null,
  });
}

export type ProjectFeatureContent = {
  specId: string;
  specFile: string;
  title: string;
  content: string;
  updated_at: string | null;
};

function specsRelativeFilePath(specFile: string): string {
  const normalized = specFile.trim().replace(/^\//, '');
  if (normalized.startsWith('.specs/')) {
    return normalized;
  }
  return path.posix.join('.specs', normalized);
}

export async function getProjectFeatureContent(
  projectId: string,
  specId: string,
): Promise<ProjectFeatureContent | null> {
  const filePath = pathForId(projectId);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  const checklist = await getProjectSpecChecklist(projectId);
  if (!checklist) {
    return null;
  }

  const spec = checklist.specs.find((item) => item.specId === specId);
  if (!spec) {
    throw new ApiError(404, 'Feature not found');
  }

  const data = readJsonFile(filePath);
  const meta =
    data[META_KEY] && typeof data[META_KEY] === 'object' && !Array.isArray(data[META_KEY])
      ? (data[META_KEY] as Record<string, unknown>)
      : {};

  const relativeSpecPath = specsRelativeFilePath(spec.specFile);
  const localPath =
    typeof meta.local_path === 'string' && meta.local_path.trim()
      ? meta.local_path.trim()
      : null;

  if (localPath) {
    const resolvedRoot = resolveLocalProjectPath(localPath);
    if (!resolvedRoot) {
      throw new ApiError(404, 'Spec file not found');
    }
    const absolutePath = path.join(resolvedRoot, relativeSpecPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new ApiError(404, 'Spec file not found');
    }
    const content = fs.readFileSync(absolutePath, 'utf-8');
    return {
      specId: spec.specId,
      specFile: spec.specFile,
      title: spec.title,
      content,
      updated_at: fs.statSync(absolutePath).mtime.toISOString(),
    };
  }

  const sourceType = resolveSourceType(meta);
  if (sourceType === 'github') {
    const repo = meta.github_repo_url;
    const pat = meta.github_pat;
    const branch = meta.github_branch;
    if (!repo || !pat || !branch) {
      throw new ApiError(404, 'Spec file not found');
    }

    try {
      const remote = await fetchGithubTextFile({
        repoUrl: String(repo),
        pat: String(pat),
        branch: String(branch),
        filePath: relativeSpecPath,
      });
      return {
        specId: spec.specId,
        specFile: spec.specFile,
        title: spec.title,
        content: remote.content,
        updated_at: null,
      };
    } catch {
      throw new ApiError(404, 'Spec file not found');
    }
  }

  throw new ApiError(404, 'Spec file not found');
}

function expandLocalPath(localPath: string): string {
  const home = process.env.HOME ?? '';
  return path.resolve(localPath.replace(/^~/, home));
}

function resolveLocalProjectsRoot(): string | null {
  const hostRoot = serverEnv.WORKSPACE_LOCAL_PROJECTS_ROOT;
  if (!hostRoot) return null;
  const home = process.env.HOME ?? '';
  return path.resolve(hostRoot.replace(/^~/, home));
}

function toRelativeLocalProjectPath(
  localPath: string | null | undefined,
): string | null {
  if (!localPath || !localPath.trim()) return null;

  const resolved = expandLocalPath(localPath.trim());
  const hostRootResolved = resolveLocalProjectsRoot();
  if (!hostRootResolved) return localPath.trim();

  const relative = path.relative(hostRootResolved, resolved);
  return relative || '.';
}

function resolveLocalProjectPath(localPath: string): string | null {
  const resolved = expandLocalPath(localPath);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return resolved;
  }

  const hostRootResolved = resolveLocalProjectsRoot();
  if (!hostRootResolved) {
    return null;
  }

  let relative: string;

  if (resolved === hostRootResolved) {
    relative = '';
  } else if (resolved.startsWith(hostRootResolved + path.sep)) {
    relative = path.relative(hostRootResolved, resolved);
  } else {
    const workspaceMatch = localPath.match(/(?:^|\/)workspace\/(.+)$/);
    relative = workspaceMatch?.[1] ?? path.basename(resolved);
  }

  const mapped = path.join(LOCAL_PROJECTS_MOUNT, relative);
  if (fs.existsSync(mapped) && fs.statSync(mapped).isDirectory()) {
    return mapped;
  }

  return null;
}

function validateProjectCreate(data: ProjectCreateInput) {
  if (data.source_type === 'local') {
    const hasContent =
      data.json_content !== undefined &&
      data.json_content !== null &&
      data.json_content !== '';
    if (!hasContent) {
      throw new ApiError(
        400,
        'Informe os parâmetros do projeto (incluindo name).',
      );
    }
    if (typeof data.json_content === 'object' && data.json_content !== null) {
      const name = data.json_content.name;
      if (typeof name !== 'string' || !name.trim()) {
        throw new ApiError(400, 'O campo "name" é obrigatório.');
      }
    }
    return;
  }

  if (data.source_type === 'local_repo') {
    requireLocalPath(data.local_path);
    const hasContent =
      data.json_content !== undefined &&
      data.json_content !== null &&
      data.json_content !== '';
    if (!hasContent) {
      throw new ApiError(
        400,
        'Informe os parâmetros do projeto (incluindo name).',
      );
    }
    if (typeof data.json_content === 'object' && data.json_content !== null) {
      const name = data.json_content.name;
      if (typeof name !== 'string' || !name.trim()) {
        throw new ApiError(400, 'O campo "name" é obrigatório.');
      }
    }
    return;
  }

  const missing = (
    [
      ['github_repo_url', data.github_repo_url],
      ['github_pat', data.github_pat],
      ['github_branch', data.github_branch],
    ] as const
  )
    .filter(([, value]) => !value || !String(value).trim())
    .map(([field]) => field);

  if (missing.length > 0) {
    throw new ApiError(
      400,
      `Campos obrigatórios para GitHub: ${missing.join(', ')}`,
    );
  }

  const hasContent =
    data.json_content !== undefined &&
    data.json_content !== null &&
    data.json_content !== '';
  if (!hasContent) {
    throw new ApiError(
      400,
      'Informe os parâmetros do projeto (incluindo name).',
    );
  }
  if (typeof data.json_content === 'object' && data.json_content !== null) {
    const name = data.json_content.name;
    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'O campo "name" é obrigatório.');
    }
  }
}

function listProjectFiles(): string[] {
  const root = projectsFolder();
  return fs
    .readdirSync(root)
    .filter(
      (name) =>
        name.endsWith('.json') &&
        !name.startsWith('.') &&
        !name.endsWith('.spec-checklist.json') &&
        !name.endsWith('.tasks.json') &&
        !name.endsWith('.checklist.json'),
    )
    .map((name) => path.join(root, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: 'base' }));
}

function pathForId(projectId: string): string {
  const slug = slugify(projectId, 'projeto');
  return path.join(projectsFolder(), `${slug}.json`);
}

function backupPathForProjectFile(filePath: string): string {
  const backupPath = `${filePath}.backup`;
  if (!fs.existsSync(backupPath)) {
    return backupPath;
  }

  let suffix = 2;
  while (fs.existsSync(`${backupPath}.${suffix}`)) {
    suffix += 1;
  }
  return `${backupPath}.${suffix}`;
}

function writeProjectFile(name: string, jsonData: Record<string, unknown>): string {
  const root = projectsFolder();
  const filePath = path.join(root, `${slugify(name, 'projeto')}.json`);

  if (fs.existsSync(filePath)) {
    throw new ApiError(
      409,
      `Já existe um arquivo ${path.basename(filePath)} em ${root}. Altere o nome ou remova o projeto existente.`,
    );
  }

  try {
    overwriteJsonFile(filePath, jsonData);
  } catch (error) {
    throw new ApiError(
      400,
      `Não foi possível criar o arquivo do projeto: ${error instanceof Error ? error.message : error}`,
    );
  }

  return filePath;
}

function fileToResponse(filePath: string): ProjectResponse {
  const data = readJsonFile(filePath);
  const meta =
    data[META_KEY] && typeof data[META_KEY] === 'object' && !Array.isArray(data[META_KEY])
      ? (data[META_KEY] as Record<string, unknown>)
      : {};
  const publicData = Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== META_KEY),
  );
  const name =
    typeof publicData.name === 'string' && publicData.name.trim()
      ? publicData.name.trim()
      : path.basename(filePath, '.json');

  const sourceType = resolveSourceType(meta);

  let lastSyncedAt: string | null = null;
  if (typeof meta.last_synced_at === 'string' && meta.last_synced_at) {
    const parsed = new Date(meta.last_synced_at);
    lastSyncedAt = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const stat = fs.statSync(filePath);

  return {
    id: path.basename(filePath, '.json'),
    name,
    source_type: sourceType,
    json_data: publicData,
    local_file_path: filePath,
    github_repo_url: (meta.github_repo_url as string | undefined) ?? null,
    github_branch: (meta.github_branch as string | undefined) ?? null,
    github_file_path: (meta.github_file_path as string | undefined) ?? null,
    local_path: (meta.local_path as string | undefined) ?? null,
    local_path_relative: toRelativeLocalProjectPath(
      (meta.local_path as string | undefined) ?? null,
    ),
    spec_project_id: (meta.spec_project_id as string | undefined) ?? null,
    spec_checklist_path:
      typeof meta.spec_checklist_path === 'string' && meta.spec_checklist_path.trim()
        ? meta.spec_checklist_path.trim()
        : null,
    tasks_path: resolveProjectTasksPathForResponse(meta, sourceType),
    has_github_pat: Boolean(meta.github_pat),
    last_synced_at: lastSyncedAt,
    created_at: stat.birthtime.toISOString(),
    updated_at: stat.mtime.toISOString(),
  };
}

function withMeta(
  jsonData: Record<string, unknown>,
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const body = Object.fromEntries(
    Object.entries(jsonData).filter(([key]) => key !== META_KEY),
  );
  return { ...body, [META_KEY]: meta };
}

function overwriteJsonFile(filePath: string, jsonData: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(jsonData, null, 2)}\n`,
    'utf-8',
  );
}

function readJsonFile(filePath: string): Record<string, unknown> {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(
        400,
        `O arquivo ${path.basename(filePath)} deve conter um objeto JSON.`,
      );
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof SyntaxError) {
      throw new ApiError(
        400,
        `Arquivo inválido (${path.basename(filePath)}): ${error.message}`,
      );
    }
    throw new ApiError(
      400,
      `Não foi possível ler ${path.basename(filePath)}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function parseJsonContent(
  jsonContent: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (jsonContent === undefined || jsonContent === null || jsonContent === '') {
    throw new ApiError(400, 'Conteúdo JSON é obrigatório.');
  }
  if (typeof jsonContent === 'object') {
    return jsonContent;
  }
  try {
    const data = JSON.parse(jsonContent);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError(400, 'O JSON do projeto deve ser um objeto.');
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'JSON inválido.');
  }
}

function requireNameFromJson(jsonData: Record<string, unknown>): string {
  const name = jsonData.name;
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }
  throw new ApiError(400, 'O JSON do projeto deve conter o campo "name".');
}

function requireLocalPath(localPath: string | null | undefined): string {
  const trimmed = typeof localPath === 'string' ? localPath.trim() : '';
  if (!trimmed) {
    throw new ApiError(400, 'Informe o caminho local do repositório.');
  }
  return trimmed;
}

function stripRepoFields(jsonData: Record<string, unknown>): Record<string, unknown> {
  const body = { ...jsonData };
  delete body.repo;
  return body;
}

function resolveSourceType(meta: Record<string, unknown>): ProjectSourceType {
  const explicit = meta.source_type;
  if (explicit === 'github') return 'github';
  if (explicit === 'local_repo') return 'local_repo';
  if (explicit === 'local') {
    if (meta.local_path) return 'local_repo';
    return 'local';
  }
  if (meta.github_repo_url) return 'github';
  if (meta.local_path) return 'local_repo';
  return 'local';
}

function applyProjectMetaUpdates(
  meta: Record<string, unknown>,
  data: ProjectUpdateInput,
): void {
  if (data.source_type !== undefined) {
    meta.source_type = data.source_type;
    if (data.source_type === 'local') {
      delete meta.local_path;
      delete meta.github_repo_url;
      delete meta.github_pat;
      delete meta.github_branch;
      delete meta.github_file_path;
      delete meta.last_synced_at;
      delete meta.tasks_path;
    } else if (data.source_type === 'local_repo') {
      delete meta.github_repo_url;
      delete meta.github_pat;
      delete meta.github_branch;
      delete meta.github_file_path;
      delete meta.last_synced_at;
    } else if (data.source_type === 'github') {
      delete meta.local_path;
    }
  }

  if (data.spec_project_id !== undefined) {
    const trimmed =
      data.spec_project_id === null ? '' : String(data.spec_project_id).trim();
    if (trimmed) {
      meta.spec_project_id = trimmed;
    } else {
      delete meta.spec_project_id;
    }
  }

  if (data.spec_checklist_path !== undefined) {
    const trimmed =
      data.spec_checklist_path === null
        ? ''
        : String(data.spec_checklist_path).trim();
    if (trimmed) {
      meta.spec_checklist_path = trimmed;
    } else {
      delete meta.spec_checklist_path;
    }
  }

  if (data.tasks_path !== undefined) {
    delete meta.tasks_path;
    delete meta.checklist_path;
  }

  for (const key of [
    'local_path',
    'github_repo_url',
    'github_pat',
    'github_branch',
  ] as const) {
    if (data[key] === undefined) continue;
    if (data[key] === null || !String(data[key]).trim()) {
      delete meta[key];
      continue;
    }
    meta[key] = String(data[key]).trim();
  }

  const sourceType = resolveSourceType(meta);

  if (sourceType === 'local_repo') {
    const localPath =
      typeof meta.local_path === 'string' ? meta.local_path.trim() : '';
    if (!localPath) {
      throw new ApiError(400, 'Informe o caminho local do repositório.');
    }
    meta.local_path = localPath;
  }

  if (sourceType === 'github') {
    const missing: string[] = (
      [
        ['github_repo_url', meta.github_repo_url],
        ['github_branch', meta.github_branch],
      ] as const
    )
      .filter(([, value]) => !value || !String(value).trim())
      .map(([field]) => field);

    if (!meta.github_pat || !String(meta.github_pat).trim()) {
      missing.push('github_pat');
    }

    if (missing.length > 0) {
      throw new ApiError(
        400,
        `Campos obrigatórios para GitHub: ${missing.join(', ')}`,
      );
    }

    if (
      typeof meta.spec_checklist_path !== 'string' ||
      !meta.spec_checklist_path.trim()
    ) {
      meta.spec_checklist_path = DEFAULT_CHECKLIST_PATH;
    }

    delete meta.github_file_path;
    delete meta.tasks_path;
    delete meta.checklist_path;
  }

  meta.source_type = sourceType;
}

function renameProjectFile(oldId: string, newId: string): string {
  const oldPath = pathForId(oldId);
  const newPath = pathForId(newId);

  if (oldPath === newPath) {
    return oldPath;
  }

  if (fs.existsSync(newPath)) {
    throw new ApiError(
      409,
      `Já existe um projeto com id "${newId}". Escolha outro identificador.`,
    );
  }

  fs.renameSync(oldPath, newPath);

  const oldSidecar = legacyLocalChecklistPathForId(oldId);
  if (fs.existsSync(oldSidecar) && fs.statSync(oldSidecar).isFile()) {
    fs.unlinkSync(oldSidecar);
  }

  return newPath;
}

export type ProjectConsumerConnection = {
  project_id: string;
  local_path: string;
  consumer_api_token: string;
  project_ids: string[];
};

export function getProjectConsumerConnection(projectId: string): ProjectConsumerConnection | null {
  const project = getProject(projectId);
  if (!project?.local_path) {
    return null;
  }

  rebuildConsumerTokenRegistry();
  const token = getConsumerTokenForProject(projectId);
  if (!token) {
    return null;
  }

  const entry = readConsumerTokenIndex()[token];
  return {
    project_id: projectId,
    local_path: project.local_path,
    consumer_api_token: token,
    project_ids: entry?.project_ids ?? [projectId],
  };
}

/** Assign consumer tokens per local_path; sync index for middleware. */
export function rebuildConsumerTokenRegistry(): void {
  const byPath = new Map<string, { token: string; projectIds: string[] }>();
  const newlyIssued: Array<{ projectId: string; localPath: string; token: string }> = [];

  for (const filePath of listProjectFiles()) {
    const projectId = path.basename(filePath, '.json');
    const data = readJsonFile(filePath);
    const meta =
      data[META_KEY] && typeof data[META_KEY] === 'object' && !Array.isArray(data[META_KEY])
        ? { ...(data[META_KEY] as Record<string, unknown>) }
        : {};

    const rawLocalPath =
      typeof meta.local_path === 'string' ? meta.local_path.trim() : '';
    if (!rawLocalPath) {
      if (meta.consumer_api_token) {
        delete meta.consumer_api_token;
        const body = Object.fromEntries(
          Object.entries(data).filter(([key]) => key !== META_KEY),
        );
        overwriteJsonFile(filePath, withMeta(body, meta));
      }
      continue;
    }

    const localPath = normalizeLocalPath(rawLocalPath);
    const existing = byPath.get(localPath);
    const hadToken =
      typeof meta.consumer_api_token === 'string' && meta.consumer_api_token.trim();

    let token = hadToken
      ? (meta.consumer_api_token as string).trim()
      : existing?.token ?? generateConsumerToken();

    if (!hadToken) {
      newlyIssued.push({ projectId, localPath: rawLocalPath, token });
    }

    if (!meta.consumer_api_token || meta.consumer_api_token !== token) {
      meta.consumer_api_token = token;
      const body = Object.fromEntries(
        Object.entries(data).filter(([key]) => key !== META_KEY),
      );
      overwriteJsonFile(filePath, withMeta(body, meta));
    }

    if (existing) {
      if (!existing.projectIds.includes(projectId)) {
        existing.projectIds.push(projectId);
      }
    } else {
      byPath.set(localPath, { token, projectIds: [projectId] });
    }
  }

  const index: Record<string, { local_path: string; project_ids: string[] }> = {};
  for (const [localPath, { token, projectIds }] of byPath.entries()) {
    index[token] = {
      local_path: localPath,
      project_ids: [...new Set(projectIds)].sort(),
    };
  }

  writeConsumerTokenIndex(index);
  syncConsumerTokensToEnv();

  for (const item of newlyIssued) {
    logConsumerTokenBanner(item.projectId, item.localPath, item.token);
  }
}
