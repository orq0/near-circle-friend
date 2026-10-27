import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ApiError } from '../src/errors.js';
import { type RouteResult, type WalkingRoutingProvider } from '../src/routing/types.js';
import { createFakeDb } from './helpers.js';

const ROUTE_DETAIL = {
  id: 'coleen',
  display_name: 'Coleen',
  near_circle_enabled: true,
  fresh: true,
  lat: 14.5828,
  lon: 120.9768,
  straight_line_m: 280.1,
};

const PROVIDER_ROUTE: RouteResult = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [120.975, 14.581],
      [120.976, 14.582],
      [120.9768, 14.5828],
    ],
  },
  distance_m: 340.5,
  duration_s: 245.2,
};

function stubProvider(route: RouteResult): WalkingRoutingProvider {
  return { name: 'stub', route: async () => route };
}

function failingProvider(statusCode: number, message: string): WalkingRoutingProvider {
  return {
    name: 'stub',
    route: async () => {
      throw new ApiError(statusCode, message);
    },
  };
}

describe('GET /friends/:id/route', () => {
  it('returns a consent-checked route with steps', async () => {
    const app = await buildApp({
      db: createFakeDb({ routeDetail: ROUTE_DETAIL }),
      routing: stubProvider(PROVIDER_ROUTE),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/coleen/route?radius_m=1000' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        demo: boolean;
        radius_m: number;
        route: {
          to: { id: string };
          geometry: { type: string; coordinates: unknown[] };
          route_distance_m: number;
          straight_line_m: number;
          duration_s: number;
          estimated_steps: number;
          stride_m: number;
        };
      };
      expect(body.demo).toBe(true);
      expect(body.route.to.id).toBe('coleen');
      expect(body.route.geometry.type).toBe('LineString');
      expect(body.route.geometry.coordinates).toHaveLength(3);
      expect(body.route.route_distance_m).toBe(340.5);
      expect(body.route.straight_line_m).toBe(280.1);
      expect(body.route.estimated_steps).toBe(454);
      expect(body.route.stride_m).toBe(0.75);
    } finally {
      await app.close();
    }
  });

  it('honors a stride override', async () => {
    const app = await buildApp({
      db: createFakeDb({ routeDetail: ROUTE_DETAIL }),
      routing: stubProvider(PROVIDER_ROUTE),
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/friends/coleen/route?radius_m=1000&stride_m=0.8',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { route: { estimated_steps: number; stride_m: number } };
      expect(body.route.estimated_steps).toBe(426);
      expect(body.route.stride_m).toBe(0.8);
    } finally {
      await app.close();
    }
  });

  it('validates id, radius, and stride with 400', async () => {
    const app = await buildApp({
      db: createFakeDb({ routeDetail: ROUTE_DETAIL }),
      routing: stubProvider(PROVIDER_ROUTE),
    });
    try {
      for (const url of [
        '/friends/coleen/route?radius_m=abc',
        '/friends/coleen/route?radius_m=0',
        '/friends/coleen/route?stride_m=-1',
        '/friends/coleen/route?stride_m=nope',
      ]) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(400);
      }
    } finally {
      await app.close();
    }
  });

  it('returns 404 for unknown friends and non-friends', async () => {
    const app = await buildApp({
      db: createFakeDb({ routeDetail: null }),
      routing: stubProvider(PROVIDER_ROUTE),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/nina/route' });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('denies routing with 403 when consent is gone', async () => {
    for (const routeDetail of [
      { ...ROUTE_DETAIL, near_circle_enabled: false },
      { ...ROUTE_DETAIL, fresh: false },
    ]) {
      const app = await buildApp({
        db: createFakeDb({ routeDetail }),
        routing: stubProvider(PROVIDER_ROUTE),
      });
      try {
        const res = await app.inject({ method: 'GET', url: '/friends/coleen/route' });
        expect(res.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    }
  });

  it('denies routing with 403 outside the radius', async () => {
    const app = await buildApp({
      db: createFakeDb({ routeDetail: ROUTE_DETAIL }),
      routing: stubProvider(PROVIDER_ROUTE),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/coleen/route?radius_m=100' });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('denies routing with 403 when the requester is disabled', async () => {
    const app = await buildApp({
      db: createFakeDb({
        routeDetail: ROUTE_DETAIL,
        requester: { enabled: false, radius_m: 1000, located: true, lat: 14.581, lon: 120.975 },
      }),
      routing: stubProvider(PROVIDER_ROUTE),
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/friends/coleen/route' });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('propagates provider failures honestly', async () => {
    for (const [status, message] of [
      [404, 'no walking route found'],
      [503, 'routing provider unreachable'],
      [504, 'routing provider timed out'],
    ] as const) {
      const app = await buildApp({
        db: createFakeDb({ routeDetail: ROUTE_DETAIL }),
        routing: failingProvider(status, message),
      });
      try {
        const res = await app.inject({ method: 'GET', url: '/friends/coleen/route' });
        expect(res.statusCode).toBe(status);
      } finally {
        await app.close();
      }
    }
  });
});
