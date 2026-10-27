// Phase 2 demo seed runner: applies schema (safe IF NOT EXISTS) then the
// idempotent Metro Manila dataset. Safe to re-run; never deletes data.
// Usage: npm run db:seed  (from the repo root)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { databaseUrl } from '../db.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const FILES = [
  'db/init/01-extensions.sql',
  'db/init/02-schema.sql',
  'db/init/03-ai-circle.sql',
  'db/seed/phase2-demo.sql',
  'db/seed/ai-demo.sql',
  'db/seed/reconnect-demo.sql',
];

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl(), connectionTimeoutMillis: 10000 });
  try {
    for (const file of FILES) {
      const sql = readFileSync(join(ROOT, file), 'utf8');
      await pool.query(sql);
      // eslint-disable-next-line no-console
      console.log(`applied ${file}`);
    }
    const counts = await pool.query<{ table: string; count: string }>(
      `SELECT 'users' AS table, COUNT(*)::text AS count FROM users
       UNION ALL SELECT 'relationships', COUNT(*)::text FROM relationships
       UNION ALL SELECT 'locations', COUNT(*)::text FROM locations
       UNION ALL SELECT 'visibility', COUNT(*)::text FROM visibility`,
    );
    for (const row of counts.rows) {
      // eslint-disable-next-line no-console
      console.log(`${row.table}: ${row.count}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
