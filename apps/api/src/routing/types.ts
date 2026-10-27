import type { LatLon } from '../geo.js';

// GeoJSON LineString with [lon, lat] positions, as returned by OSRM.
export interface RouteGeometry {
  type: 'LineString';
  coordinates: Array<[number, number]>;
}

export interface RouteResult {
  geometry: RouteGeometry;
  distance_m: number;
  duration_s: number;
}

// Sole backend gateway to pedestrian routing. The browser never calls OSRM.
export interface WalkingRoutingProvider {
  readonly name: string;
  route(from: LatLon, to: LatLon): Promise<RouteResult>;
}
