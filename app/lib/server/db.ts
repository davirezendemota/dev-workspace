import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { serverEnv } from './env';

let pool: Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(serverEnv.DATABASE_URL);
}

export function getPool(): Pool {
  if (!serverEnv.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: serverEnv.DATABASE_URL,
      max: 10,
    });
  }

  return pool;
}

export async function withDbClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function queryRows<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}
