import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createOsrmProvider } from '../../src/routing/osrmProvider.js';

// Live-router suite. Runs ONLY via `npm run test:integration` with
// RUN_INTEGRATION_TESTS=1, and passes only after the Phase 3 graph bootstrap
// (`routing/prepare-graph.ps1`) produced a working pedestrian router.
// The gate throws loudly when unset: never a silent skip.
if (process.env['RUN_INTEGRATION_TESTS'] !== '1') {
  throw new Error(
    'integration tests require RUN_INTEGRATION_TESTS=1, a seeded stack, and a prepared router',
  );
}

// Vitest runs on the Windows host, outside the Compose network, so the
// Docker-internal ROUTING_WALK_URL (near-circle-routing-walk:5000) does not
// resolve here. Point the injected provider at the host-published router
// (ROUTING_WALK_HOST_URL, default localhost:5002). The containerized API
// keeps using ROUTING_WALK_URL via buildApp's default.
function hostRoutingProvider() {
  return createOsrmProvider({
    baseUrl: process.env['ROUTING_WALK_HOST_URL'] ?? 'http://localhost:5002',
  });
}

describe('pedestrian routing (live router)', () => {
  it('calculates a real Metro Manila walking route', async () => {
    const app = await buildApp({ routing: hostRoutingProvider() });
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/friends/coleen/route?radius_m=1000',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        route: {
          geometry: { type: string; coordinates: Array<[number, number]> };
          route_distance_m: number;
          straight_line_m: number;
          duration_s: number;
          estimated_steps: number;
        };
      };
      expect(body.route.geometry.type).toBe('LineString');
      expect(body.route.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      // A genuine route is at least the straight line and sane for walking.
      expect(body.route.route_distance_m).toBeGreaterThanOrEqual(body.route.straight_line_m * 0.99);
      expect(body.route.route_distance_m).toBeLessThan(body.route.straight_line_m * 5);
      expect(body.route.duration_s).toBeGreaterThan(0);
      expect(body.route.estimated_steps).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
