// AI Circle Intelligence domain types and environment-derived config.
// Pure contracts shared by the service layer, the Meta Model API adapter,
// and the strict validators. No I/O here.

export const CLOSNESS_LABELS = {
  5: 'Inner Circle',
  4: 'Close Friend',
  3: 'Regular Friend',
  2: 'Casual Friend',
  1: 'Acquaintance',
} as const;

export type ClosenessLevel = 1 | 2 | 3 | 4 | 5;
export type EvidenceQuality = 'limited' | 'moderate' | 'strong';
export type ActivityTrend = 'stable' | 'increasing' | 'decreasing' | 'unknown';
export type ProfileStoreSource = 'meta_live' | 'demo_fixture';
export type AdviceStoreSource = 'meta_live' | 'meta_cached' | 'demo_fixture' | 'unavailable';
export type ClosenessDisplaySource = 'user_choice' | 'ai_estimate' | 'demo_profile' | 'none';
export type AdviceOutcome = 'suggest' | 'later' | 'insufficient_context';
export type AdviceActivity = 'coffee' | 'walk' | 'lunch' | 'catch_up' | 'none';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'unavailable' | 'cancelled';
export type FeedbackKind = 'dismiss' | 'snooze' | 'declined';

export const MODEL_ID = 'muse-spark-1.3';
export const MODEL_BASE_URL = 'https://api.meta.ai/v1';
export const POLICY_VERSION = '1.0';

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface AiCircleConfig {
  enabled: boolean;
  demoMode: boolean;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxOutputTokens: number;
  reasoningEffort: ReasoningEffort;
  cooldownDays: number;
  userRefreshPerDay: number;
  adviceTtlMin: number;
  advicePerUserDay: number;
  advicePairWindowHours: number;
  dailyRequestBudget: number;
}

export const DEFAULT_AI_CIRCLE_CONFIG: AiCircleConfig = {
  enabled: true,
  demoMode: true,
  modelName: MODEL_ID,
  baseUrl: MODEL_BASE_URL,
  apiKey: '',
  timeoutMs: 20000,
  // Budget shared by hidden reasoning + visible JSON: 512 at the model's
  // default effort truncated real replies (finish_reason: length). Low
  // effort plus a roomier cap leaves 10x headroom for ~200-token outputs.
  maxOutputTokens: 2048,
  reasoningEffort: 'low',
  cooldownDays: 14,
  userRefreshPerDay: 1,
  adviceTtlMin: 30,
  advicePerUserDay: 20,
  advicePairWindowHours: 6,
  dailyRequestBudget: 100,
};

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return fallback;
}

function parseInt(raw: string | undefined, fallback: number, min: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(n) || n < min) return fallback;
  return n;
}

const REASONING_EFFORTS: readonly ReasoningEffort[] = ['minimal', 'low', 'medium', 'high', 'xhigh'];

function parseEffort(raw: string | undefined): ReasoningEffort {
  const v = raw?.trim().toLowerCase();
  return REASONING_EFFORTS.includes(v as ReasoningEffort) ? (v as ReasoningEffort) : 'low';
}

export function readAiCircleConfig(env: NodeJS.ProcessEnv = process.env): AiCircleConfig {
  return {
    enabled: parseBool(env['AI_CIRCLE_ENABLED'], DEFAULT_AI_CIRCLE_CONFIG.enabled),
    demoMode: parseBool(env['AI_CIRCLE_DEMO_MODE'], DEFAULT_AI_CIRCLE_CONFIG.demoMode),
    modelName: env['META_MODEL_NAME']?.trim() || MODEL_ID,
    baseUrl: (env['META_MODEL_BASE_URL']?.trim() || MODEL_BASE_URL).replace(/\/$/, ''),
    apiKey: env['MODEL_API_KEY']?.trim() ?? '',
    timeoutMs: parseInt(env['AI_CIRCLE_TIMEOUT_MS'], DEFAULT_AI_CIRCLE_CONFIG.timeoutMs, 1000),
    maxOutputTokens: parseInt(
      env['AI_CIRCLE_MAX_TOKENS'],
      DEFAULT_AI_CIRCLE_CONFIG.maxOutputTokens,
      64,
    ),
    reasoningEffort: parseEffort(env['AI_CIRCLE_REASONING_EFFORT']),
    cooldownDays: parseInt(
      env['AI_CIRCLE_COOLDOWN_DAYS'],
      DEFAULT_AI_CIRCLE_CONFIG.cooldownDays,
      0,
    ),
    userRefreshPerDay: parseInt(
      env['AI_CIRCLE_USER_REFRESH_PER_DAY'],
      DEFAULT_AI_CIRCLE_CONFIG.userRefreshPerDay,
      1,
    ),
    adviceTtlMin: parseInt(
      env['AI_CIRCLE_ADVICE_TTL_MIN'],
      DEFAULT_AI_CIRCLE_CONFIG.adviceTtlMin,
      1,
    ),
    advicePerUserDay: parseInt(
      env['AI_CIRCLE_ADVICE_PER_USER_DAY'],
      DEFAULT_AI_CIRCLE_CONFIG.advicePerUserDay,
      1,
    ),
    advicePairWindowHours: parseInt(
      env['AI_CIRCLE_ADVICE_PAIR_WINDOW_HOURS'],
      DEFAULT_AI_CIRCLE_CONFIG.advicePairWindowHours,
      1,
    ),
    dailyRequestBudget: parseInt(
      env['AI_CIRCLE_DAILY_REQUEST_BUDGET'],
      DEFAULT_AI_CIRCLE_CONFIG.dailyRequestBudget,
      1,
    ),
  };
}

// Coarse aggregate signal buckets: the only friendship context ever built
// server-side. No raw text, identifiers beyond (owner, friend), or GPS.
export interface SignalBuckets {
  known_for_bucket: string | null;
  last_meetup_bucket: string | null;
  contact_frequency: string | null;
  activity_trend: string;
  reciprocity_bucket: string | null;
  confirmed_meetups: number;
  declared_closeness: string | null;
  declared_activities: string[];
  sustained_windows: number;
}

export interface CircleSettings {
  analysis_consent: boolean;
  advice_consent: boolean;
  availability_shared: boolean;
  quiet_start_min: number | null;
  quiet_end_min: number | null;
  policy_version: string;
  updated_at: string | null;
}

export interface StoredProfile {
  level: ClosenessLevel | null;
  evidence_quality: EvidenceQuality | null;
  rationale: string;
  activity_trend: ActivityTrend;
  source: ProfileStoreSource;
  model_id: string | null;
  signals_version: number;
  fingerprint: string;
  baseline: Record<string, unknown>;
  policy_version: string;
  status: 'active' | 'revoked';
  assessed_at: string | null;
  updated_at: string | null;
}

export interface ClosenessOverride {
  level: ClosenessLevel;
  updated_at: string | null;
}

export interface ClosenessView {
  level: ClosenessLevel | null;
  level_label: string;
  level_source: ClosenessDisplaySource;
  evidence_quality: EvidenceQuality | null;
  rationale: string;
  activity_trend: ActivityTrend;
  assessed_at: string | null;
  model_id: string | null;
  override: ClosenessOverride | null;
  ai_enabled: boolean;
}

export interface StoredAdvice {
  outcome: AdviceOutcome;
  reason: string;
  activity: AdviceActivity;
  invitation_draft: string;
  source: AdviceStoreSource;
  model_id: string | null;
  generated_at: string | null;
  trace_id: string;
  advice_key: string;
}

export interface OpportunityCandidate {
  id: string;
  display_name: string;
  distance_m: number;
  bearing_deg: number;
  walk_minutes: number | null;
  closeness: { level: ClosenessLevel | null; level_source: ClosenessDisplaySource } | null;
  context: string;
}

export interface UsageCounters {
  model_requests: number;
  cache_hits: number;
  cache_misses: number;
  input_tokens: number;
  output_tokens: number;
  rate_limited: number;
}
