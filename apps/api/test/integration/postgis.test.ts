import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { buildApp } from '../../src/app.js';
import { databaseUrl } from '../../src/db.js';
import { haversineM } from '../../src/geo.js';

// Live-database suite. Runs ONLY via `npm run test:integration` with
// RUN_INTEGRATION_TESTS=1 against a seeded stack (`npm run db:seed`).
// The gate throws loudly when unset: never a silent skip.
if (process.env['RUN_INTEGRATION_TESTS'] !== '1') {
  throw new Error(
    'integration tests require RUN_INTEGRATION_TESTS=1 and a seeded stack (npm run db:seed)',
  );
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const HOME = { lat: 14.581, lon: 120.975 };

async function tableCounts(pool: Pool): Promise<Record<string, number>> {
  const res = await pool.query<{ table: string; count: string }>(
    `SELECT 'users' AS table, COUNT(*)::text AS count FROM users
     UNION ALL SELECT 'relationships', COUNT(*)::text FROM relationships
     UNION ALL SELECT 'locations', COUNT(*)::text FROM locations
     UNION ALL SELECT 'visibility', COUNT(*)::text FROM visibility`,
  );
  return Object.fromEntries(res.rows.map((row) => [row.table, Number(row.count)]));
}

describe('PostGIS proximity (live database)', () => {
  it('discovers the documented friends per radius', async () => {
    const app = await buildApp();
    try {
      const expectations: Array<[number, string[]]> = [
        [500, ['coleen']],
        [1000, ['coleen', 'alex']],
        [2000, ['coleen', 'alex', 'sam']],
        [5000, ['coleen', 'alex', 'sam', 'rhea']],
      ];
      for (const [radius, ids] of expectations) {
        const res = await app.inject({ method: 'GET', url: `/friends/nearby?radius_m=${radius}` });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { friends: Array<{ id: string }> };
        expect(body.friends.map((f) => f.id)).toEqual(ids);
      }
    } finally {
      await app.close();
    }
  });

  it('excludes disabled, stale, distant, non-friend, and pending users', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=5000' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { friends: Array<{ id: string }> };
      const ids = body.friends.map((f) => f.id);
      for (const excluded of ['marco', 'liza', 'jose', 'nina', 'paolo']) {
        expect(ids.includes(excluded)).toBe(false);
      }
    } finally {
      await app.close();
    }
  });

  it('matches haversine cross-checks within 0.5%', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=5000' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        center: { lat: number; lon: number };
        friends: Array<{ id: string; distance_m: number; bearing_deg: number }>;
      };
      // Seed bearings/distances were derived from these demo points.
      const points: Record<string, { lat: number; lon: number }> = {
        coleen: { lat: 14.5827902, lon: 120.9768376 },
        alex: { lat: 14.5743222, lon: 120.9762089 },
        sam: { lat: 14.581, lon: 120.9610766 },
        rhea: { lat: 14.6094938, lon: 120.980158 },
      };
      for (const friend of body.friends) {
        const expected = haversineM(body.center, points[friend.id] as { lat: number; lon: number });
        expect(Math.abs(friend.distance_m - expected) / expected).toBeLessThan(0.005);
        expect(friend.bearing_deg).toBeGreaterThanOrEqual(0);
        expect(friend.bearing_deg).toBeLessThan(360);
      }
    } finally {
      await app.close();
    }
  });

  it('deactivates and reactivates discovery', async () => {
    const app = await buildApp();
    try {
      const off = await app.inject({
        method: 'POST',
        url: '/near-circle/toggle',
        payload: { enabled: false },
      });
      expect(off.statusCode).toBe(200);
      const denied = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=5000' });
      expect(denied.statusCode).toBe(403);
    } finally {
      await app.close();
    }
    const reopened = await buildApp();
    try {
      const on = await reopened.inject({
        method: 'POST',
        url: '/near-circle/toggle',
        payload: { enabled: true },
      });
      expect(on.statusCode).toBe(200);
      const allowed = await reopened.inject({ method: 'GET', url: '/friends/nearby?radius_m=500' });
      expect(allowed.statusCode).toBe(200);
    } finally {
      await reopened.close();
    }
  });

  it('moves the demo user and restores the seed position', async () => {
    const app = await buildApp();
    try {
      const moved = await app.inject({
        method: 'PUT',
        url: '/location',
        payload: { lat: 14.6, lon: 121.0 },
      });
      expect(moved.statusCode).toBe(200);
      const body = moved.json() as { lat: number; lon: number };
      expect(body.lat).toBe(14.6);
      const nearby = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=500' });
      expect(nearby.statusCode).toBe(200);
    } finally {
      await app.close();
    }
    const restore = await buildApp();
    try {
      const back = await restore.inject({
        method: 'PUT',
        url: '/location',
        payload: HOME,
      });
      expect(back.statusCode).toBe(200);
    } finally {
      await restore.close();
    }
  });

  it('keeps counts stable across seed re-runs', async () => {
    const pool = new Pool({ connectionString: databaseUrl() });
    try {
      const before = await tableCounts(pool);
      const sql = readFileSync(join(ROOT, 'db/seed/phase2-demo.sql'), 'utf8');
      await pool.query(sql);
      await pool.query(sql);
      const after = await tableCounts(pool);
      expect(after).toEqual(before);
    } finally {
      await pool.end();
    }
  });
});
