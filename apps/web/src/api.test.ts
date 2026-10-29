import { describe, expect, it } from 'vitest';
import { requestAdvice } from './api';

// Plain fetch stubs (no runner-specific mocks) so this also executes under a
// minimal describe/it/expect shim where vitest's `vi` is unavailable.
const realFetch = globalThis.fetch;

function mockFetch(status: number, body: unknown, exploding = false) {
  globalThis.fetch = (async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: exploding
      ? async () => {
          throw new Error('empty body');
        }
      : async () => body,
  })) as unknown as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

describe('requestAdvice rate-limit mapping', () => {
  it('maps a per-friend cooldown 429 to pair_limited, not the budget message', async () => {
    try {
      mockFetch(429, { error: 'ai rate limited for this friend' });
      expect(await requestAdvice('coleen', 'Coleen', 500)).toEqual({ kind: 'pair_limited' });
    } finally {
      restoreFetch();
    }
  });

  it('keeps true budget exhaustion on the budget message', async () => {
    try {
      mockFetch(429, { error: 'ai daily budget reached' });
      expect(await requestAdvice('coleen', 'Coleen', 500)).toEqual({ kind: 'rate_limited' });
      mockFetch(429, { error: 'ai rate limited' });
      expect(await requestAdvice('coleen', 'Coleen', 500)).toEqual({ kind: 'rate_limited' });
    } finally {
      restoreFetch();
    }
  });

  it('falls back to the budget message when the 429 body is unreadable', async () => {
    try {
      mockFetch(429, null, true);
      expect(await requestAdvice('coleen', 'Coleen', 500)).toEqual({ kind: 'rate_limited' });
    } finally {
      restoreFetch();
    }
  });
});
