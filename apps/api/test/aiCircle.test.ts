import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ApiError } from '../src/errors.js';
import {
  processPendingJobs,
  requestAssessment,
} from '../src/ai/aiCircle.js';
import { DEFAULT_AI_CIRCLE_CONFIG } from '../src/ai/types.js';
import { createAiFakeDb, createCountingProvider } from './aiHelpers.js';

const CONFIG = { ...DEFAULT_AI_CIRCLE_CONFIG, apiKey: 'test-key' };
const NO_KEY = { ...DEFAULT_AI_CIRCLE_CONFIG, apiKey: '' };

const ALEX_SIGNALS = {
  known_for_bucket: 'several_years',
  last_meetup_bucket: 'about_three_months_ago',
  contact_frequency: 'occasional',
  activity_trend: 'stable',
  reciprocity_bucket: 'balanced',
  confirmed_meetups: 5,
  declared_closeness: 'close_friend',
  declared_activities: ['coffee', 'walk'],
  sustained_windows: 3,
  source: 'synthetic_demo',
  signals_version: 1,
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
  baseline: { ...ALEX_SIGNALS, source: undefined, signals_version: undefined },
  policy_version: '1.0',
  status: 'active',
  assessed_at: new Date('2026-05-01T12:00:00.000Z'),
  updated_at: new Date('2026-05-01T12:00:00.000Z'),
};

const CONSENTED = {
  analysis_consent: true,
  advice_consent: true,
  availability_shared: true,
  quiet_start_min: null,
  quiet_end_min: null,
  policy_version: '1.0',
  updated_at: new Date('2026-06-01T12:00:00.000Z'),
};

describe('AI closeness reads (zero inference)', () => {
  it('returns a persisted fixture profile without touching the model', async () => {
    const db = createAiFakeDb({ signals: { 'you:alex': ALEX_SIGNALS }, profiles: { 'you:alex': ALEX_PROFILE } });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      for (let i = 0; i < 3; i += 1) {
        const res = await app.inject({ method: 'GET', url: '/ai-circle/closeness/alex' });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { level: number; level_source: string };
        expect(body.level).toBe(4);
        expect(body.level_source).toBe('demo_profile');
      }
      expect(provider.calls.assess).toHaveLength(0);
      expect(provider.calls.advise).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('prefers a manual override and labels it as the user choice', async () => {
    const db = createAiFakeDb({
      signals: { 'you:alex': ALEX_SIGNALS },
      profiles: { 'you:alex': ALEX_PROFILE },
      overrides: { 'you:alex': { level: 5, updated_at: new Date() } },
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const res = await app.inject({ method: 'GET', url: '/ai-circle/closeness/alex' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { level: number; level_source: string };
      expect(body.level).toBe(5);
      expect(body.level_source).toBe('user_choice');
      expect(provider.calls.assess).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('abstains honestly when no profile exists', async () => {
    const db = createAiFakeDb({});
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await app.inject({ method: 'GET', url: '/ai-circle/closeness/alex' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { level: unknown; level_label: string; level_source: string };
      expect(body.level).toBe(null);
      expect(body.level_source).toBe('none');
      expect(body.level_label).toBe('Not enough information');
    } finally {
      await app.close();
    }
  });

  it('returns 404 for blocked and unknown friends', async () => {
    const db = createAiFakeDb({ relationships: { 'you:alex': 'approved', 'you:eve': 'blocked' } });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      for (const id of ['eve', 'nobody']) {
        const res = await app.inject({ method: 'GET', url: `/ai-circle/closeness/${id}` });
        expect(res.statusCode).toBe(404);
      }
      const self = await app.inject({ method: 'GET', url: '/ai-circle/closeness/you' });
      expect(self.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('suppresses stored AI estimates while analysis consent is off', async () => {
    const live = { ...ALEX_PROFILE, source: 'meta_live', model_id: 'muse-spark-1.3' };
    const db = createAiFakeDb({
      signals: { 'you:alex': ALEX_SIGNALS },
      profiles: { 'you:alex': live },
      prefs: { you: { ...CONSENTED, analysis_consent: false } },
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await app.inject({ method: 'GET', url: '/ai-circle/closeness/alex' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { level: unknown; level_source: string };
      expect(body.level).toBe(null);
      expect(body.level_source).toBe('none');
    } finally {
      await app.close();
    }
  });
});

describe('AI settings and consent revocation', () => {
  it('defaults every new consent to off', async () => {
    const db = createAiFakeDb({});
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await app.inject({ method: 'GET', url: '/ai-circle/settings' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { settings: Record<string, unknown> };
      expect(body.settings['analysis_consent']).toBe(false);
      expect(body.settings['advice_consent']).toBe(false);
      expect(body.settings['availability_shared']).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('updates consent and revoking analysis cancels jobs and purges derived data', async () => {
    const db = createAiFakeDb({
      signals: { 'you:alex': ALEX_SIGNALS },
      profiles: { 'you:alex': ALEX_PROFILE },
      overrides: { 'you:alex': { level: 5, updated_at: new Date() } },
      prefs: { you: CONSENTED },
      jobs: [
        {
          id: 1, owner_id: 'you', friend_id: 'alex', status: 'pending', reason: 'material',
          fingerprint: 'x', attempts: 0, trace_id: 't', error: null,
          created_at: new Date(), started_at: null, finished_at: null,
        },
      ],
      advice: [
        {
          owner_id: 'you', friend_id: 'alex', advice_key: 'k', outcome: 'suggest',
          reason: 'r', activity: 'coffee', invitation_draft: '', source: 'meta_live',
          model_id: 'muse-spark-1.3', generated_at: new Date(), expires_at: new Date(Date.now() + 3600000),
        },
      ],
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/ai-circle/settings',
        payload: { analysis_consent: false },
      });
      expect(res.statusCode).toBe(200);
      expect(db.state.jobs[0]?.['status']).toBe('cancelled');
      expect(db.state.profiles['you:alex']?.['status']).toBe('revoked');
      expect(db.state.signals['you:alex']).toBe(undefined);
      expect(db.state.advice).toHaveLength(0);
      // Manual override is user choice: always kept.
      expect(db.state.overrides['you:alex']).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it('rejects malformed settings payloads', async () => {
    const db = createAiFakeDb({});
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      for (const payload of [
        { analysis_consent: 'yes' },
        { quiet_start_min: 1500 },
        { quiet_end_min: -1 },
      ]) {
        const res = await app.inject({ method: 'PUT', url: '/ai-circle/settings', payload });
        expect(res.statusCode).toBe(400);
      }
      // A non-object JSON body must reach our validator (400). A raw string
      // without a JSON content-type is 415 from Fastify itself — framework
      // behavior we intentionally preserve.
      const nonObject = await app.inject({
        method: 'PUT',
        url: '/ai-circle/settings',
        payload: '"nope"',
        headers: { 'content-type': 'application/json' },
      });
      expect(nonObject.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe('AI overrides', () => {
  it('saves, displays and clears a manual tier override', async () => {
    const db = createAiFakeDb({ signals: { 'you:alex': ALEX_SIGNALS }, profiles: { 'you:alex': ALEX_PROFILE } });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const saved = await app.inject({ method: 'PUT', url: '/ai-circle/closeness/alex', payload: { level: 2 } });
      expect(saved.statusCode).toBe(200);
      expect((saved.json() as { level: number }).level).toBe(2);
      expect((saved.json() as { level_source: string }).level_source).toBe('user_choice');
      const cleared = await app.inject({ method: 'PUT', url: '/ai-circle/closeness/alex', payload: { level: null } });
      expect(cleared.statusCode).toBe(200);
      expect((cleared.json() as { level: number }).level).toBe(4);
    } finally {
      await app.close();
    }
  });

  it('rejects invalid override levels', async () => {
    const db = createAiFakeDb({});
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      for (const payload of [{ level: 0 }, { level: 6 }, { level: 'high' }, {}]) {
        const res = await app.inject({ method: 'PUT', url: '/ai-circle/closeness/alex', payload: payload as never });
        expect(res.statusCode).toBe(400);
      }
    } finally {
      await app.close();
    }
  });
});

describe('AI signal events and reassessment gating', () => {
  function seededDb() {
    return createAiFakeDb({
      signals: { 'you:alex': { ...ALEX_SIGNALS } },
      profiles: { 'you:alex': { ...ALEX_PROFILE, baseline: { ...ALEX_PROFILE.baseline } } },
      prefs: { you: { ...CONSENTED } },
    });
  }

  it('ignores trivial mention-like events: no material change, no job', async () => {
    const db = seededDb();
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/ai-circle/demo/signal-event',
        payload: { friend_id: 'alex', type: 'mention_like' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { material: boolean; queued: boolean; queue_note: string };
      expect(body.material).toBe(false);
      expect(body.queued).toBe(false);
      expect(body.queue_note).toBe('not-material');
      expect(db.state.jobs).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('treats a single meetup as immaterial but two as a material change', async () => {
    const db = seededDb();
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const first = await app.inject({
        method: 'POST',
        url: '/ai-circle/demo/signal-event',
        payload: { friend_id: 'alex', type: 'confirmed_meetup' },
      });
      expect((first.json() as { material: boolean }).material).toBe(false);
      const second = await app.inject({
        method: 'POST',
        url: '/ai-circle/demo/signal-event',
        payload: { friend_id: 'alex', type: 'confirmed_meetup' },
      });
      const body = second.json() as { material: boolean; queued: boolean; reasons: string[] };
      expect(body.material).toBe(true);
      expect(body.queued).toBe(true);
      expect(body.reasons.join(' ')).toContain('meetups');
    } finally {
      await app.close();
    }
  });

  it('treats a user-declared relationship change as material', async () => {
    const db = seededDb();
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/ai-circle/demo/signal-event',
        payload: { friend_id: 'alex', type: 'declared_change', declared_closeness: 'inner_circle' },
      });
      const body = res.json() as { material: boolean; queued: boolean };
      expect(body.material).toBe(true);
      expect(body.queued).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('refuses to queue while consent is off or a job is already live', async () => {
    const noConsent = createAiFakeDb({
      signals: { 'you:alex': { ...ALEX_SIGNALS } },
      profiles: { 'you:alex': { ...ALEX_PROFILE, baseline: { ...ALEX_PROFILE.baseline } } },
      prefs: { you: { ...CONSENTED, analysis_consent: false } },
    });
    const app = await buildApp({ db: noConsent, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      await app.inject({ method: 'POST', url: '/ai-circle/demo/signal-event', payload: { friend_id: 'alex', type: 'confirmed_meetup' } });
      const res = await app.inject({ method: 'POST', url: '/ai-circle/demo/signal-event', payload: { friend_id: 'alex', type: 'confirmed_meetup' } });
      expect((res.json() as { queue_note: string }).queue_note).toBe('no-consent');
    } finally {
      await app.close();
    }
    const liveActive = seededDb();
    liveActive.state.jobs.push({
      id: 9, owner_id: 'you', friend_id: 'alex', status: 'pending', reason: 'material',
      fingerprint: 'x', attempts: 0, trace_id: 't', error: null,
      created_at: new Date(), started_at: null, finished_at: null,
    });
    const app2 = await buildApp({ db: liveActive, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      await app2.inject({ method: 'POST', url: '/ai-circle/demo/signal-event', payload: { friend_id: 'alex', type: 'confirmed_meetup' } });
      const res = await app2.inject({ method: 'POST', url: '/ai-circle/demo/signal-event', payload: { friend_id: 'alex', type: 'confirmed_meetup' } });
      expect((res.json() as { queue_note: string }).queue_note).toBe('live-active');
    } finally {
      await app2.close();
    }
  });

  it('hides the demo event endpoint outside demo mode', async () => {
    const db = seededDb();
    const app = await buildApp({
      db,
      ai: { provider: createCountingProvider(), config: { ...CONFIG, demoMode: false } },
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/ai-circle/demo/signal-event',
        payload: { friend_id: 'alex', type: 'mention_like' },
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

describe('AI assessment jobs', () => {
  it('runs an explicit assessment end to end and persists a live profile', async () => {
    const db = createAiFakeDb({
      signals: { 'you:alex': { ...ALEX_SIGNALS } },
      profiles: { 'you:alex': { ...ALEX_PROFILE, baseline: { ...ALEX_PROFILE.baseline } } },
      prefs: { you: { ...CONSENTED } },
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      const res = await app.inject({ method: 'POST', url: '/ai-circle/closeness/alex/assess' });
      expect(res.statusCode).toBe(202);
      // The route kicks the runner fire-and-forget; awaiting the drain joins
      // it, so assert converged state rather than the racy returned summary.
      await processPendingJobs(db, provider, CONFIG);
      expect(db.state.jobs.find((j) => j['status'] === 'completed')).toBeDefined();
      expect(provider.calls.assess).toHaveLength(1);
      const profile = db.state.profiles['you:alex'];
      expect(profile?.['source']).toBe('meta_live');
      expect(profile?.['model_id']).toBe('muse-spark-1.3');
      expect(profile?.['level']).toBe(4);
      const usage = await app.inject({ method: 'GET', url: '/ai-circle/usage' });
      expect((usage.json() as { usage: { model_requests: number } }).usage.model_requests).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('requires analysis consent and enforces the explicit daily limit', async () => {
    const db = createAiFakeDb({
      signals: { 'you:alex': { ...ALEX_SIGNALS } },
      prefs: { you: { ...CONSENTED, analysis_consent: false } },
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const denied = await app.inject({ method: 'POST', url: '/ai-circle/closeness/alex/assess' });
      expect(denied.statusCode).toBe(403);
    } finally {
      await app.close();
    }
    const limited = createAiFakeDb({
      signals: { 'you:alex': { ...ALEX_SIGNALS } },
      prefs: { you: { ...CONSENTED } },
      jobs: [
        {
          id: 1, owner_id: 'you', friend_id: 'alex', status: 'completed', reason: 'explicit',
          fingerprint: 'x', attempts: 1, trace_id: 't', error: null,
          created_at: new Date('2026-06-01T08:00:00.000Z'), started_at: null, finished_at: new Date(),
        },
      ],
    });
    const app2 = await buildApp({ db: limited, ai: { provider: createCountingProvider(), config: CONFIG } });
    try {
      const res = await app2.inject({ method: 'POST', url: '/ai-circle/closeness/alex/assess' });
      expect(res.statusCode).toBe(429);
    } finally {
      await app2.close();
    }
  });

  it('marks jobs unavailable without a key and never calls the model', async () => {
    const db = createAiFakeDb({
      signals: { 'you:alex': { ...ALEX_SIGNALS } },
      prefs: { you: { ...CONSENTED } },
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: NO_KEY } });
    try {
      const res = await app.inject({ method: 'POST', url: '/ai-circle/closeness/alex/assess' });
      expect(res.statusCode).toBe(202);
      // Join the route's fire-and-forget runner, then assert converged state.
      await processPendingJobs(db, provider, NO_KEY);
      expect(provider.calls.assess).toHaveLength(0);
      expect(db.state.jobs.find((j) => j['status'] === 'unavailable')).toBeDefined();
      expect(db.state.jobs[0]?.['status']).toBe('unavailable');
    } finally {
      await app.close();
    }
  });

  it('retries transient failures within bounds, then fails terminally', async () => {
    const db = createAiFakeDb({
      signals: { 'you:alex': { ...ALEX_SIGNALS } },
      prefs: { you: { ...CONSENTED } },
    });
    const transient = new ApiError(429, 'ai rate limited');
    (transient as { transient?: boolean }).transient = true;
    const provider = createCountingProvider({ failAssess: transient });
    await requestAssessment(db, 'you', 'alex', CONFIG);
    const summary = await processPendingJobs(db, provider, CONFIG);
    expect(summary.failed).toBe(1);
    expect(provider.calls.assess).toHaveLength(3);
    expect(db.state.jobs[0]?.['attempts']).toBe(3);
    expect(db.state.jobs[0]?.['status']).toBe('failed');
  });

  it('keeps manual overrides intact when AI evidence arrives', async () => {
    const db = createAiFakeDb({
      signals: { 'you:alex': { ...ALEX_SIGNALS } },
      profiles: { 'you:alex': { ...ALEX_PROFILE, baseline: { ...ALEX_PROFILE.baseline } } },
      overrides: { 'you:alex': { level: 2, updated_at: new Date() } },
      prefs: { you: { ...CONSENTED } },
    });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    try {
      await app.inject({ method: 'POST', url: '/ai-circle/closeness/alex/assess' });
      await processPendingJobs(db, provider, CONFIG);
      expect(db.state.overrides['you:alex']).toEqual({ level: 2, updated_at: expect.any(Date) });
      const view = await app.inject({ method: 'GET', url: '/ai-circle/closeness/alex' });
      const body = view.json() as { level: number; level_source: string };
      expect(body.level).toBe(2);
      expect(body.level_source).toBe('user_choice');
    } finally {
      await app.close();
    }
  });
});
