import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createFakeDb } from './helpers.js';

describe('near-circle visibility', () => {
  it('reads the current activation state', async () => {
    const app = await buildApp({
      db: createFakeDb({ visibilityRow: [{ enabled: true, radius_m: 2000 }] }),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/near-circle/visibility' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ enabled: true, radius_m: 2000 });
    } finally {
      await app.close();
    }
  });

  it('defaults to disabled when no row exists', async () => {
    const app = await buildApp({ db: createFakeDb({ visibilityRow: [] }) });
    try {
      const res = await app.inject({ method: 'GET', url: '/near-circle/visibility' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ enabled: false, radius_m: 1000 });
    } finally {
      await app.close();
    }
  });

  it('updates activation via PUT with optional radius', async () => {
    const app = await buildApp({
      db: createFakeDb({ visibilitySaved: { enabled: false, radius_m: 5000 } }),
    });
    try {
      const res = await app.inject({
        method: 'PUT',
        url: '/near-circle/visibility',
        payload: { enabled: false, radius_m: 5000 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ enabled: false, radius_m: 5000 });
    } finally {
      await app.close();
    }
  });

  it('toggles activation via POST alias', async () => {
    const app = await buildApp({
      db: createFakeDb({ visibilitySaved: { enabled: true, radius_m: 1000 } }),
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/near-circle/toggle',
        payload: { enabled: true },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ enabled: true, radius_m: 1000 });
    } finally {
      await app.close();
    }
  });

  it('rejects invalid visibility payloads with 400', async () => {
    const app = await buildApp({
      db: createFakeDb({ visibilitySaved: { enabled: true, radius_m: 1000 } }),
    });
    try {
      for (const payload of [
        {},
        { enabled: 'yes' },
        { enabled: true, radius_m: 0 },
        { enabled: true, radius_m: 200000 },
      ]) {
        const res = await app.inject({
          method: 'PUT',
          url: '/near-circle/visibility',
          payload,
        });
        expect(res.statusCode).toBe(400);
      }
      const toggle = await app.inject({
        method: 'POST',
        url: '/near-circle/toggle',
        payload: { enabled: 1 },
      });
      expect(toggle.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
