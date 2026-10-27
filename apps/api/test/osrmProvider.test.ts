import { describe, expect, it } from 'vitest';
import { createOsrmProvider, type FetchFn } from '../src/routing/osrmProvider.js';
import { catchStatus } from './helpers.js';

const FROM = { lat: 14.581, lon: 120.975 };
const TO = { lat: 14.5828, lon: 120.9768 };

function jsonFetch(payload: unknown, status = 200): FetchFn {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
}

describe('OSRM provider', () => {
  it('parses a valid route response', async () => {
    const requested: string[] = [];
    const provider = createOsrmProvider({
      baseUrl: 'http://router:5000',
      fetchFn: async (url) => {
        requested.push(url);
        return jsonFetch({
          code: 'Ok',
          routes: [
            {
              distance: 340.5,
              duration: 245.2,
              geometry: { type: 'LineString', coordinates: [[120.975, 14.581], [120.9768, 14.5828]] },
            },
          ],
        })(url);
      },
    });
    const result = await provider.route(FROM, TO);
    expect(requested[0]).toContain('/route/v1/driving/120.975,14.581;120.9768,14.5828');
    expect(requested[0]).toContain('geometries=geojson');
    expect(result.distance_m).toBe(340.5);
    expect(result.duration_s).toBe(245.2);
    expect(result.geometry.coordinates).toHaveLength(2);
  });

  it('maps NoRoute to 404', async () => {
    const provider = createOsrmProvider({
      baseUrl: 'http://router:5000',
      fetchFn: jsonFetch({ code: 'NoRoute' }),
    });
    expect(await catchStatus(async () => provider.route(FROM, TO))).toBe(404);
  });

  it('maps transport failures to 503', async () => {
    const down = createOsrmProvider({
      baseUrl: 'http://router:5000',
      fetchFn: async () => {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      },
    });
    expect(await catchStatus(async () => down.route(FROM, TO))).toBe(503);
    // Docker-internal hostname used from the host: DNS cannot resolve it.
    // This is the exact failure the host-side integration suite produced
    // before it was pointed at ROUTING_WALK_HOST_URL.
    const unresolvable = createOsrmProvider({
      baseUrl: 'http://near-circle-routing-walk:5000',
      fetchFn: async () => {
        throw Object.assign(new Error('getaddrinfo ENOTFOUND near-circle-routing-walk'), {
          code: 'ENOTFOUND',
        });
      },
    });
    expect(await catchStatus(async () => unresolvable.route(FROM, TO))).toBe(503);
    const badStatus = createOsrmProvider({
      baseUrl: 'http://router:5000',
      fetchFn: jsonFetch({}, 500),
    });
    expect(await catchStatus(async () => badStatus.route(FROM, TO))).toBe(503);
  });

  it('maps aborts to 504', async () => {
    const provider = createOsrmProvider({
      baseUrl: 'http://router:5000',
      timeoutMs: 5,
      fetchFn: async (_url, init) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (init?.signal?.aborted === true) {
          throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        }
        return jsonFetch({ code: 'Ok', routes: [] })('');
      },
    });
    expect(await catchStatus(async () => provider.route(FROM, TO))).toBe(504);
  });

  it('maps malformed payloads to 502', async () => {
    for (const payload of [
      {},
      { code: 'Ok' },
      { code: 'Ok', routes: [] },
      { code: 'Ok', routes: [{ distance: 1 }] },
      {
        code: 'Ok',
        routes: [{ distance: 1, duration: 1, geometry: { type: 'Point', coordinates: [1, 2] } }],
      },
    ]) {
      const provider = createOsrmProvider({
        baseUrl: 'http://router:5000',
        fetchFn: jsonFetch(payload),
      });
      expect(await catchStatus(async () => provider.route(FROM, TO))).toBe(502);
    }
  });
});
