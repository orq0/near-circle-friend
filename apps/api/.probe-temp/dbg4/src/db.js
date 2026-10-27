import { Pool } from 'pg';
export function databaseUrl(env = process.env) {
    const direct = env['DATABASE_URL']?.trim();
    if (direct !== undefined && direct !== '')
        return direct;
    const user = env['POSTGRES_USER'] ?? 'near_circle';
    const password = env['POSTGRES_PASSWORD'] ?? 'near_circle_dev_password';
    const db = env['POSTGRES_DB'] ?? 'near_circle';
    const host = env['POSTGRES_HOST'] ?? 'localhost';
    const port = env['POSTGRES_PORT'] ?? '5433';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
}
let pool = null;
export function getPool() {
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
export async function closePool() {
    if (pool !== null) {
        const current = pool;
        pool = null;
        await current.end();
    }
}
/** True for transport-level failures (map to 503); SQL bugs stay 500s. */
export function isConnectionError(err) {
    if (typeof err !== 'object' || err === null)
        return false;
    const code = err.code;
    return (code === 'ECONNREFUSED' ||
        code === 'ENOTFOUND' ||
        code === 'ETIMEDOUT' ||
        code === 'EHOSTUNREACH' ||
        code === 'ENETUNREACH' ||
        code === 'EACCES' ||
        code === 'EPIPE' ||
        code === 'ECONNRESET');
}
