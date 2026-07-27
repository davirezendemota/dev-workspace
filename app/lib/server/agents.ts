import fs from 'fs';
import path from 'path';

import { ApiError } from './api-error';
import { slugify } from './slugify';
import { agentsFolder } from './workspace-config';

export type AgentResponse = {
  id: string;
  name: string;
  content: string;
  local_file_path: string;
  created_at: string | null;
  updated_at: string | null;
};

export type AgentCreateInput = {
  name: string;
  content?: string;
};

export type AgentUpdateInput = {
  name?: string | null;
  content?: string | null;
};

export function listAgents(skip = 0, limit = 100) {
  const files = listAgentFiles();
  const items = files.map((filePath) => fileToResponse(filePath));
  return {
    items: items.slice(skip, skip + limit),
    total: items.length,
    skip,
    limit,
  };
}

export function getAgent(id: string): AgentResponse | null {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  return fileToResponse(filePath);
}

export function createAgent(data: AgentCreateInput): AgentResponse {
  const name = data.name.trim();
  const content = normalizeContent(name, data.content ?? '');
  const filePath = writeAgentFile(name, content);
  return fileToResponse(filePath);
}

export function updateAgent(
  id: string,
  data: AgentUpdateInput,
): AgentResponse | null {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  const currentContent = readMarkdownFile(filePath);
  const currentName = extractName(currentContent, path.basename(filePath, '.md'));
  const name = data.name !== undefined && data.name !== null ? data.name.trim() : currentName;
  const content =
    data.content !== undefined && data.content !== null ? data.content : currentContent;
  const normalized = normalizeContent(name, content);

  let targetPath = filePath;
  if (data.name !== undefined && data.name !== null) {
    const slug = slugify(name, 'agente');
    targetPath = path.join(agentsFolder(), `${slug}.md`);
    if (targetPath !== filePath && fs.existsSync(targetPath)) {
      throw new ApiError(
        409,
        `Já existe um arquivo ${path.basename(targetPath)} em ${agentsFolder()}.`,
      );
    }
  }

  overwriteMarkdownFile(targetPath, normalized);
  if (targetPath !== filePath) {
    fs.unlinkSync(filePath);
  }
  return fileToResponse(targetPath);
}

export function deleteAgent(id: string): boolean {
  const filePath = pathForId(id);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  fs.unlinkSync(filePath);
  return true;
}

function listAgentFiles(): string[] {
  const root = agentsFolder();
  return fs
    .readdirSync(root)
    .filter((name) => name.endsWith('.md') && !name.startsWith('.'))
    .map((name) => path.join(root, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function pathForId(agentId: string): string {
  const slug = slugify(agentId, 'agente');
  return path.join(agentsFolder(), `${slug}.md`);
}

function writeAgentFile(name: string, content: string): string {
  const root = agentsFolder();
  const filePath = path.join(root, `${slugify(name, 'agente')}.md`);

  if (fs.existsSync(filePath)) {
    throw new ApiError(
      409,
      `Já existe um arquivo ${path.basename(filePath)} em ${root}. Altere o nome ou remova o agente existente.`,
    );
  }

  try {
    overwriteMarkdownFile(filePath, content);
  } catch (error) {
    throw new ApiError(
      400,
      `Não foi possível criar o arquivo do agente: ${error instanceof Error ? error.message : error}`,
    );
  }

  return filePath;
}

function fileToResponse(filePath: string): AgentResponse {
  const content = readMarkdownFile(filePath);
  const name = extractName(content, path.basename(filePath, '.md'));
  const stat = fs.statSync(filePath);

  return {
    id: path.basename(filePath, '.md'),
    name,
    content,
    local_file_path: filePath,
    created_at: stat.birthtime.toISOString(),
    updated_at: stat.mtime.toISOString(),
  };
}

function overwriteMarkdownFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf-8');
}

function readMarkdownFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new ApiError(
      400,
      `Não foi possível ler ${path.basename(filePath)}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function extractName(content: string, fallback: string): string {
  for (const line of content.split('\n')) {
    const stripped = line.trim();
    if (stripped.startsWith('# ')) {
      const title = stripped.slice(2).trim();
      if (title) return title;
    }
  }
  return fallback.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeContent(name: string, content: string): string {
  const body = content.trim();
  const heading = `# ${name.trim()}`;
  if (!body) return `${heading}\n`;
  const firstLine = body.split('\n')[0]?.trim() ?? '';
  if (firstLine.startsWith('# ')) {
    return body.endsWith('\n') ? body : `${body}\n`;
  }
  return `${heading}\n\n${body}\n`;
}
