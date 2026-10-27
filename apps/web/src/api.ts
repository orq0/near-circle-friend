import type {
  FriendDetail,
  FriendRouteInfo,
  FriendStatusInfo,
  NearbyFriend,
  VisibilityState,
} from './types';

// API client. GETs never throw (null = unreachable/invalid); mutations return
// null on failure so the UI can revert and explain.
function apiBase(): string {
  const configured = import.meta.env?.VITE_API_URL?.trim() ?? '';
  return configured === '' ? '/api' : configured.replace(/\/$/, '');
}

async function fetchJson(path: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase()}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function sendJson(
  path: string,
  method: 'PUT' | 'POST',
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function fetchApiHealth(timeoutMs = 3000): Promise<boolean> {
  const body = await fetchJson('/health', timeoutMs);
  return isRecord(body) && body['status'] === 'ok';
}

export interface NearbyResult {
  radius_m: number;
  friends: NearbyFriend[];
}

function isNearbyFriend(value: unknown): value is NearbyFriend {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['display_name'] === 'string' &&
    typeof value['distance_m'] === 'number' &&
    typeof value['bearing_deg'] === 'number'
  );
}

export async function fetchNearby(radiusM: number, timeoutMs = 5000): Promise<NearbyResult | null> {
  const body = await fetchJson(`/friends/nearby?radius_m=${radiusM}`, timeoutMs);
  if (!isRecord(body) || !Array.isArray(body['friends'])) return null;
  const friends = (body['friends'] as unknown[]).filter(isNearbyFriend);
  if (friends.length !== (body['friends'] as unknown[]).length) return null;
  return { radius_m: radiusM, friends };
}

function isVisibilityState(value: unknown): value is VisibilityState {
  return (
    isRecord(value) &&
    typeof value['enabled'] === 'boolean' &&
    typeof value['radius_m'] === 'number'
  );
}

export async function fetchVisibility(timeoutMs = 5000): Promise<VisibilityState | null> {
  const body = await fetchJson('/near-circle/visibility', timeoutMs);
  return isVisibilityState(body) ? body : null;
}

export async function setVisibilityRemote(enabled: boolean, timeoutMs = 5000): Promise<VisibilityState | null> {
  const body = await sendJson('/near-circle/visibility', 'PUT', { enabled }, timeoutMs);
  return isVisibilityState(body) ? body : null;
}

function isFriendStatusInfo(value: unknown): value is FriendStatusInfo {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['display_name'] === 'string' &&
    typeof value['near_circle_enabled'] === 'boolean' &&
    (value['location_state'] === 'fresh' ||
      value['location_state'] === 'stale' ||
      value['location_state'] === 'none')
  );
}

export async function fetchFriends(timeoutMs = 5000): Promise<FriendStatusInfo[] | null> {
  const body = await fetchJson('/friends', timeoutMs);
  if (!isRecord(body) || !Array.isArray(body['friends'])) return null;
  const friends = (body['friends'] as unknown[]).filter(isFriendStatusInfo);
  if (friends.length !== (body['friends'] as unknown[]).length) return null;
  return friends;
}

export type RouteFetchResult =
  | { kind: 'route'; route: FriendRouteInfo }
  | { kind: 'unavailable' }
  | { kind: 'error' };

function isRouteInfo(value: unknown): value is FriendRouteInfo {
  if (!isRecord(value)) return false;
  const geometry = value['geometry'];
  return (
    isRecord(value['to']) &&
    typeof value['to']['id'] === 'string' &&
    typeof value['to']['display_name'] === 'string' &&
    isRecord(value['center']) &&
    isRecord(value['target']) &&
    isRecord(geometry) &&
    geometry['type'] === 'LineString' &&
    Array.isArray(geometry['coordinates']) &&
    (geometry['coordinates'] as unknown[]).length >= 2 &&
    typeof value['route_distance_m'] === 'number' &&
    typeof value['straight_line_m'] === 'number' &&
    typeof value['duration_s'] === 'number' &&
    typeof value['estimated_steps'] === 'number' &&
    typeof value['stride_m'] === 'number'
  );
}

// Distinguishes "no route exists" (404/403 from eligibility or NoRoute) from
// transport failures so the UI can be honest about each case.
export async function fetchRoute(
  id: string,
  radiusM: number,
  timeoutMs = 8000,
): Promise<RouteFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${apiBase()}/friends/${encodeURIComponent(id)}/route?radius_m=${radiusM}`,
      { signal: controller.signal },
    );
    if (res.status === 404 || res.status === 403) return { kind: 'unavailable' };
    if (!res.ok) return { kind: 'error' };
    const body = (await res.json()) as unknown;
    if (!isRecord(body) || !isRouteInfo(body['route'])) return { kind: 'error' };
    return { kind: 'route', route: body['route'] };
  } catch {
    return { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFriendDetail(
  id: string,
  radiusM: number,
  timeoutMs = 5000,
): Promise<FriendDetail | null> {
  const body = await fetchJson(
    `/friends/${encodeURIComponent(id)}?radius_m=${radiusM}`,
    timeoutMs,
  );
  if (
    !isRecord(body) ||
    typeof body['id'] !== 'string' ||
    typeof body['display_name'] !== 'string' ||
    typeof body['near_circle_enabled'] !== 'boolean' ||
    typeof body['discoverable'] !== 'boolean' ||
    (body['distance_m'] !== null && typeof body['distance_m'] !== 'number') ||
    (body['bearing_deg'] !== null && typeof body['bearing_deg'] !== 'number')
  ) {
    return null;
  }
  return {
    id: body['id'],
    display_name: body['display_name'],
    near_circle_enabled: body['near_circle_enabled'],
    discoverable: body['discoverable'],
    distance_m: body['distance_m'],
    bearing_deg: body['bearing_deg'],
  };
}
