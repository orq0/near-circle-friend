// AI Circle Intelligence domain types and environment-derived config.
// Pure contracts shared by the service layer, the Meta Model API adapter,
// and the strict validators. No I/O here.
export const CLOSNESS_LABELS = {
    5: 'Inner Circle',
    4: 'Close Friend',
    3: 'Regular Friend',
    2: 'Casual Friend',
    1: 'Acquaintance',
};
export const MODEL_ID = 'muse-spark-1.3';
export const MODEL_BASE_URL = 'https://api.meta.ai/v1';
export const POLICY_VERSION = '1.0';
export const DEFAULT_AI_CIRCLE_CONFIG = {
    enabled: true,
    demoMode: true,
    modelName: MODEL_ID,
    baseUrl: MODEL_BASE_URL,
    apiKey: '',
    timeoutMs: 20000,
    maxOutputTokens: 512,
    cooldownDays: 14,
    userRefreshPerDay: 1,
    adviceTtlMin: 30,
    advicePerUserDay: 20,
    advicePairWindowHours: 6,
    dailyRequestBudget: 100,
};
function parseBool(raw, fallback) {
    if (raw === undefined)
        return fallback;
    const v = raw.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes')
        return true;
    if (v === '0' || v === 'false' || v === 'no')
        return false;
    return fallback;
}
function parseInt(raw, fallback, min) {
    if (raw === undefined)
        return fallback;
    const n = Number.parseInt(raw.trim(), 10);
    if (!Number.isInteger(n) || n < min)
        return fallback;
    return n;
}
export function readAiCircleConfig(env = process.env) {
    return {
        enabled: parseBool(env['AI_CIRCLE_ENABLED'], DEFAULT_AI_CIRCLE_CONFIG.enabled),
        demoMode: parseBool(env['AI_CIRCLE_DEMO_MODE'], DEFAULT_AI_CIRCLE_CONFIG.demoMode),
        modelName: env['META_MODEL_NAME']?.trim() || MODEL_ID,
        baseUrl: (env['META_MODEL_BASE_URL']?.trim() || MODEL_BASE_URL).replace(/\/$/, ''),
        apiKey: env['MODEL_API_KEY']?.trim() ?? '',
        timeoutMs: parseInt(env['AI_CIRCLE_TIMEOUT_MS'], DEFAULT_AI_CIRCLE_CONFIG.timeoutMs, 1000),
        maxOutputTokens: parseInt(env['AI_CIRCLE_MAX_TOKENS'], DEFAULT_AI_CIRCLE_CONFIG.maxOutputTokens, 64),
        cooldownDays: parseInt(env['AI_CIRCLE_COOLDOWN_DAYS'], DEFAULT_AI_CIRCLE_CONFIG.cooldownDays, 0),
        userRefreshPerDay: parseInt(env['AI_CIRCLE_USER_REFRESH_PER_DAY'], DEFAULT_AI_CIRCLE_CONFIG.userRefreshPerDay, 1),
        adviceTtlMin: parseInt(env['AI_CIRCLE_ADVICE_TTL_MIN'], DEFAULT_AI_CIRCLE_CONFIG.adviceTtlMin, 1),
        advicePerUserDay: parseInt(env['AI_CIRCLE_ADVICE_PER_USER_DAY'], DEFAULT_AI_CIRCLE_CONFIG.advicePerUserDay, 1),
        advicePairWindowHours: parseInt(env['AI_CIRCLE_ADVICE_PAIR_WINDOW_HOURS'], DEFAULT_AI_CIRCLE_CONFIG.advicePairWindowHours, 1),
        dailyRequestBudget: parseInt(env['AI_CIRCLE_DAILY_REQUEST_BUDGET'], DEFAULT_AI_CIRCLE_CONFIG.dailyRequestBudget, 1),
    };
}
