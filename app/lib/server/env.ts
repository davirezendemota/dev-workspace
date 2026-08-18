import path from 'path';

const dataRoot = path.join(process.cwd(), 'workspace_data');

/** Path fixo no container onde a pasta de projetos locais é montada (Docker). */
export const LOCAL_PROJECTS_MOUNT = '/local-projects';

export const serverEnv = {
  WORKSPACE_CONFIG_PATH:
    process.env.WORKSPACE_CONFIG_PATH ?? path.join(dataRoot, 'config.json'),
  /** Raiz dos projetos no host — usada no Docker para remapear local_path ao mount. */
  WORKSPACE_LOCAL_PROJECTS_ROOT:
    process.env.WORKSPACE_LOCAL_PROJECTS_ROOT?.trim() ?? '',
  /** Postgres com pgvector para embeddings da IA de consulta. */
  DATABASE_URL: process.env.DATABASE_URL?.trim() ?? '',
};
