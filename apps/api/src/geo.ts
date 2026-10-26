import { ApiError } from './errors.js';

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in meters. Used to cross-check PostGIS results. */
export function haversineM(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Initial bearing in degrees clockwise from north, normalized to [0, 360). */
export function initialBearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLon = toRadians(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

export const MIN_RADIUS_M = 1;
export const MAX_RADIUS_M = 100000;

export function parseRadiusM(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num < MIN_RADIUS_M || num > MAX_RADIUS_M) {
    throw new ApiError(400, `radius_m must be an integer between ${MIN_RADIUS_M} and ${MAX_RADIUS_M}`);
  }
  return num;
}

export function parseLatLon(body: unknown): LatLon {
  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'body must be an object with numeric lat and lon');
  }
  const { lat, lon } = body as { lat?: unknown; lon?: unknown };
  if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
    throw new ApiError(400, 'lat must be within -90..90 and lon within -180..180');
  }
  return { lat, lon };
}

export function parseEnabled(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'body must be an object with boolean enabled');
  }
  const { enabled } = body as { enabled?: unknown };
  if (typeof enabled !== 'boolean') {
    throw new ApiError(400, 'enabled must be a boolean');
  }
  return enabled;
}
