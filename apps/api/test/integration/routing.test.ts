import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

// Live-router suite. Runs ONLY via `npm run test:integration` with
// RUN_INTEGRATION_TESTS=1, and passes only after the Phase 3 graph bootstrap
// (`routing/prepare-graph.ps1`) produced a working pedestrian router.
// The gate throws loudly when unset: never a silent skip.
if (process.env['RUN_INTEGRATION_TESTS'] !== '1') {
  throw new Error(
    'integration tests require RUN_INTEGRATION_TESTS=1, a seeded stack, and a prepared router',
  );
}

describe('pedestrian routing (live router)', () => {
  it('calculates a real Metro Manila walking route', async () => {
    const app = await buildApp();
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
