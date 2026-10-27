import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { DEFAULT_AI_CIRCLE_CONFIG } from '../src/ai/types.js';
import { createAiFakeDb, createCountingProvider } from './aiHelpers.js';

// Debug-9 consistency suite: Radar, Nearby detail, and Reconnect Today must
// agree on who is eligible at the selected radius. Fixtures mirror the
// Metro Manila seed (phase2-demo.sql + ai-demo.sql + reconnect-demo.sql).
const CONFIG = { ...DEFAULT_AI_CIRCLE_CONFIG, apiKey: 'test-key' };

const NEARBY_5KM = [
  { id: 'coleen', display_name: 'Coleen', distance_m: 280.1, bearing_deg: 45.0 },
  { id: 'alex', display_name: 'Alex', distance_m: 750.3, bearing_deg: 170.0 },
  { id: 'sam', display_name: 'Sam', distance_m: 1500.3, bearing_deg: 270.0 },
  { id: 'nicole', display_name: 'Nicole', distance_m: 2476.4, bearing_deg: 195.4 },
  { id: 'rhea', display_name: 'Rhea', distance_m: 3201.3, bearing_deg: 10.0 },
];

const APPROVED_5KM: Record<string, string> = {
  'you:coleen': 'approved',
  'you:alex': 'approved',
  'you:sam': 'approved',
  'you:nicole': 'approved',
  'you:rhea': 'approved',
};

function profile(level: number | null, trend: string): Record<string, unknown> {
  return {
    level,
    evidence_quality: level === null ? 'limited' : 'moderate',
    rationale: 'Seeded demo profile.',
    activity_trend: trend,
    source: 'demo_fixture',
    model_id: null,
    signals_version: 1,
    fingerprint: 'seed-v1',
    baseline: {},
    policy_version: '1.0',
    status: 'active',
    assessed_at: new Date('2026-05-01T12:00:00.000Z'),
    updated_at: new Date('2026-05-01T12:00:00.000Z'),
  };
}

const PROFILES_5KM: Record<string, Record<string, unknown>> = {
  'you:coleen': profile(5, 'stable'),
  'you:alex': profile(4, 'stable'),
  'you:sam': profile(null, 'unknown'),
  'you:nicole': profile(4, 'decreasing'),
  'you:rhea': profile(3, 'stable'),
};

async function json(
  app: Awaited<ReturnType<typeof buildApp>>,
  method: 'GET' | 'POST',
  url: string,
  payload?: Record<string, unknown>,
) {
  const res = await app.inject({ method, url, payload });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}

function candidateIds(body: Record<string, unknown>): string[] {
  return (body['candidates'] as Array<Record<string, unknown>>).map((c) => c['id'] as string);
}

describe('debug-9 radar / nearby / reconnect consistency', () => {
  it('lists Rhea on the radar at the 5 km radius', async () => {
    const db = createAiFakeDb({ relationships: APPROVED_5KM, nearby: NEARBY_5KM });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const { status, body } = await json(app, 'GET', '/friends/nearby?radius_m=5000');
      expect(status).toBe(200);
      const friends = body['friends'] as Array<Record<string, unknown>>;
      expect(friends.map((f) => f['id'])).toEqual(['coleen', 'alex', 'sam', 'nicole', 'rhea']);
      expect(friends.find((f) => f['id'] === 'rhea')?.['distance_m']).toBe(3201.3);
    } finally {
      await app.close();
    }
  });

  it('returns the same eligible set from nearby and opportunities with equivalent filters', async () => {
    const db = createAiFakeDb({
      relationships: APPROVED_5KM,
      nearby: NEARBY_5KM,
      profiles: PROFILES_5KM,
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const nearbyRes = await json(app, 'GET', '/friends/nearby?radius_m=5000');
      const oppRes = await json(app, 'GET', '/ai-circle/opportunities?radius_m=5000');
      expect(nearbyRes.status).toBe(200);
      expect(oppRes.status).toBe(200);
      const nearbyIds = (nearbyRes.body['friends'] as Array<Record<string, unknown>>).map((f) => f['id']);
      expect(candidateIds(oppRes.body)).toEqual(nearbyIds);
      expect(provider.calls.assess).toHaveLength(0);
      expect(provider.calls.advise).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('includes eligible Rhea in Reconnect Today with her stored closeness', async () => {
    const db = createAiFakeDb({
      relationships: APPROVED_5KM,
      nearby: NEARBY_5KM,
      profiles: PROFILES_5KM,
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const { status, body } = await json(app, 'GET', '/ai-circle/opportunities?radius_m=5000');
      expect(status).toBe(200);
      const candidates = body['candidates'] as Array<Record<string, unknown>>;
      const rhea = candidates.find((c) => c['id'] === 'rhea');
      expect(rhea?.['display_name']).toBe('Rhea');
      expect(rhea?.['distance_m']).toBe(3201.3);
      expect(rhea?.['closeness']).toEqual({ level: 3, level_source: 'demo_profile' });
      expect(rhea?.['context']).toBe('Nearby and available for discovery');
      expect(provider.calls.assess).toHaveLength(0);
      expect(provider.calls.advise).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('includes eligible Nicole in Reconnect Today with her stored closeness', async () => {
    const db = createAiFakeDb({
      relationships: APPROVED_5KM,
      nearby: NEARBY_5KM,
      profiles: PROFILES_5KM,
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const { status, body } = await json(app, 'GET', '/ai-circle/opportunities?radius_m=5000');
      expect(status).toBe(200);
      const candidates = body['candidates'] as Array<Record<string, unknown>>;
      const nicole = candidates.find((c) => c['id'] === 'nicole');
      expect(nicole?.['display_name']).toBe('Nicole');
      expect(nicole?.['distance_m']).toBe(2476.4);
      expect(nicole?.['closeness']).toEqual({ level: 4, level_source: 'demo_profile' });
      expect(provider.calls.assess).toHaveLength(0);
      expect(provider.calls.advise).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('keeps genuinely ineligible candidates out while restoring the merely lapsed', async () => {
    const db = createAiFakeDb({
      relationships: { ...APPROVED_5KM, 'you:marco': 'approved' },
      nearby: [
        ...NEARBY_5KM,
        { id: 'marco', display_name: 'Marco', distance_m: 600.2, bearing_deg: 220.0 },
      ],
      profiles: { ...PROFILES_5KM, 'you:marco': profile(2, 'stable') },
      feedback: [
        // Permanent dismissal: stays suppressed.
        { owner_id: 'you', friend_id: 'coleen', kind: 'dismiss', created_at: new Date('2026-05-20T12:00:00.000Z'), expires_at: null },
        // Unexpired snooze: stays suppressed (fake clock is 2026-06-01).
        { owner_id: 'you', friend_id: 'marco', kind: 'snooze', created_at: new Date('2026-05-31T12:00:00.000Z'), expires_at: new Date('2026-06-02T12:00:00.000Z') },
        // Expired snooze: eligible again.
        { owner_id: 'you', friend_id: 'sam', kind: 'snooze', created_at: new Date('2026-05-20T12:00:00.000Z'), expires_at: new Date('2026-05-21T12:00:00.000Z') },
        // A declined invite shapes advice facts but never removes candidacy.
        { owner_id: 'you', friend_id: 'rhea', kind: 'declined', created_at: new Date('2026-05-30T12:00:00.000Z'), expires_at: null },
      ],
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const { status, body } = await json(app, 'GET', '/ai-circle/opportunities?radius_m=5000');
      expect(status).toBe(200);
      expect(candidateIds(body)).toEqual(['alex', 'sam', 'nicole', 'rhea']);
    } finally {
      await app.close();
    }
  });

  it('refuses advice for non-friends without inference (privacy intact)', async () => {
    const db = createAiFakeDb({
      relationships: { ...APPROVED_5KM, 'you:nina': 'pending' },
      nearby: NEARBY_5KM,
      profiles: PROFILES_5KM,
      prefs: {
        you: {
          analysis_consent: true,
          advice_consent: true,
          availability_shared: true,
          quiet_start_min: null,
          quiet_end_min: null,
          policy_version: '1.0',
          updated_at: new Date('2026-06-01T12:00:00.000Z'),
        },
      },
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const res = await json(app, 'POST', '/ai-circle/opportunities/nina/advise', { radius_m: 5000 });
      expect(res.status).toBe(404);
      expect(provider.calls.assess).toHaveLength(0);
      expect(provider.calls.advise).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
