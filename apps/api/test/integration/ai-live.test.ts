import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { databaseUrl } from '../../src/db.js';
import { processPendingJobs } from '../../src/ai/aiCircle.js';
import { createMetaModelProvider } from '../../src/ai/metaModelProvider.js';
import { readAiCircleConfig } from '../../src/ai/types.js';

// Live-model smoke suite. Runs ONLY via `npm run test:integration` with
// RUN_INTEGRATION_TESTS=1 against a seeded stack, and only when
// MODEL_API_KEY is set — it skips loudly otherwise (never a fake pass).
if (process.env['RUN_INTEGRATION_TESTS'] !== '1') {
  throw new Error(
    'integration tests require RUN_INTEGRATION_TESTS=1, a seeded stack, and live service access',
  );
}

const HAS_KEY = (process.env['MODEL_API_KEY'] ?? '').trim() !== '';
const maybe = HAS_KEY ? describe : describe.skip;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

maybe('AI Circle Intelligence (live Meta Model API)', () => {
  it(
    'assesses Alex live and persists a real inference profile',
    { timeout: 120000 },
    async () => {
      const config = { ...readAiCircleConfig(), demoMode: false };
      const provider = createMetaModelProvider({ config });
      const pool = new Pool({ connectionString: databaseUrl() });
      const app = await buildApp({ ai: { provider, config } });
      try {
        const consent = await app.inject({
          method: 'PUT',
          url: '/ai-circle/settings',
          payload: { analysis_consent: true, advice_consent: true },
        });
        expect(consent.statusCode).toBe(200);
        const enqueued = await app.inject({
          method: 'POST',
          url: '/ai-circle/closeness/alex/assess',
        });
        expect(enqueued.statusCode).toBe(202);
        // Either the route's runner kick or this explicit drain processes the
        // job; wait for the persisted live estimate either way.
        const deadline = Date.now() + 100000;
        let view: { level_source: string; model_id: string | null; level: number | null } = {
          level_source: 'none',
          model_id: null,
          level: null,
        };
        for (;;) {
          await processPendingJobs(pool, provider, config).catch(() => undefined);
          const res = await app.inject({ method: 'GET', url: '/ai-circle/closeness/alex' });
          expect(res.statusCode).toBe(200);
          view = res.json() as typeof view;
          if (view.level_source === 'ai_estimate' || Date.now() > deadline) break;
          await sleep(2000);
        }
        expect(view.level_source).toBe('ai_estimate');
        expect(view.model_id).toBe('muse-spark-1.3');
        expect(view.level === null || (view.level >= 1 && view.level <= 5)).toBe(true);
      } finally {
        await app.close();
        await pool.end();
      }
    },
  );

  it('advises a meetup live with strict provenance', async () => {
    const config = { ...readAiCircleConfig(), demoMode: false };
    const provider = createMetaModelProvider({ config });
    const app = await buildApp({ ai: { provider, config } });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/ai-circle/opportunities/alex/advise',
        payload: { radius_m: 1000, display_name: 'Alex' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        source: string;
        outcome: string;
        model_id: string | null;
        reason: string;
      };
      expect(['meta_live', 'meta_cached']).toContain(body.source);
      expect(['suggest', 'later', 'insufficient_context']).toContain(body.outcome);
      if (body.source === 'meta_live') {
        expect(body.model_id).toBe('muse-spark-1.3');
      }
    } finally {
      await app.close();
    }
  });
});
