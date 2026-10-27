import { buildApp } from './dbg4/src/app.js';
import { processPendingJobs } from './dbg4/src/ai/aiCircle.js';
import { DEFAULT_AI_CIRCLE_CONFIG } from './dbg4/src/ai/types.js';
import { createAiFakeDb, createCountingProvider } from './dbg4/test/aiHelpers.js';

const CONFIG = { ...DEFAULT_AI_CIRCLE_CONFIG, apiKey: 'probe-key' };

// Mirror the test file: module-level shared fixtures.
const ALEX_PROFILE = {
  level: 4, evidence_quality: 'moderate', rationale: 'r', activity_trend: 'stable',
  source: 'demo_fixture', model_id: null, signals_version: 1, fingerprint: 'seed-v1',
  baseline: {}, policy_version: '1.0', status: 'active',
  assessed_at: new Date('2026-05-01T12:00:00Z'), updated_at: new Date('2026-05-01T12:00:00Z'),
};
const CONSENTED = {
  analysis_consent: true, advice_consent: true, availability_shared: true,
  quiet_start_min: null, quiet_end_min: null, policy_version: '1.0', updated_at: new Date(),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // --- Repro 1: revoke test poisons the shared ALEX_PROFILE constant ---
  {
    const db = createAiFakeDb({
      profiles: { 'you:alex': ALEX_PROFILE }, // by reference, like the test file
      prefs: { you: CONSENTED },
    });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    await app.inject({ method: 'PUT', url: '/ai-circle/settings', payload: { analysis_consent: false } });
    console.log(`REPRO-1 shared ALEX_PROFILE.status after revoke test = '${ALEX_PROFILE.status}' (want 'active')`);
    await app.close();
  }
  // --- Repro 2: a LATER test seeding the same constant now reads suppressed ---
  {
    const db = createAiFakeDb({ profiles: { 'you:alex': { ...ALEX_PROFILE } } });
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    const res = await app.inject({ method: 'GET', url: '/ai-circle/closeness/alex' });
    const body = res.json();
    console.log(`REPRO-2 later closeness read: level=${body.level} source=${body.level_source} (want 4/demo_profile)`);
    await app.close();
  }
  // --- Verify 3: converged state is deterministic regardless of who wins the race ---
  for (const mode of ['kick-first', 'drain-first']) {
    const db = createAiFakeDb({ prefs: { you: { ...CONSENTED } } });
    const provider = createCountingProvider();
    const app = await buildApp({ db, ai: { provider, config: CONFIG } });
    await app.inject({ method: 'POST', url: '/ai-circle/closeness/alex/assess' });
    if (mode === 'kick-first') await sleep(50); // let the route kick finish first
    await processPendingJobs(db, provider, CONFIG);
    const done = db.state.jobs.find((j) => j.status === 'completed') !== undefined;
    const profile = db.state.profiles['you:alex'];
    console.log(`${mode}: jobCompleted=${done} calls=${provider.calls.assess.length} profile=${profile?.source}/${profile?.level} (all must be true/1/meta_live/4)`);
    await app.close();
  }
  // --- Verify 4: malformed JSON body reaches our validator (400); raw text stays 415 ---
  {
    const db = createAiFakeDb({});
    const app = await buildApp({ db, ai: { provider: createCountingProvider(), config: CONFIG } });
    const json = await app.inject({ method: 'PUT', url: '/ai-circle/settings', payload: '"nope"', headers: { 'content-type': 'application/json' } });
    const raw = await app.inject({ method: 'PUT', url: '/ai-circle/settings', payload: 'nope' });
    console.log(`JSON-string body=${json.statusCode} (want 400); raw text/plain body=${raw.statusCode} (want 415, Fastify behavior)`);
    await app.close();
  }
})().catch((err) => { console.error('PROBE CRASH', err); process.exit(1); });
