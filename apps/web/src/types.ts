export type FriendStatus = 'online' | 'recent' | 'available';

// Mock messaging-shell identity (Phase 1 preserved). Conversations are simulated;
// Near-Circle proximity comes from the API.
export interface Friend {
  id: string;
  name: string;
  initial: string;
  status: FriendStatus;
  statusLabel: string;
  preview: string;
}

export interface ChatMessage {
  from: 'them' | 'you';
  text: string;
}

// Real proximity result from GET /friends/nearby (PostGIS distance + bearing).
export interface NearbyFriend {
  id: string;
  display_name: string;
  distance_m: number;
  bearing_deg: number;
}

export interface VisibilityState {
  enabled: boolean;
  radius_m: number;
}

export interface FriendDetail {
  id: string;
  display_name: string;
  near_circle_enabled: boolean;
  discoverable: boolean;
  distance_m: number | null;
  bearing_deg: number | null;
}

export interface FriendStatusInfo {
  id: string;
  display_name: string;
  near_circle_enabled: boolean;
  location_state: 'fresh' | 'stale' | 'none';
}

export type RadarStatus = 'loading' | 'ready' | 'empty' | 'error' | 'disabled';

// Pedestrian route from GET /friends/:id/route. Geometry positions are
// [lon, lat] per the GeoJSON LineString returned by the router.
export interface FriendRouteInfo {
  to: { id: string; display_name: string };
  center: { lat: number; lon: number };
  target: { lat: number; lon: number };
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  route_distance_m: number;
  straight_line_m: number;
  duration_s: number;
  estimated_steps: number;
  stride_m: number;
}

export type RouteStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export type Screen = 'inbox' | 'radar' | 'friend' | 'route';
