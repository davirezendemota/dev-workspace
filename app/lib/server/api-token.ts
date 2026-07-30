import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { serverEnv } from './env';

const TOKEN_FILENAME = 'api_token';

function apiTokenPath(): string {
  return path.join(path.dirname(serverEnv.WORKSPACE_CONFIG_PATH), TOKEN_FILENAME);
}

function readTokenFile(): string {
  const filePath = apiTokenPath();
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf-8').trim();
}

function writeTokenFile(token: string): void {
  const filePath = apiTokenPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${token}\n`, { mode: 0o600 });
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function logApiTokenBanner(token: string): void {
  console.log('');
  console.log('============================================================');
  console.log('Dev Workspace API token (copy to consumer .dev-workspace/.env):');
  console.log(`DEV_WORKSPACE_API_TOKEN=${token}`);
  console.log('============================================================');
  console.log('');
}

/** Load or create token; sync process.env for middleware (Edge-safe). */
export function ensureWorkspaceApiToken(): string {
  const envToken = process.env.WORKSPACE_API_TOKEN?.trim();
  if (envToken) {
    if (readTokenFile() !== envToken) {
      writeTokenFile(envToken);
    }
    process.env.WORKSPACE_API_TOKEN = envToken;
    return envToken;
  }

  let token = readTokenFile();
  if (!token) {
    token = generateToken();
    writeTokenFile(token);
  }

  process.env.WORKSPACE_API_TOKEN = token;
  logApiTokenBanner(token);
  return token;
}

export function getWorkspaceApiToken(): string {
  const envToken = process.env.WORKSPACE_API_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }
  return readTokenFile();
}

export function isValidWorkspaceApiToken(candidate: string): boolean {
  const expected = getWorkspaceApiToken();
  if (!expected) {
    return false;
  }
  return candidate === expected;
}
