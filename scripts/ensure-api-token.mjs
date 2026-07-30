#!/usr/bin/env node
/**
 * Ensures workspace_data/api_token exists and WORKSPACE_API_TOKEN is in .env.local
 * so Edge middleware and Next.js can read it at startup.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath =
  process.env.WORKSPACE_CONFIG_PATH?.trim() ||
  path.join(root, 'workspace_data', 'config.json');
const tokenPath = path.join(path.dirname(configPath), 'api_token');
const envLocalPath = path.join(root, '.env.local');

function logBanner(token) {
  console.log('');
  console.log('============================================================');
  console.log('Dev Workspace API token (copy to consumer .dev-workspace/.env):');
  console.log(`DEV_WORKSPACE_API_TOKEN=${token}`);
  console.log('============================================================');
  console.log('');
}

function readTokenFile() {
  if (!fs.existsSync(tokenPath)) return '';
  return fs.readFileSync(tokenPath, 'utf-8').trim();
}

function writeTokenFile(token) {
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
}

function upsertEnvLocal(token) {
  const line = `WORKSPACE_API_TOKEN=${token}`;
  let content = '';
  if (fs.existsSync(envLocalPath)) {
    content = fs.readFileSync(envLocalPath, 'utf-8');
    if (/^WORKSPACE_API_TOKEN=/m.test(content)) {
      content = content.replace(/^WORKSPACE_API_TOKEN=.*$/m, line);
    } else {
      content = `${content.trimEnd()}\n${line}\n`;
    }
  } else {
    content = `${line}\n`;
  }
  fs.writeFileSync(envLocalPath, content, 'utf-8');
}

let token = process.env.WORKSPACE_API_TOKEN?.trim() || readTokenFile();
if (!token) {
  token = randomBytes(32).toString('hex');
  writeTokenFile(token);
}

if (readTokenFile() !== token) {
  writeTokenFile(token);
}

upsertEnvLocal(token);
process.env.WORKSPACE_API_TOKEN = token;
logBanner(token);
