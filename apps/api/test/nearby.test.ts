import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createFakeDb } from './helpers.js';

const NEARBY_ROWS = [
  { id: 'coleen', display_name: 'Coleen', distance_m: 280.1, bearing_deg: 45.0 },
  { id: 'alex', display_name: 'Alex', distance_m: 750.3, bearing_deg: 170.0 },
];

describe('GET /friends/nearby', () => {
  it('returns eligible friends with distances and bearings', async () => {
    const app = await buildApp({ db: createFakeDb({ nearby: NEARBY_ROWS }) });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=1000' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        demo: boolean;
        center: { lat: number; lon: number };
        radius_m: number;
        count: number;
        friends: typeof NEARBY_ROWS;
      };
      expect(body.demo).toBe(true);
      expect(body.center).toEqual({ lat: 14.581, lon: 120.975 });
      expect(body.radius_m).toBe(1000);
      expect(body.count).toBe(2);
      expect(body.friends[0]).toEqual(NEARBY_ROWS[0]);
    } finally {
      await app.close();
    }
  });

  it('defaults to a 1000 m radius and reports empty results', async () => {
    const app = await buildApp({ db: createFakeDb({ nearby: [] }) });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nearby' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { radius_m: number; count: number; friends: unknown[] };
      expect(body.radius_m).toBe(1000);
      expect(body.count).toBe(0);
      expect(body.friends).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('rejects invalid radii with 400', async () => {
    const app = await buildApp({ db: createFakeDb({ nearby: NEARBY_ROWS }) });
    try {
      for (const bad of ['abc', '0', '100001', '-10']) {
        const res = await app.inject({ method: 'GET', url: `/friends/nearby?radius_m=${bad}` });
        expect(res.statusCode).toBe(400);
      }
    } finally {
      await app.close();
    }
  });

  it('denies discovery with 403 when the requester disabled Near-Circle', async () => {
    const app = await buildApp({
      db: createFakeDb({
        nearby: NEARBY_ROWS,
        requester: { enabled: false, radius_m: 1000, located: true, lat: 14.581, lon: 120.975 },
      }),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=1000' });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('reports 409 when the requester location is missing or stale', async () => {
    const app = await buildApp({
      db: createFakeDb({
        nearby: NEARBY_ROWS,
        requester: { enabled: true, radius_m: 1000, located: false, lat: null, lon: null },
      }),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=1000' });
      expect(res.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it('reports 503 when the database is unreachable', async () => {
    const app = await buildApp({ db: createFakeDb({ connectionError: true }) });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=1000' });
      expect(res.statusCode).toBe(503);
    } finally {
      await app.close();
    }
  });

  it('reports 503 for socket-level denials as well', async () => {
    const app = await buildApp({
      db: createFakeDb({ connectionError: true, connectionCode: 'EACCES' }),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nearby?radius_m=1000' });
      expect(res.statusCode).toBe(503);
      const body = res.json() as { error: string };
      expect(body.error).toBe('database unavailable');
    } finally {
      await app.close();
    }
  });
});
