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
  time?: string;
  unread?: number;
}

export interface ChatMessage {
  from: 'them' | 'you';
  text: string;
  time?: string;
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

export type Screen = 'inbox' | 'radar' | 'friend' | 'route' | 'reconnect' | 'ai-settings';

// AI Circle Intelligence client types. Every AI payload carries an explicit
// provenance label so demo fixtures are never confused with live estimates.
export interface CircleSettings {
  analysis_consent: boolean;
  advice_consent: boolean;
  availability_shared: boolean;
  quiet_start_min: number | null;
  quiet_end_min: number | null;
}

export type ClosenessDisplaySource = 'user_choice' | 'ai_estimate' | 'demo_profile' | 'none';

export interface CircleInsight {
  level: number | null;
  level_label: string;
  level_source: ClosenessDisplaySource;
  evidence_quality: 'limited' | 'moderate' | 'strong' | null;
  rationale: string;
  activity_trend: 'stable' | 'increasing' | 'decreasing' | 'unknown';
  assessed_at: string | null;
  model_id: string | null;
  override: { level: number; updated_at: string | null } | null;
  ai_enabled: boolean;
}

export interface OpportunityCandidate {
  id: string;
  display_name: string;
  distance_m: number;
  bearing_deg: number;
  walk_minutes: number | null;
  closeness: { level: number | null; level_source: ClosenessDisplaySource } | null;
  context: string;
}

export type AdviceOutcome = 'suggest' | 'later' | 'insufficient_context';
export type AdviceSource = 'meta_live' | 'meta_cached' | 'demo_fixture' | 'unavailable';

export interface AdviceResult {
  outcome: AdviceOutcome;
  reason: string;
  activity: 'coffee' | 'walk' | 'lunch' | 'catch_up' | 'none';
  invitation_draft: string | null;
  source: AdviceSource;
  model_id: string | null;
  generated_at: string | null;
  trace_id: string;
}

export type AdviceFetch =
  | { kind: 'advice'; advice: AdviceResult }
  | { kind: 'forbidden' }
  | { kind: 'suppressed' }
  | { kind: 'rate_limited' }
  | { kind: 'unavailable' }
  | { kind: 'error' };

export type AskPanelState =
  | 'not_requested'
  | 'checking'
  | 'consulting'
  | 'suggest'
  | 'later'
  | 'insufficient'
  | 'unavailable'
  | 'error';

export interface UsageCounters {
  model_requests: number;
  cache_hits: number;
  cache_misses: number;
  input_tokens: number;
  output_tokens: number;
  rate_limited: number;
}
