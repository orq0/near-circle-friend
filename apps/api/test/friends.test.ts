import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createFakeDb } from './helpers.js';

describe('GET /friends', () => {
  it('lists approved friends with status facts', async () => {
    const app = await buildApp({
      db: createFakeDb({
        friends: [
          { id: 'coleen', display_name: 'Coleen', near_circle_enabled: true, location_state: 'fresh' },
          { id: 'marco', display_name: 'Marco', near_circle_enabled: false, location_state: 'fresh' },
        ],
      }),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { demo: boolean; friends: unknown[] };
      expect(body.demo).toBe(true);
      expect(body.friends).toHaveLength(2);
    } finally {
      await app.close();
    }
  });
});

describe('GET /friends/:id', () => {
  const detail = {
    id: 'coleen',
    display_name: 'Coleen',
    near_circle_enabled: true,
    fresh: true,
    distance_m: 280.1,
    bearing_deg: 45.0,
  };

  it('returns proximity when the friend is discoverable', async () => {
    const app = await buildApp({ db: createFakeDb({ detail }) });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/coleen?radius_m=1000' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        demo: true,
        radius_m: 1000,
        id: 'coleen',
        display_name: 'Coleen',
        near_circle_enabled: true,
        discoverable: true,
        distance_m: 280.1,
        bearing_deg: 45.0,
      });
    } finally {
      await app.close();
    }
  });

  it('withholds proximity beyond the radius', async () => {
    const app = await buildApp({ db: createFakeDb({ detail }) });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/coleen?radius_m=100' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { discoverable: boolean; distance_m: unknown; bearing_deg: unknown };
      expect(body.discoverable).toBe(false);
      expect(body.distance_m).toBe(null);
      expect(body.bearing_deg).toBe(null);
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown friends and non-friends', async () => {
    const app = await buildApp({ db: createFakeDb({ detail: null }) });
    try {
      for (const id of ['nina', 'nobody']) {
        const res = await app.inject({ method: 'GET', url: `/friends/${id}` });
        expect(res.statusCode).toBe(404);
      }
    } finally {
      await app.close();
    }
  });

  it('denies detail with 403 when the requester disabled Near-Circle', async () => {
    const app = await buildApp({
      db: createFakeDb({
        detail,
        requester: { enabled: false, radius_m: 1000, located: true, lat: 14.581, lon: 120.975 },
      }),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/coleen' });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
