import path from 'path';

const dataRoot = path.join(process.cwd(), 'workspace_data');

export const serverEnv = {
  WORKSPACE_CONFIG_PATH:
    process.env.WORKSPACE_CONFIG_PATH ?? path.join(dataRoot, 'config.json'),
  WORKSPACE_PROJECTS_PATH:
    process.env.WORKSPACE_PROJECTS_PATH ?? path.join(dataRoot, 'projects'),
  WORKSPACE_AGENTS_PATH:
    process.env.WORKSPACE_AGENTS_PATH ?? path.join(dataRoot, 'agents'),
};
