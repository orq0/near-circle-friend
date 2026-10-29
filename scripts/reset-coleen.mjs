#!/usr/bin/env node
// Coleen demo reset: `npm run reset:coleen`.
// Reuses the existing POST /ai-circle/demo/coleen-restore endpoint (no second
// mechanism): clears Coleen's snooze/dismiss suppression plus her
// recommendation cooldown for the demo user. Other friends, AI usage
// counters, and Docker state are untouched. No restart needed.
//
// A bare 503 means the API momentarily cannot reach Postgres (stale pooled
// connection after a DB restart, DB still warming up); the pool self-heals,
// so this command retries those instead of failing the demo take.
// Exit code is 0 only on a restored Coleen.
import { setTimeout as delay } from 'node:timers/promises';

export const DEFAULT_API_PORT = '3001';
export const RESTORE_PATH = '/ai-circle/demo/coleen-restore';
export const DEFAULT_ATTEMPTS = 6;
export const DEFAULT_DELAY_MS = 2000;

/** Base URL: explicit API_BASE_URL wins, otherwise localhost + API_PORT. */
export function resolveBaseUrl(env = process.env) {
  const direct = env['API_BASE_URL']?.trim();
  if (direct !== undefined && direct !== '') return direct.replace(/\/$/, '');
  return `http://localhost:${env['API_PORT']?.trim() === '' || env['API_PORT'] === undefined ? DEFAULT_API_PORT : env['API_PORT']}`;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

async function readBody(res) {
  let text = '';
  try {
    text = await res.text();
  } catch {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text === '' ? null : text;
  }
}

/** 404 from Fastify routing (stale API image) vs 404 from the flag gate. */
export function classifyNotFound(body) {
  if (isRecord(body) && body['error'] === 'Not Found') return 'stale-api';
  return 'gated';
}

/**
 * POST the restore endpoint, retrying transient transport failures (fetch
 * errors and HTTP 503) with a delay. Never retries 4xx/200 outcomes.
 * Returns { ok, attempts, status?, cleared?, message }.
 */
export async function resetColeen({
  fetchImpl = globalThis.fetch,
  baseUrl = resolveBaseUrl(),
  maxAttempts = DEFAULT_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  sleep = delay,
} = {}) {
  const url = `${baseUrl}${RESTORE_PATH}`;
  let lastFailure = 'no attempts made';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res;
    try {
      // eslint-disable-next-line no-await-in-loop
      res = await fetchImpl(url, { method: 'POST' });
    } catch (err) {
      lastFailure = `API not reachable at ${baseUrl} (${err?.code ?? err?.message ?? err})`;
      if (attempt < maxAttempts) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(delayMs);
      }
      continue;
    }
    if (res.status === 503) {
      lastFailure = `API temporarily cannot reach Postgres (HTTP 503, attempt ${attempt}/${maxAttempts})`;
      if (attempt < maxAttempts) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(delayMs);
      }
      continue;
    }
    if (res.status === 200) {
      // eslint-disable-next-line no-await-in-loop
      const body = await readBody(res);
      const feedback = isRecord(body) && typeof body['feedback_cleared'] === 'number' ? body['feedback_cleared'] : '?';
      const advice = isRecord(body) && typeof body['advice_cleared'] === 'number' ? body['advice_cleared'] : '?';
      return {
        ok: true,
        attempts: attempt,
        status: 200,
        cleared: { feedback_cleared: body?.['feedback_cleared'], advice_cleared: body?.['advice_cleared'] },
        message: `Coleen restored for the demo user (snooze/dismiss cleared: ${feedback}, cooldown cleared: ${advice}).`,
      };
    }
    if (res.status === 404) {
      // eslint-disable-next-line no-await-in-loop
      const kind = classifyNotFound(await readBody(res));
      return {
        ok: false,
        attempts: attempt,
        status: 404,
        message:
          kind === 'stale-api'
            ? 'Restore endpoint missing: the API image predates it. Rebuild/recreate the API container, then retry.'
            : 'Restore endpoint disabled: set AI_CIRCLE_DEMO_AVAILABILITY=1 and recreate the API container, then retry.',
      };
    }
    // eslint-disable-next-line no-await-in-loop
    const body = await readBody(res);
    return {
      ok: false,
      attempts: attempt,
      status: res.status,
      message: `Restore failed with HTTP ${res.status}: ${JSON.stringify(body) ?? 'no body'}.`,
    };
  }
  return {
    ok: false,
    attempts: maxAttempts,
    message: `${lastFailure}. Is Docker up (npm run status)? If the DB just restarted, wait a few seconds and retry.`,
  };
}

async function main() {
  const result = await resetColeen();
  console.log(result.message);
  process.exitCode = result.ok ? 0 : 1;
}

const invokedAsScript = process.argv[1] !== undefined && process.argv[1].replace(/\\/g, '/').endsWith('scripts/reset-coleen.mjs');
if (invokedAsScript) {
  await main();
}
