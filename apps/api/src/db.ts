import { Pool, type QueryResultRow } from 'pg';

// Minimal structural query interface. pg.Pool satisfies it; tests inject fakes.
export interface Queryable {
  query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const direct = env['DATABASE_URL']?.trim();
  if (direct !== undefined && direct !== '') return direct;
  const user = env['POSTGRES_USER'] ?? 'near_circle';
  const password = env['POSTGRES_PASSWORD'] ?? 'near_circle_dev_password';
  const db = env['POSTGRES_DB'] ?? 'near_circle';
  const host = env['POSTGRES_HOST'] ?? 'localhost';
  const port = env['POSTGRES_PORT'] ?? '5433';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool === null) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
    // Idle-client errors must never crash the process.
    pool.on('error', () => undefined);
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool !== null) {
    const current = pool;
    pool = null;
    await current.end();
  }
}

/** True for transport-level failures (map to 503); SQL bugs stay 500s. */
export function isConnectionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH'
  );
}
