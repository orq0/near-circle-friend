import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /health', () => {
  it('responds ok with service identity', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        status: 'ok',
        service: 'near-circle-api',
        version: '0.1.0',
        phase: 1,
      });
    } finally {
      await app.close();
    }
  });
});
