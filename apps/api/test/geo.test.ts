import { describe, expect, it } from 'vitest';
import {
  haversineM,
  initialBearingDeg,
  isValidLatitude,
  isValidLongitude,
  parseEnabled,
  parseLatLon,
  parseRadiusM,
} from '../src/geo.js';
import { catchStatus } from './helpers.js';

const RIZAL_PARK = { lat: 14.581, lon: 120.975 };
// ~280 m northeast of Rizal Park (Coleen fixture).
const COLEEN = { lat: 14.5827902, lon: 120.9768376 };

describe('geo math', () => {
  it('computes haversine distance within 1% of PostGIS geography math', () => {
    const meters = haversineM(RIZAL_PARK, COLEEN);
    expect(meters).toBeGreaterThan(277);
    expect(meters).toBeLessThan(283);
  });

  it('computes initial bearing clockwise from north', () => {
    expect(initialBearingDeg(RIZAL_PARK, COLEEN)).toBeGreaterThan(42);
    expect(initialBearingDeg(RIZAL_PARK, COLEEN)).toBeLessThan(48);
    expect(initialBearingDeg(RIZAL_PARK, { lat: 14.571, lon: 120.975 })).toBeGreaterThan(175);
  });

  it('validates coordinate bounds', () => {
    expect(isValidLatitude(14.58)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLongitude(120.97)).toBe(true);
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude('x')).toBe(false);
  });
});

describe('geo input parsing', () => {
  it('parses radius with default and bounds', () => {
    expect(parseRadiusM(undefined, 1000)).toBe(1000);
    expect(parseRadiusM('500', 1000)).toBe(500);
    expect(parseRadiusM(5000, 1000)).toBe(5000);
  });

  it('rejects bad radii with 400', async () => {
    for (const bad of ['abc', '0', '-5', '100001', '1.5', {}, []]) {
      expect(await catchStatus(async () => parseRadiusM(bad, 1000))).toBe(400);
    }
  });

  it('parses lat/lon bodies', () => {
    expect(parseLatLon({ lat: 14.5, lon: 120.9 })).toEqual({ lat: 14.5, lon: 120.9 });
  });

  it('rejects bad locations with 400', async () => {
    for (const bad of [null, {}, { lat: 91, lon: 0 }, { lat: 0, lon: 200 }, { lat: 'x', lon: 0 }]) {
      expect(await catchStatus(async () => parseLatLon(bad))).toBe(400);
    }
  });

  it('parses enabled strictly', () => {
    expect(parseEnabled({ enabled: true })).toBe(true);
    expect(parseEnabled({ enabled: false })).toBe(false);
  });

  it('rejects non-boolean enabled with 400', async () => {
    for (const bad of [null, {}, { enabled: 'yes' }, { enabled: 1 }]) {
      expect(await catchStatus(async () => parseEnabled(bad))).toBe(400);
    }
  });
});
