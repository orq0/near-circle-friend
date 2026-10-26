import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createFakeDb } from './helpers.js';

describe('PUT /location', () => {
  it('updates the demo user position', async () => {
    const app = await buildApp({
      db: createFakeDb({
        locationSaved: {
          lat: 14.6,
          lon: 121.0,
          updated_at: new Date('2026-01-01T00:00:00.000Z'),
          expires_at: new Date('2026-01-31T00:00:00.000Z'),
        },
      }),
    });
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/location',
        payload: { lat: 14.6, lon: 121.0 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        lat: 14.6,
        lon: 121.0,
        updated_at: '2026-01-01T00:00:00.000Z',
        expires_at: '2026-01-31T00:00:00.000Z',
      });
    } finally {
      await app.close();
    }
  });

  it('rejects out-of-bounds coordinates with 400', async () => {
    const app = await buildApp({ db: createFakeDb() });
    try {
      for (const payload of [
        { lat: 91, lon: 0 },
        { lat: 0, lon: 181 },
        { lat: 'x', lon: 0 },
        {},
      ]) {
        const res = await app.inject({ method: 'PUT', url: '/location', payload });
        expect(res.statusCode).toBe(400);
      }
    } finally {
      await app.close();
    }
  });
});
