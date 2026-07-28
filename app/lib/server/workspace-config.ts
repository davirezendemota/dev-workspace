import fs from 'fs';
import path from 'path';

import { serverEnv } from './env';
import {
  DEFAULT_AI_PROJECT_SUMMARY_PROMPT,
  resolveAiProjectSummaryPrompt,
} from './project-ai-summary-prompt';

import {
  isUiMode,
  isUiTheme,
  type UiMode,
  type UiTheme,
} from '@/app/lib/theme';

type WorkspaceConfig = {
  projects_folder: string;
  agents_folder: string;
  ai_provider: string;
  ai_model: string;
  ai_api_token: string;
  ai_project_summary_prompt: string;
  ui_theme: UiTheme;
  ui_mode: UiMode;
};

const configDir = path.dirname(serverEnv.WORKSPACE_CONFIG_PATH);

const DEFAULT_CONFIG: WorkspaceConfig = {
  projects_folder: path.join(configDir, 'projects'),
  agents_folder: path.join(configDir, 'agents'),
  ai_provider: '',
  ai_model: '',
  ai_api_token: '',
  ai_project_summary_prompt: '',
  ui_theme: 'classic',
  ui_mode: 'light',
};

export function configPath(): string {
  return serverEnv.WORKSPACE_CONFIG_PATH;
}

function ensureConfigFile(): string {
  const filePath = configPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`,
      'utf-8',
    );
  }
  return filePath;
}

export function loadConfig(): WorkspaceConfig & Record<string, unknown> {
  const filePath = ensureConfigFile();
  let data: Record<string, unknown> = {};

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    data = {};
  }

  const legacyMode = isUiMode(data.ui_theme) ? data.ui_theme : null;
  const merged = { ...DEFAULT_CONFIG, ...data };
  if (!merged.projects_folder) {
    merged.projects_folder = DEFAULT_CONFIG.projects_folder;
  }
  if (!merged.agents_folder) {
    merged.agents_folder = DEFAULT_CONFIG.agents_folder;
  }
  if (merged.ai_provider === undefined || merged.ai_provider === null) {
    merged.ai_provider = DEFAULT_CONFIG.ai_provider;
  }
  if (merged.ai_model === undefined || merged.ai_model === null) {
    merged.ai_model = DEFAULT_CONFIG.ai_model;
  }
  if (merged.ai_api_token === undefined || merged.ai_api_token === null) {
    merged.ai_api_token = DEFAULT_CONFIG.ai_api_token;
  }
  if (
    merged.ai_project_summary_prompt === undefined ||
    merged.ai_project_summary_prompt === null
  ) {
    merged.ai_project_summary_prompt = DEFAULT_CONFIG.ai_project_summary_prompt;
  }
  if (!isUiTheme(merged.ui_theme)) {
    merged.ui_theme = DEFAULT_CONFIG.ui_theme;
  }
  if (!isUiMode(merged.ui_mode)) {
    merged.ui_mode = legacyMode ?? DEFAULT_CONFIG.ui_mode;
  }
  return merged;
}

export type AiConfig = {
  provider: string;
  model: string;
  apiToken: string;
};

export function aiConfig(): AiConfig {
  const config = loadConfig();
  return {
    provider: String(config.ai_provider ?? '').trim(),
    model: String(config.ai_model ?? '').trim(),
    apiToken: String(config.ai_api_token ?? '').trim(),
  };
}

export function isAiConfigured(): boolean {
  const { provider, model, apiToken } = aiConfig();
  return Boolean(provider && model && apiToken);
}

export function projectAiSummaryPrompt(): string {
  const config = loadConfig();
  return resolveAiProjectSummaryPrompt(
    String(config.ai_project_summary_prompt ?? ''),
  );
}

export function defaultProjectAiSummaryPrompt(): string {
  return DEFAULT_AI_PROJECT_SUMMARY_PROMPT;
}

export function saveConfig(updates: Record<string, unknown>): WorkspaceConfig {
  const current = loadConfig();
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      current[key] = value;
    }
  }

  const filePath = ensureConfigFile();
  fs.writeFileSync(filePath, `${JSON.stringify(current, null, 2)}\n`, 'utf-8');
  return current;
}

export function projectsFolder(): string {
  const folder = path.resolve(
    String(loadConfig().projects_folder).replace(/^~/, process.env.HOME ?? ''),
  );
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

export function agentsFolder(): string {
  const folder = path.resolve(
    String(loadConfig().agents_folder).replace(/^~/, process.env.HOME ?? ''),
  );
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}
