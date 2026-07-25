import { execFileSync } from 'node:child_process';
import fs from 'fs';
import path from 'path';

import { ApiError } from './api-error';
import { LOCAL_PROJECTS_MOUNT, serverEnv } from './env';
import {
  fetchGithubCommitDate,
  fetchGithubJsonFile,
  fetchGithubTextFile,
} from './github-json';
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
  spec_project_id: string | null;
  spec_checklist_path: string | null;
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
  source_type?: ProjectSourceType;
  new_id?: string | null;
  local_path?: string | null;
  spec_project_id?: string | null;
  spec_checklist_path?: string | null;
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

  const sidecarPath = localChecklistPathForId(id);
  if (fs.existsSync(sidecarPath) && fs.statSync(sidecarPath).isFile()) {
    fs.unlinkSync(sidecarPath);
  }

  return true;
}

export type LocalChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type LocalChecklistDocument = {
  version: 1;
  items: LocalChecklistItem[];
};

const LOCAL_CHECKLIST_LABEL_MAX = 200;

function localChecklistPathForId(projectId: string): string {
  const slug = slugify(projectId, 'projeto');
  return path.join(projectsFolder(), `${slug}.spec-checklist.json`);
}

function emptyLocalChecklist(): LocalChecklistDocument {
  return { version: 1, items: [] };
}

function assertLocalProject(id: string): void {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new ApiError(404, 'Project not found');
  }

  const data = readJsonFile(filePath);
  const meta =
    data[META_KEY] && typeof data[META_KEY] === 'object' && !Array.isArray(data[META_KEY])
      ? (data[META_KEY] as Record<string, unknown>)
      : {};

  if (resolveSourceType(meta) !== 'local') {
    throw new ApiError(
      400,
      'Checklist local simples está disponível apenas para projetos Manual (sem repositório).',
    );
  }
}

function parseLocalChecklistDocument(raw: unknown): LocalChecklistDocument {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'O checklist local deve ser um objeto JSON.');
  }

  const data = raw as Record<string, unknown>;
  if (data.version !== 1) {
    throw new ApiError(400, 'version do checklist local deve ser 1.');
  }
  if (!Array.isArray(data.items)) {
    throw new ApiError(400, 'items do checklist local deve ser um array.');
  }

  const seen = new Set<string>();
  const items: LocalChecklistItem[] = data.items.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ApiError(400, `Item ${index} do checklist local é inválido.`);
    }
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!id) {
      throw new ApiError(400, `Item ${index} precisa de id não vazio.`);
    }
    if (seen.has(id)) {
      throw new ApiError(400, `id duplicado no checklist local: ${id}`);
    }
    seen.add(id);
    if (!label) {
      throw new ApiError(400, `Item ${index} precisa de label não vazia.`);
    }
    if (label.length > LOCAL_CHECKLIST_LABEL_MAX) {
      throw new ApiError(
        400,
        `Label do item ${index} excede ${LOCAL_CHECKLIST_LABEL_MAX} caracteres.`,
      );
    }
    if (typeof row.done !== 'boolean') {
      throw new ApiError(400, `Item ${index} precisa de done booleano.`);
    }
    return { id, label, done: row.done };
  });

  return { version: 1, items };
}

export function getLocalChecklist(id: string): LocalChecklistDocument {
  assertLocalProject(id);

  const sidecarPath = localChecklistPathForId(id);
  if (!fs.existsSync(sidecarPath) || !fs.statSync(sidecarPath).isFile()) {
    return emptyLocalChecklist();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(sidecarPath, 'utf-8'));
    return parseLocalChecklistDocument(raw);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof SyntaxError) {
      throw new ApiError(
        400,
        `Arquivo inválido (${path.basename(sidecarPath)}): ${error.message}`,
      );
    }
    throw new ApiError(
      400,
      `Não foi possível ler ${path.basename(sidecarPath)}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

export function saveLocalChecklist(
  id: string,
  payload: unknown,
): LocalChecklistDocument {
  assertLocalProject(id);
  const document = parseLocalChecklistDocument(payload);
  const sidecarPath = localChecklistPathForId(id);
  overwriteJsonFileAtomic(sidecarPath, document as unknown as Record<string, unknown>);
  return document;
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
    .filter(
      (name) =>
        name.endsWith('.json') &&
        !name.startsWith('.') &&
        !name.endsWith('.spec-checklist.json'),
    )
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
    spec_project_id: (meta.spec_project_id as string | undefined) ?? null,
    spec_checklist_path:
      typeof meta.spec_checklist_path === 'string' && meta.spec_checklist_path.trim()
        ? meta.spec_checklist_path.trim()
        : null,
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

  for (const key of [
    'local_path',
    'github_repo_url',
    'github_pat',
    'github_branch',
    'github_file_path',
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
        ['github_file_path', meta.github_file_path],
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

  const oldSidecar = localChecklistPathForId(oldId);
  const newSidecar = localChecklistPathForId(newId);
  if (fs.existsSync(oldSidecar) && fs.statSync(oldSidecar).isFile()) {
    fs.renameSync(oldSidecar, newSidecar);
  }

  return newPath;
}
