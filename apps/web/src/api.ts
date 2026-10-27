import type {
  AdviceFetch,
  AdviceResult,
  CircleInsight,
  CircleSettings,
  FriendDetail,
  FriendRouteInfo,
  FriendStatusInfo,
  NearbyFriend,
  OpportunityCandidate,
  UsageCounters,
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

// ---- AI Circle Intelligence client (same conventions: validated shapes) ----

const LEVEL_SOURCES = ['user_choice', 'ai_estimate', 'demo_profile', 'none'] as const;
const ADVICE_SOURCES = ['meta_live', 'meta_cached', 'demo_fixture', 'unavailable'] as const;
const ADVICE_OUTCOMES = ['suggest', 'later', 'insufficient_context'] as const;
const ADVICE_ACTIVITIES = ['coffee', 'walk', 'lunch', 'catch_up', 'none'] as const;

function isCircleSettings(value: unknown): value is CircleSettings {
  return (
    isRecord(value) &&
    typeof value['analysis_consent'] === 'boolean' &&
    typeof value['advice_consent'] === 'boolean' &&
    typeof value['availability_shared'] === 'boolean' &&
    (value['quiet_start_min'] === null || typeof value['quiet_start_min'] === 'number') &&
    (value['quiet_end_min'] === null || typeof value['quiet_end_min'] === 'number')
  );
}

export async function fetchCircleSettings(timeoutMs = 5000): Promise<CircleSettings | null> {
  const body = await fetchJson('/ai-circle/settings', timeoutMs);
  if (!isRecord(body) || !isCircleSettings(body['settings'])) return null;
  return body['settings'];
}

export async function saveCircleSettings(
  patch: Partial<CircleSettings>,
  timeoutMs = 5000,
): Promise<CircleSettings | null> {
  const body = await sendJson('/ai-circle/settings', 'PUT', patch, timeoutMs);
  if (!isRecord(body) || !isCircleSettings(body['settings'])) return null;
  return body['settings'];
}

function isCircleInsight(value: unknown): value is CircleInsight {
  if (!isRecord(value)) return false;
  const level = value['level'];
  const quality = value['evidence_quality'];
  const trend = value['activity_trend'];
  const override = value['override'];
  return (
    (level === null || (typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 5)) &&
    typeof value['level_label'] === 'string' &&
    (LEVEL_SOURCES as readonly string[]).includes(String(value['level_source'])) &&
    (quality === null || quality === 'limited' || quality === 'moderate' || quality === 'strong') &&
    typeof value['rationale'] === 'string' &&
    (trend === 'stable' || trend === 'increasing' || trend === 'decreasing' || trend === 'unknown') &&
    (value['assessed_at'] === null || typeof value['assessed_at'] === 'string') &&
    (value['model_id'] === null || typeof value['model_id'] === 'string') &&
    (override === null ||
      (isRecord(override) && typeof override['level'] === 'number')) &&
    typeof value['ai_enabled'] === 'boolean'
  );
}

export async function fetchCloseness(id: string, timeoutMs = 5000): Promise<CircleInsight | null> {
  const body = await fetchJson(`/ai-circle/closeness/${encodeURIComponent(id)}`, timeoutMs);
  return isCircleInsight(body) ? body : null;
}

export async function requestAssessment(id: string, timeoutMs = 8000): Promise<boolean> {
  const body = await sendJson(
    `/ai-circle/closeness/${encodeURIComponent(id)}/assess`,
    'POST',
    {},
    timeoutMs,
  );
  return body !== null;
}

export async function saveClosenessOverride(
  id: string,
  level: number | null,
  timeoutMs = 5000,
): Promise<CircleInsight | null> {
  const body = await sendJson(
    `/ai-circle/closeness/${encodeURIComponent(id)}`,
    'PUT',
    { level },
    timeoutMs,
  );
  return isCircleInsight(body) ? body : null;
}

function isOpportunity(value: unknown): value is OpportunityCandidate {
  if (!isRecord(value)) return false;
  const closeness = value['closeness'];
  return (
    typeof value['id'] === 'string' &&
    typeof value['display_name'] === 'string' &&
    typeof value['distance_m'] === 'number' &&
    typeof value['bearing_deg'] === 'number' &&
    (value['walk_minutes'] === null || typeof value['walk_minutes'] === 'number') &&
    (closeness === null ||
      (isRecord(closeness) &&
        (closeness['level'] === null || typeof closeness['level'] === 'number') &&
        (LEVEL_SOURCES as readonly string[]).includes(String(closeness['level_source'])))) &&
    typeof value['context'] === 'string'
  );
}

export async function fetchOpportunities(
  radiusM: number,
  timeoutMs = 8000,
): Promise<OpportunityCandidate[] | null> {
  const body = await fetchJson(`/ai-circle/opportunities?radius_m=${radiusM}`, timeoutMs);
  if (!isRecord(body) || !Array.isArray(body['candidates'])) return null;
  const candidates = (body['candidates'] as unknown[]).filter(isOpportunity);
  if (candidates.length !== (body['candidates'] as unknown[]).length) return null;
  return candidates;
}

function isAdviceResult(value: unknown): value is AdviceResult {
  if (!isRecord(value)) return false;
  return (
    (ADVICE_OUTCOMES as readonly string[]).includes(String(value['outcome'])) &&
    typeof value['reason'] === 'string' &&
    (ADVICE_ACTIVITIES as readonly string[]).includes(String(value['activity'])) &&
    (value['invitation_draft'] === null || typeof value['invitation_draft'] === 'string') &&
    (ADVICE_SOURCES as readonly string[]).includes(String(value['source'])) &&
    (value['model_id'] === null || typeof value['model_id'] === 'string') &&
    (value['generated_at'] === null || typeof value['generated_at'] === 'string') &&
    typeof value['trace_id'] === 'string'
  );
}

// Status-discriminating advice fetch: consent/eligibility (403), suppression
// (409), budgets (429) and missing model access (503) each render honestly.
export async function requestAdvice(
  id: string,
  displayName: string,
  radiusM: number,
  timeoutMs = 25000,
): Promise<AdviceFetch> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase()}/ai-circle/opportunities/${encodeURIComponent(id)}/advise`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, radius_m: radiusM }),
      signal: controller.signal,
    });
    if (res.status === 403) return { kind: 'forbidden' };
    if (res.status === 409) return { kind: 'suppressed' };
    if (res.status === 429) return { kind: 'rate_limited' };
    if (res.status === 503) return { kind: 'unavailable' };
    if (!res.ok) return { kind: 'error' };
    const body = (await res.json()) as unknown;
    if (!isAdviceResult(body)) return { kind: 'error' };
    return { kind: 'advice', advice: body };
  } catch {
    return { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

export async function recordAiFeedback(
  friendId: string,
  kind: 'dismiss' | 'snooze' | 'declined',
  snoozeMinutes: number | null = null,
  timeoutMs = 5000,
): Promise<boolean> {
  const body = await sendJson(
    '/ai-circle/feedback',
    'POST',
    { friend_id: friendId, kind, ...(snoozeMinutes === null ? {} : { snooze_minutes: snoozeMinutes }) },
    timeoutMs,
  );
  return body !== null;
}

export async function fetchUsage(timeoutMs = 5000): Promise<UsageCounters | null> {
  const body = await fetchJson('/ai-circle/usage', timeoutMs);
  if (!isRecord(body) || !isRecord(body['usage'])) return null;
  const usage = body['usage'];
  const keys = ['model_requests', 'cache_hits', 'cache_misses', 'input_tokens', 'output_tokens', 'rate_limited'] as const;
  for (const key of keys) {
    if (typeof usage[key] !== 'number') return null;
  }
  return {
    model_requests: usage['model_requests'] as number,
    cache_hits: usage['cache_hits'] as number,
    cache_misses: usage['cache_misses'] as number,
    input_tokens: usage['input_tokens'] as number,
    output_tokens: usage['output_tokens'] as number,
    rate_limited: usage['rate_limited'] as number,
  };
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
