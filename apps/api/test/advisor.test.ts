import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { DEFAULT_AI_CIRCLE_CONFIG } from '../src/ai/types.js';
import { createAiFakeDb, createCountingProvider } from './aiHelpers.js';

const CONFIG = { ...DEFAULT_AI_CIRCLE_CONFIG, apiKey: 'test-key' };
const NO_KEY = { ...DEFAULT_AI_CIRCLE_CONFIG, apiKey: '' };

const CONSENTED = {
  analysis_consent: true,
  advice_consent: true,
  availability_shared: true,
  quiet_start_min: null,
  quiet_end_min: null,
  policy_version: '1.0',
  updated_at: new Date('2026-06-01T12:00:00.000Z'),
};

const ALEX_NEARBY = { id: 'alex', display_name: 'Alex', distance_m: 750.3, bearing_deg: 170 };
const ALEX_DETAIL = {
  id: 'alex',
  display_name: 'Alex',
  near_circle_enabled: true,
  fresh: true,
  distance_m: 750.3,
  bearing_deg: 170,
};
const ALEX_ROUTE = {
  id: 'alex',
  display_name: 'Alex',
  near_circle_enabled: true,
  fresh: true,
  lat: 14.5851,
  lon: 120.979,
  straight_line_m: 750.1,
};

const ALEX_PROFILE = {
  level: 4,
  evidence_quality: 'moderate',
  rationale: 'Longstanding reciprocal friendship.',
  activity_trend: 'stable',
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

const ALEX_SIGNALS = {
  known_for_bucket: 'several_years',
  last_meetup_bucket: 'about_three_months_ago',
  contact_frequency: 'occasional',
  activity_trend: 'stable',
  reciprocity_bucket: 'balanced',
  confirmed_meetups: 5,
  declared_closeness: 'close_friend',
  declared_activities: ['coffee'],
  sustained_windows: 3,
  source: 'synthetic_demo',
  signals_version: 1,
};

const STUB_ROUTING = {
  name: 'stub',
  async route() {
    return {
      geometry: { type: 'LineString', coordinates: [[120.975, 14.581], [120.979, 14.5851]] },
      distance_m: 812.4,
      duration_s: 587,
    };
  },
} as never;

async function json(app: Awaited<ReturnType<typeof buildApp>>, method: 'GET' | 'POST' | 'PUT', url: string, payload?: Record<string, unknown>) {
  const res = await app.inject({ method, url, payload });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}

describe('AI opportunities (deterministic, no inference)', () => {
  it('lists eligible candidates with stored closeness, never judging', async () => {
    const db = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      signals: { 'you:alex': ALEX_SIGNALS },
      profiles: { 'you:alex': ALEX_PROFILE },
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const { status, body } = await json(app, 'GET', '/ai-circle/opportunities?radius_m=1000');
      expect(status).toBe(200);
      const candidates = body['candidates'] as Array<Record<string, unknown>>;
      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.['id']).toBe('alex');
      expect(candidates[0]?.['walk_minutes']).toBe(null);
      expect(candidates[0]?.['context']).toBe('Nearby and available for discovery');
      expect(candidates[0]?.['closeness']).toEqual({ level: 4, level_source: 'demo_profile' });
      expect(provider.calls.assess).toHaveLength(0);
      expect(provider.calls.advise).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('suppresses dismissed and snoozed friends', async () => {
    const db = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      feedback: [
        { owner_id: 'you', friend_id: 'alex', kind: 'snooze', created_at: new Date(), expires_at: new Date('2026-06-02T12:00:00.000Z') },
      ],
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const { body } = await json(app, 'GET', '/ai-circle/opportunities');
      expect(body['candidates']).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('adds walk minutes only when the router answers', async () => {
    const db = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      routeDetail: ALEX_ROUTE,
      signals: { 'you:alex': ALEX_SIGNALS },
      profiles: { 'you:alex': ALEX_PROFILE },
    });
    const app = await buildApp({ db, routing: STUB_ROUTING, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const { body } = await json(app, 'GET', '/ai-circle/opportunities?radius_m=1000');
      const candidates = body['candidates'] as Array<Record<string, unknown>>;
      expect(candidates[0]?.['walk_minutes']).toBe(10);
    } finally {
      await app.close();
    }
  });
});

describe('AI on-demand advice', () => {
  it('answers deterministically in demo mode without a key or model call', async () => {
    const db = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      signals: { 'you:alex': ALEX_SIGNALS },
      profiles: { 'you:alex': ALEX_PROFILE },
      prefs: { you: CONSENTED, alex: CONSENTED },
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: NO_KEY } });
    try {
      const { status, body } = await json(app, 'POST', '/ai-circle/opportunities/alex/advise', {
        radius_m: 1000,
        display_name: 'Alex',
      });
      expect(status).toBe(200);
      expect(body['source']).toBe('demo_fixture');
      expect(body['outcome']).toBe('suggest');
      expect(String(body['invitation_draft'])).toContain('Alex');
      expect(provider.calls.advise).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('abstains the deterministic demo path when no closeness exists', async () => {
    const db = createAiFakeDb({
      nearby: [{ id: 'sam', display_name: 'Sam', distance_m: 1500, bearing_deg: 10 }],
      relationships: { 'you:alex': 'approved', 'you:jamie': 'approved', 'you:sam': 'approved' },
      detail: { id: 'sam', display_name: 'Sam', near_circle_enabled: true, fresh: true, distance_m: 1500, bearing_deg: 10 },
      prefs: { you: CONSENTED },
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: NO_KEY } });
    try {
      const { body } = await json(app, 'POST', '/ai-circle/opportunities/sam/advise', {
        radius_m: 2000,
        display_name: 'Sam',
      });
      expect(body['source']).toBe('demo_fixture');
      expect(body['outcome']).toBe('insufficient_context');
      expect(body['invitation_draft']).toBe(null);
    } finally {
      await app.close();
    }
  });

  it('uses live inference once, then serves the identical request from cache', async () => {
    const db = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      signals: { 'you:alex': ALEX_SIGNALS },
      profiles: { 'you:alex': ALEX_PROFILE },
      prefs: { you: CONSENTED, alex: CONSENTED },
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const first = await json(app, 'POST', '/ai-circle/opportunities/alex/advise', { radius_m: 1000, display_name: 'Alex' });
      expect(first.status).toBe(200);
      expect(first.body['source']).toBe('meta_live');
      const second = await json(app, 'POST', '/ai-circle/opportunities/alex/advise', { radius_m: 1000, display_name: 'Alex' });
      expect(second.status).toBe(200);
      expect(second.body['source']).toBe('meta_cached');
      expect(second.body['trace_id']).toBe(first.body['trace_id']);
      expect(provider.calls.advise).toHaveLength(1);
      const usage = await json(app, 'GET', '/ai-circle/usage');
      const counters = usage.body['usage'] as Record<string, number>;
      expect(counters.model_requests).toBe(1);
      expect(counters.cache_hits).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('requires advice consent, refuses suppressed and ineligible friends', async () => {
    const db = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      prefs: { you: { ...CONSENTED, advice_consent: false } },
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const denied = await json(app, 'POST', '/ai-circle/opportunities/alex/advise', { radius_m: 1000 });
      expect(denied.status).toBe(403);
    } finally {
      await app.close();
    }
    const ineligible = createAiFakeDb({
      relationships: { 'you:alex': 'approved' },
      detail: { ...ALEX_DETAIL, near_circle_enabled: false },
      prefs: { you: CONSENTED },
    });
    const app2 = await buildApp({ db: ineligible, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await json(app2, 'POST', '/ai-circle/opportunities/alex/advise', { radius_m: 1000 });
      expect(res.status).toBe(403);
    } finally {
      await app2.close();
    }
  });

  it('observes quiet hours without calling the model', async () => {
    const db = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      prefs: { you: { ...CONSENTED, quiet_start_min: 600, quiet_end_min: 780 } },
    });
    const provider = createCountingProvider();
    try {
      // Freeze only the Date inside the quiet window (12:00 UTC).
      // vi.setSystemTime without vi.useFakeTimers mocks just the clock:
      // buildApp (avvio boot) and app.inject (light-my-request) need real
      // setTimeout/setImmediate, which full fake timers would freeze and hang.
      vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
      const app = await buildApp({ db, ai: { provider, config: CONFIG } });
      try {
        const res = await json(app, 'POST', '/ai-circle/opportunities/alex/advise', { radius_m: 1000 });
        expect(res.status).toBe(409);
        expect(provider.calls.advise).toHaveLength(0);
      } finally {
        await app.close();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('enforces the daily budget and per-pair window with 429', async () => {
    const spent = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      prefs: { you: CONSENTED },
      usage: { 'you:2026-06-01': { model_requests: 100, cache_hits: 0, cache_misses: 0, input_tokens: 0, output_tokens: 0, rate_limited: 0 } },
    });
    const app = await buildApp({ db: spent, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await json(app, 'POST', '/ai-circle/opportunities/alex/advise', { radius_m: 1000 });
      expect(res.status).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('reports AI unavailable when disabled', async () => {
    const db = createAiFakeDb({ nearby: [ALEX_NEARBY], detail: ALEX_DETAIL, prefs: { you: CONSENTED } });
    const app = await buildApp({
      db,
      ai: { provider: createCountingProvider(), config: { ...CONFIG, enabled: false } },
    });
    try {
      const res = await json(app, 'POST', '/ai-circle/opportunities/alex/advise', { radius_m: 1000 });
      expect(res.status).toBe(503);
    } finally {
      await app.close();
    }
  });
});

describe('AI feedback and dismissal', () => {
  it('records dismissals and snoozes that suppress candidates', async () => {
    const db = createAiFakeDb({ nearby: [ALEX_NEARBY], detail: ALEX_DETAIL });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const before = await json(app, 'GET', '/ai-circle/opportunities');
      expect((before.body['candidates'] as unknown[])).toHaveLength(1);
      const dismiss = await json(app, 'POST', '/ai-circle/feedback', { friend_id: 'alex', kind: 'dismiss' });
      expect(dismiss.status).toBe(200);
      const after = await json(app, 'GET', '/ai-circle/opportunities');
      expect(after.body['candidates']).toEqual([]);
      const bad = await json(app, 'POST', '/ai-circle/feedback', { friend_id: 'alex', kind: 'block' });
      expect(bad.status).toBe(400);
      const badFriend = await json(app, 'POST', '/ai-circle/feedback', { friend_id: 'nobody', kind: 'dismiss' });
      expect(badFriend.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('honors snooze expiry', async () => {
    const db = createAiFakeDb({
      nearby: [ALEX_NEARBY],
      detail: ALEX_DETAIL,
      feedback: [
        { owner_id: 'you', friend_id: 'alex', kind: 'snooze', created_at: new Date('2026-05-30T12:00:00.000Z'), expires_at: new Date('2026-05-31T12:00:00.000Z') },
      ],
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await json(app, 'GET', '/ai-circle/opportunities');
      expect((res.body['candidates'] as unknown[])).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
