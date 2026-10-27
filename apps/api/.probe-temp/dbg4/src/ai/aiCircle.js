// AI Circle Intelligence core service: owner-private profiles, consent,
// coarse signal aggregation, material-change gating, and the in-process
// reassessment runner. Reads (settings/profile/override) never touch the
// model: no provider parameter exists on any read path.
import { randomUUID } from 'node:crypto';
import { isConnectionError } from '../db.js';
import { ApiError } from '../errors.js';
import { buildAssessInput, canonicalSignals, fingerprint, sanitizeBucket, sanitizeDeclaredActivities, } from './contracts.js';
import { isTransientModelError } from './metaModelProvider.js';
import { CLOSNESS_LABELS, POLICY_VERSION, } from './types.js';
async function queryRows(db, text, params) {
    try {
        const res = await db.query(text, params);
        return res.rows;
    }
    catch (err) {
        if (isConnectionError(err)) {
            throw new ApiError(503, 'database unavailable');
        }
        throw err;
    }
}
function iso(value) {
    if (value === null || value === undefined)
        return null;
    return value instanceof Date ? value.toISOString() : String(value);
}
function levelLabel(level) {
    return level === null ? 'Not enough information' : CLOSNESS_LABELS[level];
}
async function relationshipStatus(db, ownerId, friendId) {
    const rows = await queryRows(db, 'SELECT status FROM relationships WHERE user_id = $1 AND friend_id = $2', [ownerId, friendId]);
    return rows[0]?.status ?? null;
}
export async function requireApprovedFriend(db, ownerId, friendId) {
    if (ownerId === friendId)
        throw new ApiError(400, 'owner and friend must differ');
    const status = await relationshipStatus(db, ownerId, friendId);
    // Blocked and unknown friendships are indistinguishable to the caller.
    if (status !== 'approved')
        throw new ApiError(404, 'friend not found');
}
function toSettings(row) {
    return {
        analysis_consent: row?.analysis_consent === true,
        advice_consent: row?.advice_consent === true,
        availability_shared: row?.availability_shared === true,
        quiet_start_min: row?.quiet_start_min ?? null,
        quiet_end_min: row?.quiet_end_min ?? null,
        policy_version: row?.policy_version ?? POLICY_VERSION,
        updated_at: iso(row?.updated_at),
    };
}
export async function getSettings(db, ownerId) {
    const rows = await queryRows(db, `SELECT analysis_consent, advice_consent, availability_shared,
            quiet_start_min, quiet_end_min, policy_version, updated_at
       FROM ai_circle_preferences WHERE owner_id = $1`, [ownerId]);
    return toSettings(rows[0]);
}
export async function updateSettings(db, ownerId, patch) {
    const current = await getSettings(db, ownerId);
    const next = {
        analysis_consent: patch.analysis_consent ?? current.analysis_consent,
        advice_consent: patch.advice_consent ?? current.advice_consent,
        availability_shared: patch.availability_shared ?? current.availability_shared,
        quiet_start_min: patch.quiet_start_min === undefined ? current.quiet_start_min : patch.quiet_start_min,
        quiet_end_min: patch.quiet_end_min === undefined ? current.quiet_end_min : patch.quiet_end_min,
        policy_version: POLICY_VERSION,
        updated_at: new Date(),
    };
    const rows = await queryRows(db, `INSERT INTO ai_circle_preferences
       (owner_id, analysis_consent, advice_consent, availability_shared,
        quiet_start_min, quiet_end_min, policy_version, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (owner_id) DO UPDATE SET
       analysis_consent = EXCLUDED.analysis_consent,
       advice_consent = EXCLUDED.advice_consent,
       availability_shared = EXCLUDED.availability_shared,
       quiet_start_min = EXCLUDED.quiet_start_min,
       quiet_end_min = EXCLUDED.quiet_end_min,
       policy_version = EXCLUDED.policy_version,
       updated_at = NOW()
     RETURNING analysis_consent, advice_consent, availability_shared,
       quiet_start_min, quiet_end_min, policy_version, updated_at`, [
        ownerId,
        next.analysis_consent,
        next.advice_consent,
        next.availability_shared,
        next.quiet_start_min,
        next.quiet_end_min,
        next.policy_version,
    ]);
    const row = rows[0];
    if (row === undefined)
        throw new ApiError(503, 'database unavailable');
    // Immediate revocation semantics: consent-off purges derived data and stops
    // queued work. Overrides (explicit user choice) are always kept.
    if (current.analysis_consent && !next.analysis_consent) {
        await revokeAnalysisData(db, ownerId);
    }
    if (current.advice_consent && !next.advice_consent) {
        await revokeAdviceData(db, ownerId);
    }
    return toSettings(row);
}
export async function revokeAnalysisData(db, ownerId) {
    await queryRows(db, `UPDATE ai_circle_reassessment_jobs SET status = 'cancelled', finished_at = NOW() WHERE owner_id = $1 AND status IN ('pending', 'running')`, [ownerId]);
    await queryRows(db, `UPDATE ai_circle_friendship_profiles SET status = 'revoked', updated_at = NOW() WHERE owner_id = $1`, [ownerId]);
    await queryRows(db, `DELETE FROM ai_circle_signals WHERE owner_id = $1`, [ownerId]);
    await queryRows(db, `DELETE FROM ai_circle_meetup_advice WHERE owner_id = $1`, [ownerId]);
}
export async function revokeAdviceData(db, ownerId) {
    await queryRows(db, `DELETE FROM ai_circle_meetup_advice WHERE owner_id = $1`, [ownerId]);
}
export function inQuietHours(settings, now) {
    const { quiet_start_min: start, quiet_end_min: end } = settings;
    if (start === null || end === null || start === end)
        return false;
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    return start < end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end;
}
// ---- Signals -----------------------------------------------------------------
const SPARSE_SIGNALS = {
    known_for_bucket: null,
    last_meetup_bucket: null,
    contact_frequency: null,
    activity_trend: 'unknown',
    reciprocity_bucket: null,
    confirmed_meetups: 0,
    declared_closeness: null,
    declared_activities: [],
    sustained_windows: 0,
};
function toBuckets(row) {
    return {
        known_for_bucket: row.known_for_bucket,
        last_meetup_bucket: row.last_meetup_bucket,
        contact_frequency: row.contact_frequency,
        activity_trend: row.activity_trend,
        reciprocity_bucket: row.reciprocity_bucket,
        confirmed_meetups: row.confirmed_meetups,
        declared_closeness: row.declared_closeness,
        declared_activities: Array.isArray(row.declared_activities) ? row.declared_activities : [],
        sustained_windows: row.sustained_windows,
    };
}
export async function getSignals(db, ownerId, friendId) {
    const rows = await queryRows(db, `SELECT known_for_bucket, last_meetup_bucket, contact_frequency, activity_trend,
            reciprocity_bucket, confirmed_meetups, declared_closeness, declared_activities,
            sustained_windows, source, signals_version
       FROM ai_circle_signals WHERE owner_id = $1 AND friend_id = $2`, [ownerId, friendId]);
    const row = rows[0];
    if (row === undefined)
        return null;
    return { buckets: toBuckets(row), source: row.source, version: row.signals_version };
}
async function writeSignals(db, ownerId, friendId, buckets, source, bumpVersion) {
    await queryRows(db, `INSERT INTO ai_circle_signals
       (owner_id, friend_id, known_for_bucket, last_meetup_bucket, contact_frequency,
        activity_trend, reciprocity_bucket, confirmed_meetups, declared_closeness,
        declared_activities, sustained_windows, source, signals_version, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, NOW())
     ON CONFLICT (owner_id, friend_id) DO UPDATE SET
       known_for_bucket = EXCLUDED.known_for_bucket,
       last_meetup_bucket = EXCLUDED.last_meetup_bucket,
       contact_frequency = EXCLUDED.contact_frequency,
       activity_trend = EXCLUDED.activity_trend,
       reciprocity_bucket = EXCLUDED.reciprocity_bucket,
       confirmed_meetups = EXCLUDED.confirmed_meetups,
       declared_closeness = EXCLUDED.declared_closeness,
       declared_activities = EXCLUDED.declared_activities,
       sustained_windows = EXCLUDED.sustained_windows,
       source = EXCLUDED.source,
       signals_version = ai_circle_signals.signals_version + ${bumpVersion ? 1 : 0},
       updated_at = NOW()`, [
        ownerId,
        friendId,
        buckets.known_for_bucket,
        buckets.last_meetup_bucket,
        buckets.contact_frequency,
        buckets.activity_trend,
        buckets.reciprocity_bucket,
        buckets.confirmed_meetups,
        buckets.declared_closeness,
        buckets.declared_activities,
        buckets.sustained_windows,
        source,
    ]);
}
const FREQUENCY_LADDER = ['rare', 'occasional', 'frequent'];
function stepFrequency(current, dir) {
    const idx = FREQUENCY_LADDER.indexOf((current ?? 'occasional'));
    const base = idx === -1 ? 1 : idx;
    return FREQUENCY_LADDER[Math.max(0, Math.min(FREQUENCY_LADDER.length - 1, base + dir))];
}
// Pure local aggregation. Mention/message-like events are recorded but never
// move buckets, so a single trivial event can never trigger reassessment.
export function applySignalEvent(buckets, event) {
    switch (event.type) {
        case 'confirmed_meetup':
            return {
                ...buckets,
                confirmed_meetups: buckets.confirmed_meetups + 1,
                last_meetup_bucket: 'recent',
                sustained_windows: buckets.sustained_windows + 1,
            };
        case 'declared_change': {
            const closeness = sanitizeBucket(event.declared_closeness);
            const activities = sanitizeDeclaredActivities(event.declared_activities);
            return {
                ...buckets,
                declared_closeness: closeness ?? buckets.declared_closeness,
                declared_activities: activities.length > 0 ? activities : buckets.declared_activities,
                sustained_windows: buckets.sustained_windows + 1,
            };
        }
        case 'interaction_up':
            return {
                ...buckets,
                contact_frequency: stepFrequency(buckets.contact_frequency, 1),
                sustained_windows: buckets.sustained_windows + 1,
            };
        case 'interaction_down':
            return {
                ...buckets,
                contact_frequency: stepFrequency(buckets.contact_frequency, -1),
                sustained_windows: Math.max(0, buckets.sustained_windows - 1),
            };
        case 'mention_like':
        case 'message_like':
            return { ...buckets };
    }
}
function baselineValue(baseline, key) {
    return baseline[key] ?? null;
}
function sameActivities(a, b) {
    if (!Array.isArray(b))
        return a.length === 0;
    const left = [...a].sort().join('|');
    const right = [...b].filter((x) => typeof x === 'string').sort().join('|');
    return left === right;
}
/**
 * Hysteresis-gated material-change detection. Material only when:
 * - confirmed meetups grew by 2+ since baseline, or
 * - the user-declared closeness bucket changed, or
 * - 2+ distinct fields changed AND the change persisted across 2+ windows.
 * A single field tick, one meetup, or a lone mention never qualifies.
 */
export function evaluateMaterialChange(current, baseline) {
    const reasons = [];
    const meetupsBase = typeof baseline['confirmed_meetups'] === 'number' ? baseline['confirmed_meetups'] : 0;
    if (current.confirmed_meetups - meetupsBase >= 2) {
        reasons.push('multiple user-confirmed meetups since last assessment');
    }
    if (current.declared_closeness !== baselineValue(baseline, 'declared_closeness')) {
        reasons.push('user-declared relationship change');
    }
    if (reasons.length > 0)
        return { material: true, reasons };
    let changed = 0;
    if (current.known_for_bucket !== baselineValue(baseline, 'known_for_bucket'))
        changed += 1;
    if (current.last_meetup_bucket !== baselineValue(baseline, 'last_meetup_bucket'))
        changed += 1;
    if (current.contact_frequency !== baselineValue(baseline, 'contact_frequency'))
        changed += 1;
    if (current.reciprocity_bucket !== baselineValue(baseline, 'reciprocity_bucket'))
        changed += 1;
    if (!sameActivities(current.declared_activities, baseline['declared_activities']))
        changed += 1;
    const windowsBase = typeof baseline['sustained_windows'] === 'number' ? baseline['sustained_windows'] : 0;
    const windowDelta = current.sustained_windows - windowsBase;
    if (changed >= 2 && windowDelta >= 2) {
        reasons.push(`sustained multi-signal change across ${windowDelta} windows`);
        return { material: true, reasons };
    }
    return { material: false, reasons: [] };
}
function toStoredProfile(row) {
    return {
        level: row.level === null ? null : row.level,
        evidence_quality: row.evidence_quality ?? null,
        rationale: row.rationale,
        activity_trend: row.activity_trend ?? 'unknown',
        source: row.source,
        model_id: row.model_id,
        signals_version: row.signals_version,
        fingerprint: row.fingerprint,
        baseline: row.baseline ?? {},
        policy_version: row.policy_version,
        status: row.status ?? 'active',
        assessed_at: iso(row.assessed_at),
        updated_at: iso(row.updated_at),
    };
}
async function readProfile(db, ownerId, friendId) {
    const rows = await queryRows(db, `SELECT level, evidence_quality, rationale, activity_trend, source, model_id,
            signals_version, fingerprint, baseline, policy_version, status,
            assessed_at, updated_at
       FROM ai_circle_friendship_profiles WHERE owner_id = $1 AND friend_id = $2`, [ownerId, friendId]);
    const row = rows[0];
    return row === undefined ? null : toStoredProfile(row);
}
async function readOverride(db, ownerId, friendId) {
    const rows = await queryRows(db, 'SELECT level, updated_at FROM ai_circle_closeness_overrides WHERE owner_id = $1 AND friend_id = $2', [ownerId, friendId]);
    const row = rows[0];
    if (row === undefined)
        return null;
    return { level: row.level, updated_at: iso(row.updated_at) };
}
export async function getCloseness(db, ownerId, friendId, aiEnabled) {
    await requireApprovedFriend(db, ownerId, friendId);
    const [profile, override, prefs] = await Promise.all([
        readProfile(db, ownerId, friendId),
        readOverride(db, ownerId, friendId),
        getSettings(db, ownerId),
    ]);
    const usableProfile = profile !== null &&
        profile.status === 'active' &&
        (profile.source === 'demo_fixture' || prefs.analysis_consent)
        ? profile
        : null;
    if (override !== null) {
        return {
            level: override.level,
            level_label: levelLabel(override.level),
            level_source: 'user_choice',
            evidence_quality: usableProfile?.evidence_quality ?? null,
            rationale: usableProfile?.rationale ?? 'Your private override.',
            activity_trend: usableProfile?.activity_trend ?? 'unknown',
            assessed_at: usableProfile?.assessed_at ?? null,
            model_id: usableProfile?.model_id ?? null,
            override,
            ai_enabled: aiEnabled,
        };
    }
    if (usableProfile === null) {
        return {
            level: null,
            level_label: 'Not enough information',
            level_source: 'none',
            evidence_quality: null,
            rationale: 'Not enough information to estimate closeness.',
            activity_trend: 'unknown',
            assessed_at: null,
            model_id: null,
            override: null,
            ai_enabled: aiEnabled,
        };
    }
    const source = usableProfile.source === 'meta_live' ? 'ai_estimate' : 'demo_profile';
    return {
        level: usableProfile.level,
        level_label: levelLabel(usableProfile.level),
        level_source: source,
        evidence_quality: usableProfile.evidence_quality,
        rationale: usableProfile.rationale,
        activity_trend: usableProfile.activity_trend,
        assessed_at: usableProfile.assessed_at,
        model_id: usableProfile.model_id,
        override: null,
        ai_enabled: aiEnabled,
    };
}
export async function saveOverride(db, ownerId, friendId, level) {
    await requireApprovedFriend(db, ownerId, friendId);
    const rows = await queryRows(db, `INSERT INTO ai_circle_closeness_overrides (owner_id, friend_id, level, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (owner_id, friend_id) DO UPDATE SET level = EXCLUDED.level, updated_at = NOW()
     RETURNING level, updated_at`, [ownerId, friendId, level]);
    const row = rows[0];
    if (row === undefined)
        throw new ApiError(503, 'database unavailable');
    return { level: row.level, updated_at: iso(row.updated_at) };
}
export async function clearOverride(db, ownerId, friendId) {
    await requireApprovedFriend(db, ownerId, friendId);
    await queryRows(db, 'DELETE FROM ai_circle_closeness_overrides WHERE owner_id = $1 AND friend_id = $2', [ownerId, friendId]);
}
function toJob(row) {
    return {
        id: row.id,
        status: row.status,
        reason: row.reason,
        fingerprint: row.fingerprint,
        attempts: row.attempts,
        trace_id: row.trace_id,
        error: row.error,
        created_at: iso(row.created_at),
        finished_at: iso(row.finished_at),
    };
}
async function liveJob(db, ownerId, friendId) {
    const rows = await queryRows(db, `SELECT id, status, reason, fingerprint, attempts, trace_id, error, created_at, finished_at
       FROM ai_circle_reassessment_jobs
      WHERE owner_id = $1 AND friend_id = $2 AND status IN ('pending', 'running')
      ORDER BY created_at DESC LIMIT 1`, [ownerId, friendId]);
    const row = rows[0];
    return row === undefined ? null : toJob(row);
}
async function lastFinishedAt(db, ownerId, friendId) {
    const rows = await queryRows(db, `SELECT finished_at FROM ai_circle_reassessment_jobs
      WHERE owner_id = $1 AND friend_id = $2 AND status IN ('completed', 'failed', 'unavailable')
      ORDER BY finished_at DESC NULLS LAST LIMIT 1`, [ownerId, friendId]);
    const value = rows[0]?.finished_at ?? null;
    if (value === null)
        return null;
    return value instanceof Date ? value : new Date(value);
}
async function explicitJobsToday(db, ownerId, friendId) {
    const rows = await queryRows(db, `SELECT COUNT(*)::text AS count FROM ai_circle_reassessment_jobs
      WHERE owner_id = $1 AND friend_id = $2 AND reason = 'explicit'
        AND created_at >= date_trunc('day', NOW())`, [ownerId, friendId]);
    return Number.parseInt(rows[0]?.count ?? '0', 10);
}
async function createJob(db, ownerId, friendId, reason, fingerprintValue, traceId) {
    const rows = await queryRows(db, `INSERT INTO ai_circle_reassessment_jobs
       (owner_id, friend_id, status, reason, fingerprint, attempts, max_attempts, trace_id)
     VALUES ($1, $2, 'pending', $3, $4, 0, 3, $5)
     ON CONFLICT DO NOTHING
     RETURNING id, status, reason, fingerprint, attempts, trace_id, error, created_at, finished_at`, [ownerId, friendId, reason, fingerprintValue, traceId]);
    const row = rows[0];
    if (row === undefined) {
        const existing = await liveJob(db, ownerId, friendId);
        if (existing === null)
            throw new ApiError(503, 'database unavailable');
        return existing;
    }
    return toJob(row);
}
/**
 * Explicit user-triggered assessment request. Bypasses the cooldown (bounded
 * by a separate per-day explicit limit), never starts inference inline: the
 * route returns 202 and the runner picks the job up.
 */
export async function requestAssessment(db, ownerId, friendId, config) {
    await requireApprovedFriend(db, ownerId, friendId);
    const prefs = await getSettings(db, ownerId);
    if (!prefs.analysis_consent) {
        throw new ApiError(403, 'ai analysis consent required');
    }
    const existing = await liveJob(db, ownerId, friendId);
    if (existing !== null) {
        return { job: existing, queued: false, queue_note: 'live-active' };
    }
    const today = await explicitJobsToday(db, ownerId, friendId);
    if (today >= config.userRefreshPerDay) {
        throw new ApiError(429, 'explicit reassessment limit reached for today');
    }
    const signals = await getSignals(db, ownerId, friendId);
    const buckets = signals?.buckets ?? { ...SPARSE_SIGNALS };
    if (signals === null) {
        await writeSignals(db, ownerId, friendId, buckets, 'synthetic_demo', false);
    }
    const job = await createJob(db, ownerId, friendId, 'explicit', fingerprint(canonicalSignals(buckets)), randomUUID());
    return { job, queued: true, queue_note: 'queued' };
}
/**
 * Record one authorized structured event, aggregate locally, and queue at
 * most one deduplicated, cooldown-respecting reassessment. The caller is the
 * demo-scoped signal endpoint; production events would call this same path.
 */
export async function recordSignalEvent(db, ownerId, friendId, event, cooldownDays) {
    await requireApprovedFriend(db, ownerId, friendId);
    const stored = await getSignals(db, ownerId, friendId);
    const buckets = applySignalEvent(stored?.buckets ?? { ...SPARSE_SIGNALS }, event);
    const source = event.type === 'declared_change' ? 'user_provided' : (stored?.source === 'user_provided' ? 'user_provided' : 'synthetic_demo');
    const trivial = event.type === 'mention_like' || event.type === 'message_like';
    await writeSignals(db, ownerId, friendId, buckets, source, !trivial);
    const profile = await readProfile(db, ownerId, friendId);
    if (profile === null || profile.status !== 'active') {
        return { material: false, reasons: [], queued: false, queue_note: 'no-profile', job: null };
    }
    const { material, reasons } = evaluateMaterialChange(buckets, profile.baseline);
    if (!material) {
        return { material: false, reasons: [], queued: false, queue_note: 'not-material', job: null };
    }
    const prefs = await getSettings(db, ownerId);
    if (!prefs.analysis_consent) {
        return { material: true, reasons, queued: false, queue_note: 'no-consent', job: null };
    }
    const existing = await liveJob(db, ownerId, friendId);
    if (existing !== null) {
        return { material: true, reasons, queued: false, queue_note: 'live-active', job: existing };
    }
    const finished = await lastFinishedAt(db, ownerId, friendId);
    if (finished !== null && Date.now() - finished.getTime() < cooldownDays * 24 * 60 * 60 * 1000) {
        return { material: true, reasons, queued: false, queue_note: 'cooldown', job: null };
    }
    const job = await createJob(db, ownerId, friendId, 'material', fingerprint(canonicalSignals(buckets)), randomUUID());
    return { material: true, reasons, queued: true, queue_note: 'queued', job };
}
// ---- In-process runner ----------------------------------------------------------------
let runner = null;
async function claimNextJob(db) {
    const rows = await queryRows(db, `UPDATE ai_circle_reassessment_jobs SET status = 'running', started_at = NOW(), attempts = attempts + 1
      WHERE id = (
        SELECT id FROM ai_circle_reassessment_jobs
         WHERE status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
      )
      RETURNING id, status, reason, fingerprint, attempts, trace_id, error, created_at, finished_at`, []);
    // The claim above loses owner/friend; refetch the full row for processing.
    const row = rows[0];
    if (row === undefined)
        return null;
    const full = await queryRows(db, `SELECT id, owner_id, friend_id, status, reason, fingerprint, attempts, trace_id, error, created_at, finished_at
       FROM ai_circle_reassessment_jobs WHERE id = $1`, [row.id]);
    return (full[0] ?? null);
}
async function finishJob(db, jobId, status, error) {
    await queryRows(db, `UPDATE ai_circle_reassessment_jobs SET status = $2, finished_at = NOW(), error = $3 WHERE id = $1`, [jobId, status, error]);
}
async function requeueJob(db, jobId, error) {
    await queryRows(db, `UPDATE ai_circle_reassessment_jobs SET status = 'pending', error = $2 WHERE id = $1`, [jobId, error]);
}
async function persistAssessment(db, ownerId, friendId, result) {
    await queryRows(db, `INSERT INTO ai_circle_friendship_profiles
       (owner_id, friend_id, level, evidence_quality, rationale, activity_trend,
        source, model_id, signals_version, fingerprint, baseline, policy_version,
        status, assessed_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'meta_live', $7, $8, $9, $10, $11, 'active', NOW(), NOW())
     ON CONFLICT (owner_id, friend_id) DO UPDATE SET
       level = EXCLUDED.level,
       evidence_quality = EXCLUDED.evidence_quality,
       rationale = EXCLUDED.rationale,
       activity_trend = EXCLUDED.activity_trend,
       source = 'meta_live',
       model_id = EXCLUDED.model_id,
       signals_version = EXCLUDED.signals_version,
       fingerprint = EXCLUDED.fingerprint,
       baseline = EXCLUDED.baseline,
       policy_version = EXCLUDED.policy_version,
       status = 'active',
       assessed_at = NOW(),
       updated_at = NOW()`, [
        ownerId,
        friendId,
        result.level,
        result.evidence_quality,
        result.rationale,
        result.activity_trend,
        result.modelId,
        result.signalsVersion,
        result.fingerprintValue,
        JSON.stringify(result.baseline),
        POLICY_VERSION,
    ]);
}
async function processOneJob(db, provider, config, job) {
    const { owner_id: ownerId, friend_id: friendId } = job;
    // Recheck consent and friendship immediately before inference.
    try {
        await requireApprovedFriend(db, ownerId, friendId);
    }
    catch {
        return 'cancelled';
    }
    const prefs = await getSettings(db, ownerId);
    if (!prefs.analysis_consent)
        return 'cancelled';
    if (config.apiKey === '')
        return 'unavailable';
    const signals = await getSignals(db, ownerId, friendId);
    const buckets = signals?.buckets ?? { ...SPARSE_SIGNALS };
    const profile = await readProfile(db, ownerId, friendId);
    const assessedAt = profile?.assessed_at === null || profile?.assessed_at === undefined ? null : new Date(profile.assessed_at);
    const input = buildAssessInput(ownerId, friendId, buckets, {
        level: profile?.level ?? null,
        assessedDaysAgo: assessedAt === null ? null : Math.max(0, Math.floor((Date.now() - assessedAt.getTime()) / 86400000)),
    });
    try {
        const result = await provider.assessFriendship(input);
        const canonical = canonicalSignals(buckets);
        await persistAssessment(db, ownerId, friendId, {
            level: result.output.closeness_level,
            evidence_quality: result.output.evidence_quality,
            rationale: result.output.closeness_reason,
            activity_trend: result.output.activity_trend,
            modelId: result.modelId,
            signalsVersion: signals?.version ?? 1,
            fingerprintValue: fingerprint(canonical),
            baseline: canonical,
        });
        await recordModelUsage(db, ownerId, result.usage.inputTokens, result.usage.outputTokens);
        return 'completed';
    }
    catch (err) {
        if (err instanceof ApiError && err.statusCode === 503 && !isTransientModelError(err)) {
            return 'unavailable';
        }
        if (isTransientModelError(err) && job.attempts < 3)
            return 'requeued';
        return 'failed';
    }
}
/**
 * Drain pending jobs serially, single-flight. Deterministic for tests
 * (await it); routes kick it fire-and-forget after enqueue.
 */
export async function processPendingJobs(db, provider, config) {
    if (runner !== null)
        return runner;
    runner = (async () => {
        const summary = { processed: 0, completed: 0, failed: 0, unavailable: 0, cancelled: 0 };
        for (;;) {
            const job = (await claimNextJob(db));
            if (job === null)
                break;
            summary.processed += 1;
            const outcome = await processOneJob(db, provider, config, job);
            if (outcome === 'requeued') {
                await requeueJob(db, job.id, 'transient provider failure; bounded retry');
                continue;
            }
            const errorText = outcome === 'completed' ? null : outcome;
            await finishJob(db, job.id, outcome, errorText);
            summary[outcome] += 1;
        }
        return summary;
    })().finally(() => {
        runner = null;
    });
    return runner;
}
// ---- Usage counters ------------------------------------------------------------------------
export async function recordModelUsage(db, ownerId, inputTokens, outputTokens) {
    await queryRows(db, `INSERT INTO ai_circle_usage (owner_id, day, model_requests, input_tokens, output_tokens)
     VALUES ($1, CURRENT_DATE, 1, $2, $3)
     ON CONFLICT (owner_id, day) DO UPDATE SET
       model_requests = ai_circle_usage.model_requests + 1,
       input_tokens = ai_circle_usage.input_tokens + EXCLUDED.input_tokens,
       output_tokens = ai_circle_usage.output_tokens + EXCLUDED.output_tokens`, [ownerId, Math.max(0, Math.floor(inputTokens)), Math.max(0, Math.floor(outputTokens))]);
}
async function bumpUsageCounter(db, ownerId, column) {
    await queryRows(db, `INSERT INTO ai_circle_usage (owner_id, day, ${column})
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (owner_id, day) DO UPDATE SET ${column} = ai_circle_usage.${column} + 1`, [ownerId]);
}
export async function recordCacheHit(db, ownerId) {
    await bumpUsageCounter(db, ownerId, 'cache_hits');
}
export async function recordCacheMiss(db, ownerId) {
    await bumpUsageCounter(db, ownerId, 'cache_misses');
}
export async function recordRateLimited(db, ownerId) {
    await bumpUsageCounter(db, ownerId, 'rate_limited');
}
export async function getUsage(db, ownerId) {
    const rows = await queryRows(db, `SELECT COALESCE(SUM(model_requests), 0)::int AS model_requests,
            COALESCE(SUM(cache_hits), 0)::int AS cache_hits,
            COALESCE(SUM(cache_misses), 0)::int AS cache_misses,
            COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
            COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
            COALESCE(SUM(rate_limited), 0)::int AS rate_limited
       FROM ai_circle_usage WHERE owner_id = $1`, [ownerId]);
    const row = rows[0];
    return {
        model_requests: row?.model_requests ?? 0,
        cache_hits: row?.cache_hits ?? 0,
        cache_misses: row?.cache_misses ?? 0,
        input_tokens: row?.input_tokens ?? 0,
        output_tokens: row?.output_tokens ?? 0,
        rate_limited: row?.rate_limited ?? 0,
    };
}
export async function modelRequestsToday(db, ownerId) {
    const rows = await queryRows(db, 'SELECT COALESCE(model_requests, 0)::int AS model_requests FROM ai_circle_usage WHERE owner_id = $1 AND day = CURRENT_DATE', [ownerId]);
    return rows[0]?.model_requests ?? 0;
}
