import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { DEFAULT_AI_CIRCLE_CONFIG } from '../src/ai/types.js';
import { createAiFakeDb, createCountingProvider } from './aiHelpers.js';

// Demo-prep restore for the Coleen judge scenario: snooze/dismiss must be
// reversible without touching other friends, budgets, or profiles, and the
// per-pair cooldown behind the misleading "AI budget reached" message must
// unblock after a restore.
const CONFIG = { ...DEFAULT_AI_CIRCLE_CONFIG, apiKey: 'test-key' };
const RESTORE_ON = { ...CONFIG, demoAvailability: true };

const CONSENTED = {
  analysis_consent: true,
  advice_consent: true,
  availability_shared: true,
  quiet_start_min: null,
  quiet_end_min: null,
  policy_version: '1.0',
  updated_at: new Date('2026-06-01T12:00:00.000Z'),
};

const COLEEN_NEARBY = { id: 'coleen', display_name: 'Coleen', distance_m: 280.1, bearing_deg: 45 };
const COLEEN_DETAIL = {
  id: 'coleen',
  display_name: 'Coleen',
  near_circle_enabled: true,
  fresh: true,
  distance_m: 280.1,
  bearing_deg: 45,
};
const COLEEN_SIGNALS = {
  known_for_bucket: 'several_years',
  last_meetup_bucket: 'over_a_year_ago',
  contact_frequency: 'occasional',
  activity_trend: 'stable',
  reciprocity_bucket: 'balanced',
  confirmed_meetups: 5,
  declared_closeness: 'friend',
  declared_activities: ['coffee'],
  sustained_windows: 3,
  source: 'synthetic_demo',
  signals_version: 1,
};
const COLEEN_PROFILE = {
  level: 4,
  evidence_quality: 'moderate',
  rationale: 'Friendly acquaintance open to catching up.',
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

const ALEX_NEARBY = { id: 'alex', display_name: 'Alex', distance_m: 750.3, bearing_deg: 170 };

function coleenSeeds(extra: Record<string, unknown> = {}) {
  return {
    relationships: { 'you:coleen': 'approved', 'you:alex': 'approved' },
    nearby: [COLEEN_NEARBY, ALEX_NEARBY],
    detail: COLEEN_DETAIL,
    signals: { 'you:coleen': COLEEN_SIGNALS },
    profiles: { 'you:coleen': COLEEN_PROFILE },
    prefs: { you: CONSENTED, coleen: CONSENTED },
    ...extra,
  };
}

async function json(app: Awaited<ReturnType<typeof buildApp>>, method: 'GET' | 'POST', url: string, payload?: Record<string, unknown>) {
  const res = await app.inject({ method, url, payload });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}

function candidateIds(body: Record<string, unknown>): string[] {
  return ((body['candidates'] ?? []) as Array<Record<string, unknown>>).map((c) => c['id'] as string);
}

describe('Coleen demo restore', () => {
  it('is unavailable unless the Coleen demo flag is on', async () => {
    const db = createAiFakeDb(coleenSeeds());
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await json(app, 'POST', '/ai-circle/demo/coleen-restore');
      expect(res.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('restores a snoozed Coleen to Reconnect Today and fresh advice', async () => {
    const db = createAiFakeDb(
      coleenSeeds({
        feedback: [
          {
            owner_id: 'you',
            friend_id: 'coleen',
            kind: 'snooze',
            created_at: new Date('2026-06-01T11:00:00.000Z'),
            expires_at: new Date('2026-06-02T11:00:00.000Z'),
          },
        ],
      }),
    );
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: RESTORE_ON } });
    try {
      expect(candidateIds((await json(app, 'GET', '/ai-circle/opportunities?radius_m=500')).body)).not.toContain('coleen');
      const blocked = await json(app, 'POST', '/ai-circle/opportunities/coleen/advise', { radius_m: 500 });
      expect(blocked.status).toBe(409);

      const restored = await json(app, 'POST', '/ai-circle/demo/coleen-restore');
      expect(restored.status).toBe(200);
      expect(restored.body).toEqual({ restored: true, friend_id: 'coleen', feedback_cleared: 1, advice_cleared: 0 });

      expect(candidateIds((await json(app, 'GET', '/ai-circle/opportunities?radius_m=500')).body)).toContain('coleen');
      const advised = await json(app, 'POST', '/ai-circle/opportunities/coleen/advise', { radius_m: 500 });
      expect(advised.status).toBe(200);
      expect(provider.calls.advise).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('clears a permanent dismiss but leaves expired snooze rows alone', async () => {
    const expired = {
      owner_id: 'you',
      friend_id: 'coleen',
      kind: 'snooze',
      created_at: new Date('2026-05-28T12:00:00.000Z'),
      expires_at: new Date('2026-05-29T12:00:00.000Z'),
    };
    const db = createAiFakeDb(
      coleenSeeds({
        feedback: [
          { owner_id: 'you', friend_id: 'coleen', kind: 'dismiss', created_at: new Date('2026-05-30T12:00:00.000Z'), expires_at: null },
          expired,
        ],
      }),
    );
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: RESTORE_ON } });
    try {
      const restored = await json(app, 'POST', '/ai-circle/demo/coleen-restore');
      expect(restored.body['feedback_cleared']).toBe(1);
      // The expired row never suppressed Coleen, so it is left untouched.
      expect(db.state.feedback).toEqual([expired]);
      const advised = await json(app, 'POST', '/ai-circle/opportunities/coleen/advise', { radius_m: 500 });
      expect(advised.status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('leaves other friends suppression and advice untouched', async () => {
    const alexFeedback = {
      owner_id: 'you',
      friend_id: 'alex',
      kind: 'dismiss',
      created_at: new Date('2026-05-30T12:00:00.000Z'),
      expires_at: null,
    };
    const alexAdvice = {
      owner_id: 'you',
      friend_id: 'alex',
      advice_key: 'k',
      outcome: 'suggest',
      reason: 'r',
      activity: 'coffee',
      invitation_draft: '',
      source: 'meta_live',
      model_id: 'muse-spark-1.3',
      generated_at: new Date('2026-06-01T11:00:00.000Z'),
      expires_at: new Date('2026-06-01T12:30:00.000Z'),
    };
    const db = createAiFakeDb(coleenSeeds({ feedback: [alexFeedback], advice: [alexAdvice] }));
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: RESTORE_ON } });
    try {
      const restored = await json(app, 'POST', '/ai-circle/demo/coleen-restore');
      expect(restored.body).toEqual({ restored: true, friend_id: 'coleen', feedback_cleared: 0, advice_cleared: 0 });
      expect(db.state.feedback).toEqual([alexFeedback]);
      expect(db.state.advice).toEqual([alexAdvice]);
      // Alex stays suppressed: Coleen-only by construction.
      expect(candidateIds((await json(app, 'GET', '/ai-circle/opportunities?radius_m=5000')).body)).not.toContain('alex');
    } finally {
      await app.close();
    }
  });

  it('documents the pair-cooldown behind the budget message, then unblocks it', async () => {
    const db = createAiFakeDb(coleenSeeds());
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: RESTORE_ON } });
    try {
      // First suggestion succeeds and reaches the model.
      expect((await json(app, 'POST', '/ai-circle/opportunities/coleen/advise', { radius_m: 500 })).status).toBe(200);
      expect(provider.calls.advise).toHaveLength(1);
      // A second suggestion (different cache key, same pair, within 6h) is
      // rejected by the per-pair cooldown BEFORE reaching the model — yet the
      // UI renders every 429 as "AI budget reached".
      const second = await json(app, 'POST', '/ai-circle/opportunities/coleen/advise', { radius_m: 1000 });
      expect(second.status).toBe(429);
      expect(second.body['error']).toBe('ai rate limited for this friend');
      expect(provider.calls.advise).toHaveLength(1);
      // Demo-prep restore clears the pair rows; the next take succeeds.
      const restored = await json(app, 'POST', '/ai-circle/demo/coleen-restore');
      expect(restored.body['advice_cleared']).toBe(1);
      expect((await json(app, 'POST', '/ai-circle/opportunities/coleen/advise', { radius_m: 1000 })).status).toBe(200);
      expect(provider.calls.advise).toHaveLength(2);
    } finally {
      await app.close();
    }
  });

  it('keeps the true daily-budget guard and its message intact', async () => {
    const db = createAiFakeDb(
      coleenSeeds({
        usage: {
          'you:2026-06-01': { model_requests: 100, cache_hits: 0, cache_misses: 0, input_tokens: 0, output_tokens: 0, rate_limited: 0 },
        },
      }),
    );
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: RESTORE_ON } });
    try {
      const res = await json(app, 'POST', '/ai-circle/opportunities/coleen/advise', { radius_m: 500 });
      expect(res.status).toBe(429);
      expect(res.body['error']).toBe('ai daily budget reached');
      expect(provider.calls.advise).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('is idempotent and never touches usage counters', async () => {
    const usage = { model_requests: 3, cache_hits: 1, cache_misses: 4, input_tokens: 10, output_tokens: 5, rate_limited: 1 };
    const db = createAiFakeDb(coleenSeeds({ usage: { 'you:2026-06-01': { ...usage } } }));
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: RESTORE_ON } });
    try {
      expect((await json(app, 'POST', '/ai-circle/demo/coleen-restore')).body).toEqual({
        restored: true,
        friend_id: 'coleen',
        feedback_cleared: 0,
        advice_cleared: 0,
      });
      expect((await json(app, 'POST', '/ai-circle/demo/coleen-restore')).body).toEqual({
        restored: true,
        friend_id: 'coleen',
        feedback_cleared: 0,
        advice_cleared: 0,
      });
      const counters = (await json(app, 'GET', '/ai-circle/usage')).body['usage'];
      expect(counters).toEqual(usage);
    } finally {
      await app.close();
    }
  });
});
