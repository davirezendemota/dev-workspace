import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { serverEnv } from './env';

const INDEX_FILENAME = 'consumer_api_tokens.json';

export type ConsumerTokenEntry = {
  local_path: string;
  project_ids: string[];
};

function indexPath(): string {
  return path.join(path.dirname(serverEnv.WORKSPACE_CONFIG_PATH), INDEX_FILENAME);
}

export function readConsumerTokenIndex(): Record<string, ConsumerTokenEntry> {
  const filePath = indexPath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<
      string,
      ConsumerTokenEntry
    >;
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    return raw;
  } catch {
    return {};
  }
}

export function writeConsumerTokenIndex(index: Record<string, ConsumerTokenEntry>): void {
  const filePath = indexPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
}

export function generateConsumerToken(): string {
  return randomBytes(32).toString('hex');
}

export function normalizeLocalPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  try {
    return fs.realpathSync(trimmed);
  } catch {
    return path.resolve(trimmed);
  }
}

/** Sync token map to env for Edge middleware (no filesystem). */
export function syncConsumerTokensToEnv(): void {
  process.env.WORKSPACE_CONSUMER_TOKENS_JSON = JSON.stringify(readConsumerTokenIndex());
}

export function logConsumerTokenBanner(
  projectId: string,
  localPath: string,
  token: string,
): void {
  console.log('');
  console.log('============================================================');
  console.log(`Consumer API token for project "${projectId}" (${localPath}):`);
  console.log(`DEV_WORKSPACE_API_TOKEN=${token}`);
  console.log('============================================================');
  console.log('');
}

export function resolveConsumerScope(token: string): ConsumerTokenEntry | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  const entry = readConsumerTokenIndex()[trimmed];
  if (!entry?.local_path || !Array.isArray(entry.project_ids)) {
    return null;
  }
  return {
    local_path: entry.local_path,
    project_ids: entry.project_ids.filter((id) => typeof id === 'string' && id.trim()),
  };
}

export function getConsumerTokenForProject(projectId: string): string | null {
  const index = readConsumerTokenIndex();
  for (const [token, entry] of Object.entries(index)) {
    if (entry.project_ids.includes(projectId)) {
      return token;
    }
  }
  return null;
}
