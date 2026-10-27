import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineM } from '../src/geo.js';

// Debug-10 seed hygiene: static verification of the seed roster, the Nicole
// removal, Coleen's seeded proximity (using the app's actual RADII values),
// and the safety properties of the one-shot cleanup script. No database
// needed; the live-DB integration suite covers runtime behavior.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SEED_DIR = join(ROOT, 'db', 'seed');
const CLEANUP_SQL = join(ROOT, 'db', 'cleanup', 'debug-10-nicole-coleen.sql');

function seedFiles(): string[] {
  return readdirSync(SEED_DIR).filter((f) => f.endsWith('.sql'));
}

function smallestRadarRadius(): number {
  const radar = readFileSync(join(ROOT, 'apps', 'web', 'src', 'radar.ts'), 'utf8');
  const match = radar.match(/RADII_M = \[([0-9,\s]+)\]/);
  if (!match) throw new Error('could not parse RADII_M from apps/web/src/radar.ts');
  const radii = match[1].split(',').map((s) => Number(s.trim()));
  return Math.min(...radii);
}

function seedPoint(sql: string, userId: string): { lat: number; lon: number } {
  const match = sql.match(
    new RegExp(`\\('${userId}', ST_SetSRID\\(ST_MakePoint\\(([0-9.]+), ([0-9.]+)\\), 4326\\)`),
  );
  if (!match) throw new Error(`no seeded location for ${userId}`);
  // ST_MakePoint takes (lon, lat).
  return { lon: Number(match[1]), lat: Number(match[2]) };
}

describe('debug-10 seed hygiene (static)', () => {
  it('has no Nicole fixture left in the seed roster or runner', () => {
    expect(existsSync(join(SEED_DIR, 'reconnect-demo.sql'))).toBe(false);
    for (const file of seedFiles()) {
      const sql = readFileSync(join(SEED_DIR, file), 'utf8');
      expect(sql.toLowerCase().includes('nicole')).toBe(false);
    }
    const runner = readFileSync(join(ROOT, 'apps', 'api', 'src', 'scripts', 'seed.ts'), 'utf8');
    expect(runner.includes('reconnect-demo')).toBe(false);
  });

  it('seeds Coleen legitimately inside the smallest radar radius', () => {
    const sql = readFileSync(join(SEED_DIR, 'phase2-demo.sql'), 'utf8');
    const you = seedPoint(sql, 'you');
    const coleen = seedPoint(sql, 'coleen');
    const distanceM = haversineM(you, coleen);
    const smallest = smallestRadarRadius();
    expect(smallest).toBe(500);
    expect(distanceM).toBeLessThan(smallest);
    // Guard against silent coordinate drift: the demo point is ~280 m out.
    expect(Math.abs(distanceM - 280.1) / 280.1).toBeLessThan(0.05);
  });

  it('keeps the one-shot cleanup narrowly scoped and idempotent', () => {
    expect(existsSync(CLEANUP_SQL)).toBe(true);
    const sql = readFileSync(CLEANUP_SQL, 'utf8');
    expect(sql.includes('BEGIN;')).toBe(true);
    expect(sql.includes('COMMIT;')).toBe(true);
    // Safety checks apply to the executable body, not the header documentation.
    const body = sql.slice(sql.indexOf('BEGIN;'), sql.indexOf('COMMIT;'));
    expect(/TRUNCATE|DROP\s+(TABLE|DATABASE)|ALTER\s+TABLE|VACUUM/i.test(body)).toBe(false);
    // Every DELETE is WHERE-scoped (no bare table wipes).
    const statements = body.split(';').map((s) => s.trim()).filter((s) => /DELETE\s+FROM/i.test(s));
    expect(statements.length).toBeGreaterThan(0);
    for (const stmt of statements) {
      expect(stmt.toUpperCase().includes('WHERE')).toBe(true);
    }
    // Nicole removal is guarded to the verified demo user id.
    expect(sql.includes("DELETE FROM users WHERE id = 'nicole' AND demo_flag IS TRUE")).toBe(true);
    expect(sql.includes("EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE)")).toBe(true);
    // Coleen suppression clearing is scoped to the demo pair + suppressing kinds.
    expect(sql.includes("owner_id = 'you' AND friend_id = 'coleen'")).toBe(true);
    expect(sql.includes("kind IN ('dismiss', 'snooze')")).toBe(true);
    // No other demo identity is targeted anywhere in the script.
    for (const id of ['alex', 'sam', 'rhea', 'marco', 'liza', 'jose', 'nina', 'paolo', 'jamie', 'taylor']) {
      expect(new RegExp(`\\b${id}\\b`, 'i').test(sql)).toBe(false);
    }
  });
});
