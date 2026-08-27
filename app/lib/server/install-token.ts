import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { serverEnv } from './env';

const TOKEN_FILENAME = 'install_token';

function installTokenPath(): string {
  return path.join(path.dirname(serverEnv.WORKSPACE_CONFIG_PATH), TOKEN_FILENAME);
}

function readTokenFile(): string {
  const filePath = installTokenPath();
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf-8').trim();
}

function writeTokenFile(token: string): void {
  const filePath = installTokenPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${token}\n`, { mode: 0o600 });
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function logInstallTokenBanner(token: string): void {
  console.log('');
  console.log('============================================================');
  console.log('Dev Workspace install token (system env for install-kit):');
  console.log(`DEV_WORKSPACE_REGISTER_TOKEN=${token}`);
  console.log('============================================================');
  console.log('');
}

/** Load or create install token; sync process.env for middleware (Edge-safe). */
export function ensureWorkspaceInstallToken(): string {
  const envToken = process.env.WORKSPACE_INSTALL_TOKEN?.trim();
  if (envToken) {
    if (readTokenFile() !== envToken) {
      writeTokenFile(envToken);
    }
    process.env.WORKSPACE_INSTALL_TOKEN = envToken;
    return envToken;
  }

  let token = readTokenFile();
  if (!token) {
    token = generateToken();
    writeTokenFile(token);
  }

  process.env.WORKSPACE_INSTALL_TOKEN = token;
  logInstallTokenBanner(token);
  return token;
}

export function getWorkspaceInstallToken(): string {
  const envToken = process.env.WORKSPACE_INSTALL_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }
  return readTokenFile();
}

export function isValidWorkspaceInstallToken(candidate: string): boolean {
  const expected = getWorkspaceInstallToken();
  if (!expected) {
    return false;
  }
  return candidate === expected;
}
