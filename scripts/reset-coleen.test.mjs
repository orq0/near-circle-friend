// Reset-logic tests for scripts/reset-coleen.mjs. Runs dependency-free via
// node:test + node:assert (`npm run test:scripts`), mirroring judges.test.mjs.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyNotFound, resetColeen, resolveBaseUrl } from './reset-coleen.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function scriptedFetch(script) {
  const calls = [];
  let index = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const step = script[Math.min(index, script.length - 1)];
    index += 1;
    if (step instanceof Error) throw step;
    return step;
  };
  return { fetchImpl, calls };
}

const noSleep = async () => undefined;

describe('reset:coleen', () => {
  it('reports cleared counts on success', async () => {
    const { fetchImpl, calls } = scriptedFetch([response(200, { restored: true, friend_id: 'coleen', feedback_cleared: 1, advice_cleared: 2 })]);
    const result = await resetColeen({ fetchImpl, baseUrl: 'http://localhost:3001', sleep: noSleep });
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 1);
    assert.deepEqual(result.cleared, { feedback_cleared: 1, advice_cleared: 2 });
    assert.match(result.message, /Coleen restored/);
    assert.equal(calls[0].url, 'http://localhost:3001/ai-circle/demo/coleen-restore');
    assert.equal(calls[0].init.method, 'POST');
  });

  it('retries transient 503s, then succeeds', async () => {
    const { fetchImpl } = scriptedFetch([
      response(503, { error: 'database unavailable' }),
      response(503, { error: 'database unavailable' }),
      response(200, { restored: true, friend_id: 'coleen', feedback_cleared: 0, advice_cleared: 1 }),
    ]);
    const result = await resetColeen({ fetchImpl, baseUrl: 'http://x', sleep: noSleep });
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 3);
  });

  it('gives up on persistent 503s with a Postgres hint, without masking', async () => {
    const { fetchImpl } = scriptedFetch([response(503, { error: 'database unavailable' })]);
    const result = await resetColeen({ fetchImpl, baseUrl: 'http://x', maxAttempts: 3, sleep: noSleep });
    assert.equal(result.ok, false);
    assert.equal(result.attempts, 3);
    assert.match(result.message, /Postgres/);
  });

  it('reports unreachable API without retrying forever', async () => {
    const refused = new Error('connect ECONNREFUSED 127.0.0.1:3001');
    refused.code = 'ECONNREFUSED';
    const { fetchImpl } = scriptedFetch([refused]);
    const result = await resetColeen({ fetchImpl, baseUrl: 'http://localhost:3001', maxAttempts: 2, sleep: noSleep });
    assert.equal(result.ok, false);
    assert.equal(result.attempts, 2);
    assert.match(result.message, /not reachable/);
  });

  it('distinguishes a flag-gated 404 from a stale-image 404, retrying neither', async () => {
    const gated = scriptedFetch([response(404, { error: 'not found' })]);
    const gatedResult = await resetColeen({ fetchImpl: gated.fetchImpl, baseUrl: 'http://x', sleep: noSleep });
    assert.equal(gatedResult.ok, false);
    assert.equal(gatedResult.attempts, 1);
    assert.match(gatedResult.message, /AI_CIRCLE_DEMO_AVAILABILITY=1/);

    const stale = scriptedFetch([
      response(404, { message: 'Route POST:/ai-circle/demo/coleen-restore not found', error: 'Not Found', statusCode: 404 }),
    ]);
    const staleResult = await resetColeen({ fetchImpl: stale.fetchImpl, baseUrl: 'http://x', sleep: noSleep });
    assert.equal(staleResult.ok, false);
    assert.equal(staleResult.attempts, 1);
    assert.match(staleResult.message, /predates/);
  });

  it('classifies 404 bodies', () => {
    assert.equal(classifyNotFound({ error: 'Not Found' }), 'stale-api');
    assert.equal(classifyNotFound({ error: 'not found' }), 'gated');
    assert.equal(classifyNotFound(null), 'gated');
  });

  it('resolves the base URL from API_BASE_URL, API_PORT, then default', () => {
    assert.equal(resolveBaseUrl({ API_BASE_URL: 'http://api:4000/', API_PORT: '9999' }), 'http://api:4000');
    assert.equal(resolveBaseUrl({ API_PORT: '4000' }), 'http://localhost:4000');
    assert.equal(resolveBaseUrl({}), 'http://localhost:3001');
  });

  it('is wired as npm run reset:coleen', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts['reset:coleen'], 'node ./scripts/reset-coleen.mjs');
  });
});
