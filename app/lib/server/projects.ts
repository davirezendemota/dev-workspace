import fs from 'fs';
import path from 'path';

import { ApiError } from './api-error';
import { LOCAL_PROJECTS_MOUNT, serverEnv } from './env';
import { fetchGithubJsonFile } from './github-json';
import { slugify } from './slugify';
import { projectsFolder } from './workspace-config';

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
  has_github_pat: boolean;
  last_synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProjectCreateInput = {
  source_type: ProjectSourceType;
  json_content?: string | Record<string, unknown> | null;
  local_path?: string | null;
  github_repo_url?: string | null;
  github_pat?: string | null;
  github_branch?: string | null;
  github_file_path?: string | null;
};

export type ProjectUpdateInput = {
  json_content?: string | Record<string, unknown> | null;
  local_path?: string | null;
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
    return fileToResponse(filePath);
  }

  try {
    const jsonData = await fetchGithubJsonFile({
      repoUrl: data.github_repo_url!,
      pat: data.github_pat!,
      branch: data.github_branch!,
      filePath: data.github_file_path!,
    });
    const name = requireNameFromJson(jsonData);
    const payload = withMeta(jsonData, {
      source_type: 'github',
      github_repo_url: data.github_repo_url!.trim(),
      github_pat: data.github_pat!.trim(),
      github_branch: data.github_branch!.trim(),
      github_file_path: data.github_file_path!.trim(),
      last_synced_at: new Date().toISOString(),
    });
    const filePath = writeProjectFile(name, payload);
    return fileToResponse(filePath);
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error ? error.message : 'Falha ao buscar projeto no GitHub.',
    );
  }
}

export function updateProject(
  id: string,
  data: ProjectUpdateInput,
): ProjectResponse | null {
  const filePath = pathForId(id);
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
    for (const key of [
      'local_path',
      'github_repo_url',
      'github_pat',
      'github_branch',
      'github_file_path',
    ] as const) {
      if (data[key] !== undefined && data[key] !== null) {
        meta[key] = String(data[key]).trim();
      }
    }
    if (!meta.source_type) {
      meta.source_type = meta.github_repo_url
        ? 'github'
        : meta.local_path
          ? 'local_repo'
          : 'local';
    }
    overwriteJsonFile(filePath, withMeta(body, meta));
    return fileToResponse(filePath);
  }

  const body = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== META_KEY),
  );
  for (const key of [
    'local_path',
    'github_repo_url',
    'github_pat',
    'github_branch',
    'github_file_path',
  ] as const) {
    if (data[key] !== undefined && data[key] !== null) {
      meta[key] = String(data[key]).trim();
    }
  }
  if (!meta.source_type) {
    meta.source_type = meta.github_repo_url
      ? 'github'
      : meta.local_path
        ? 'local_repo'
        : 'local';
  }
  overwriteJsonFile(filePath, withMeta(body, meta));
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
  const remoteFilePath = meta.github_file_path;
  if (!repo || !pat || !branch || !remoteFilePath) {
    throw new ApiError(400, 'Configuração GitHub incompleta para sincronizar.');
  }

  try {
    const jsonData = await fetchGithubJsonFile({
      repoUrl: String(repo),
      pat: String(pat),
      branch: String(branch),
      filePath: String(remoteFilePath),
    });
    requireNameFromJson(jsonData);
    meta.last_synced_at = new Date().toISOString();
    const body = Object.fromEntries(
      Object.entries(jsonData).filter(([key]) => key !== META_KEY),
    );
    overwriteJsonFile(filePath, withMeta(body, meta));
    return fileToResponse(filePath);
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error ? error.message : 'Falha ao sincronizar projeto.',
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
  fs.unlinkSync(filePath);
  return true;
}

export type AcStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

export type SpecChecklistAc = {
  ac: string;
  description: string;
  status: AcStatus;
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

function findChecklistProject(data: RawChecklistFile, candidates: string[]) {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const normalized = new Set(candidates.map((id) => id.toLowerCase()));

  return (
    projects.find((project) => normalized.has(project.id.toLowerCase())) ?? null
  );
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
          issues: Array.isArray(item.issues) ? item.issues : [],
          prs: Array.isArray(item.prs) ? item.prs : [],
        }))
      : [],
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
  const specs = mapChecklistSpecs(match?.specs);

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
      const { fetchGithubTextFile } = await import('./github-json');
      const remote = await fetchGithubTextFile({
        repoUrl: String(repo),
        pat: String(pat),
        branch: String(branch),
        filePath: checklistPath,
      });
      const parsed = parseChecklistFile(remote.content);
      const match = parsed ? findChecklistProject(parsed, candidates) : null;
      const specs = mapChecklistSpecs(match?.specs);

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

function resolveLocalProjectPath(localPath: string): string | null {
  const home = process.env.HOME ?? '';
  const expanded = localPath.replace(/^~/, home);
  const resolved = path.resolve(expanded);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return resolved;
  }

  const hostRoot = serverEnv.WORKSPACE_LOCAL_PROJECTS_ROOT;
  if (!hostRoot) {
    return null;
  }

  const hostRootResolved = path.resolve(hostRoot.replace(/^~/, home));
  let relative: string;

  if (resolved === hostRootResolved) {
    relative = '';
  } else if (resolved.startsWith(hostRootResolved + path.sep)) {
    relative = path.relative(hostRootResolved, resolved);
  } else {
    const workspaceMatch = expanded.match(/(?:^|\/)workspace\/(.+)$/);
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
      ['github_file_path', data.github_file_path],
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
}

function listProjectFiles(): string[] {
  const root = projectsFolder();
  return fs
    .readdirSync(root)
    .filter((name) => name.endsWith('.json') && !name.startsWith('.'))
    .map((name) => path.join(root, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: 'base' }));
}

function pathForId(projectId: string): string {
  const slug = slugify(projectId, 'projeto');
  return path.join(projectsFolder(), `${slug}.json`);
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
