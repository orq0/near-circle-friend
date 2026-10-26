// Pure radar math: polar (distance, bearing) -> radar-face percentages.
// Bearing convention matches PostGIS ST_Azimuth: degrees clockwise from north.
export interface RadarPoint {
  xPct: number;
  yPct: number;
}

export function positionOnRadar(
  distanceM: number,
  bearingDeg: number,
  radiusM: number,
): RadarPoint {
  const fraction = radiusM > 0 ? distanceM / radiusM : 0;
  const clamped = Math.max(0, Math.min(1, fraction));
  const radians = (bearingDeg * Math.PI) / 180;
  return {
    xPct: 50 + clamped * 50 * Math.sin(radians),
    yPct: 50 - clamped * 50 * Math.cos(radians),
  };
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km >= 10 ? Math.round(km) : Math.round(km * 10) / 10} km`;
}

export const RADII_M = [500, 1000, 2000, 5000] as const;

export function formatRadius(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${meters / 1000} km`;
}
