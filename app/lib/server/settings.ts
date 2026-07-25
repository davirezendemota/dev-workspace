import fs from 'fs';

import { ApiError } from './api-error';
import {
  configPath,
  defaultProjectAiSummaryPrompt,
  loadConfig,
  saveConfig,
} from './workspace-config';

export type SettingsResponse = {
  projects_folder: string;
  agents_folder: string;
  config_path: string;
  ai_provider: string;
  ai_model: string;
  has_ai_token: boolean;
  ai_project_summary_prompt: string;
  default_ai_project_summary_prompt: string;
  uses_custom_ai_project_summary_prompt: boolean;
};

export type SettingsUpdateInput = {
  projects_folder?: string | null;
  agents_folder?: string | null;
  ai_provider?: string | null;
  ai_model?: string | null;
  ai_api_token?: string | null;
  ai_project_summary_prompt?: string | null;
};

export function getSettings(): SettingsResponse {
  const config = loadConfig();
  const token = String(config.ai_api_token ?? '').trim();
  const customPrompt = String(config.ai_project_summary_prompt ?? '').trim();
  return {
    projects_folder: String(config.projects_folder),
    agents_folder: String(config.agents_folder),
    config_path: configPath(),
    ai_provider: String(config.ai_provider ?? ''),
    ai_model: String(config.ai_model ?? ''),
    has_ai_token: Boolean(token),
    ai_project_summary_prompt: customPrompt,
    default_ai_project_summary_prompt: defaultProjectAiSummaryPrompt(),
    uses_custom_ai_project_summary_prompt: Boolean(customPrompt),
  };
}

export function updateSettings(data: SettingsUpdateInput): SettingsResponse {
  const updates: Record<string, string> = {};

  if (data.projects_folder !== undefined && data.projects_folder !== null) {
    updates.projects_folder = validateFolder(data.projects_folder, 'projetos');
  }

  if (data.agents_folder !== undefined && data.agents_folder !== null) {
    updates.agents_folder = validateFolder(data.agents_folder, 'agentes');
  }

  if (data.ai_provider !== undefined && data.ai_provider !== null) {
    updates.ai_provider = data.ai_provider.trim();
  }

  if (data.ai_model !== undefined && data.ai_model !== null) {
    updates.ai_model = data.ai_model.trim();
  }

  if (
    data.ai_api_token !== undefined &&
    data.ai_api_token !== null &&
    data.ai_api_token.trim()
  ) {
    updates.ai_api_token = data.ai_api_token.trim();
  }

  if (data.ai_project_summary_prompt !== undefined) {
    if (data.ai_project_summary_prompt === null) {
      updates.ai_project_summary_prompt = '';
    } else {
      const prompt = data.ai_project_summary_prompt.trim();
      if (!prompt) {
        updates.ai_project_summary_prompt = '';
      } else if (prompt.length > 4000) {
        throw new ApiError(
          400,
          'O prompt do resumo de projetos deve ter no máximo 4000 caracteres.',
        );
      } else {
        updates.ai_project_summary_prompt = prompt;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'Informe ao menos um campo para atualizar.');
  }

  saveConfig(updates);
  return getSettings();
}

function validateFolder(rawPath: string, label: string): string {
  const folder = rawPath.trim().replace(/^~/, process.env.HOME ?? '');
  try {
    fs.mkdirSync(folder, { recursive: true });
    const probe = `${folder}/.workspace_write_probe`;
    fs.writeFileSync(probe, 'ok', 'utf-8');
    fs.unlinkSync(probe);
  } catch (error) {
    throw new ApiError(
      400,
      `Pasta de ${label} inválida ou sem permissão de escrita: ${error instanceof Error ? error.message : error}`,
    );
  }
  return folder;
}
