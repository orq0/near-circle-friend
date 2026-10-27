// AI Circle Intelligence advisor: deterministic candidate discovery (zero
// inference by construction) plus the explicit on-demand meetup advisor with
// pre/post authorization, short-lived cache, budgets and a clearly labeled
// deterministic demo fallback when no API key is configured.
import { findNearbyFriends, getFriendDetail, getFriendRoute, } from '../services/proximity.js';
import { isConnectionError } from '../db.js';
import { ApiError } from '../errors.js';
import { ADVICE_ACTIVITIES, buildAdviseInput, fingerprint, } from './contracts.js';
import { getCloseness, getSettings, getSignals, inQuietHours, modelRequestsToday, recordCacheHit, recordCacheMiss, recordModelUsage, recordRateLimited, requireApprovedFriend, } from './aiCircle.js';
import { POLICY_VERSION, } from './types.js';
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
// ---- Suppression (dismiss / snooze) -------------------------------------------------
export async function isSuppressed(db, ownerId, friendId) {
    const rows = await queryRows(db, `SELECT 1 AS one FROM ai_circle_feedback
      WHERE owner_id = $1 AND friend_id = $2 AND kind IN ('dismiss', 'snooze')
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`, [ownerId, friendId]);
    return rows.length > 0;
}
export async function getOpportunities(db, ownerId, radiusM, deps = {}, cap = 10) {
    const { friends } = await findNearbyFriends(db, ownerId, radiusM);
    const out = [];
    for (const friend of friends) {
        if (out.length >= cap)
            break;
        if (await isSuppressed(db, ownerId, friend.id))
            continue;
        const closeness = await getCloseness(db, ownerId, friend.id, true);
        let walkMinutes = null;
        if (deps.routing !== undefined) {
            try {
                const route = await getFriendRoute(db, deps.routing, ownerId, friend.id, radiusM, 0.75);
                walkMinutes = Math.round(route.duration_s / 60);
            }
            catch (err) {
                if (err instanceof ApiError && err.statusCode === 403)
                    continue;
                // 404 route / provider outage: omit ETA, never invent one.
                walkMinutes = null;
            }
        }
        out.push({
            id: friend.id,
            display_name: friend.display_name,
            distance_m: friend.distance_m,
            bearing_deg: friend.bearing_deg,
            walk_minutes: walkMinutes,
            closeness: closeness.level_source === 'none'
                ? null
                : { level: closeness.level, level_source: closeness.level_source },
            context: 'Nearby and available for discovery',
        });
    }
    return out;
}
function walkBucket(walkMinutes) {
    if (walkMinutes === null)
        return 'walk_unknown';
    return `walk_${Math.floor(walkMinutes / 5) * 5}`;
}
function adviceKey(args) {
    return fingerprint({
        owner: args.ownerId,
        friend: args.friendId,
        level: args.facts.level,
        level_source: args.facts.levelSource,
        trend: args.facts.trend,
        last_meetup: args.facts.lastMeetupBucket,
        both_available: args.facts.bothSharedAvailable,
        walk: walkBucket(args.facts.walkMinutes),
        declined: args.facts.recentInviteDeclined,
        activities: [...args.facts.declaredActivities].sort(),
        radius: args.facts.radiusM,
        policy: POLICY_VERSION,
        window: args.windowStart,
    });
}
async function readAdvice(db, ownerId, friendId, key) {
    const rows = await queryRows(db, `SELECT outcome, reason, activity, invitation_draft, source, model_id,
            generated_at, trace_id, advice_key
       FROM ai_circle_meetup_advice
      WHERE owner_id = $1 AND friend_id = $2 AND advice_key = $3 AND expires_at > NOW()`, [ownerId, friendId, key]);
    return rows[0] ?? null;
}
async function writeAdvice(db, ownerId, friendId, key, outcome, reason, activity, draft, source, modelId, traceId, ttlMin) {
    await queryRows(db, `INSERT INTO ai_circle_meetup_advice
       (owner_id, friend_id, advice_key, outcome, reason, activity, invitation_draft,
        source, model_id, policy_version, trace_id, generated_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(),
             NOW() + make_interval(mins => $12))
     ON CONFLICT (owner_id, friend_id, advice_key) DO UPDATE SET
       outcome = EXCLUDED.outcome, reason = EXCLUDED.reason,
       activity = EXCLUDED.activity, invitation_draft = EXCLUDED.invitation_draft,
       source = EXCLUDED.source, model_id = EXCLUDED.model_id,
       policy_version = EXCLUDED.policy_version, trace_id = EXCLUDED.trace_id,
       generated_at = NOW(), expires_at = NOW() + make_interval(mins => $12)`, [
        ownerId,
        friendId,
        key,
        outcome,
        reason,
        activity,
        draft,
        source,
        modelId,
        POLICY_VERSION,
        traceId,
        ttlMin,
    ]);
}
async function recentPairAdviceCount(db, ownerId, friendId, hours) {
    const rows = await queryRows(db, `SELECT COUNT(*)::text AS count FROM ai_circle_meetup_advice
      WHERE owner_id = $1 AND friend_id = $2
        AND generated_at > NOW() - make_interval(hours => $3)`, [ownerId, friendId, hours]);
    return Number.parseInt(rows[0]?.count ?? '0', 10);
}
async function recentDeclined(db, ownerId, friendId) {
    const rows = await queryRows(db, `SELECT 1 AS one FROM ai_circle_feedback
      WHERE owner_id = $1 AND friend_id = $2 AND kind = 'declined'
        AND created_at > NOW() - INTERVAL '7 days'
      LIMIT 1`, [ownerId, friendId]);
    return rows.length > 0;
}
// Eligibility reuses the existing discovery contract: approved friendship,
// requester enabled + located, friend enabled + fresh + within radius.
async function checkEligible(db, ownerId, friendId, radiusM) {
    const detail = await getFriendDetail(db, ownerId, friendId, radiusM);
    if (!detail.discoverable) {
        throw new ApiError(403, 'friend is not eligible for advice right now');
    }
    if (await isSuppressed(db, ownerId, friendId)) {
        throw new ApiError(409, 'suggestion suppressed for this friend');
    }
}
/** Deterministic demo advisor: used ONLY without an API key in demo mode. */
export function demoAdvise(facts) {
    const activity = facts.declaredActivities.find((a) => ADVICE_ACTIVITIES.includes(a)) ?? 'coffee';
    if (facts.level === null) {
        return {
            opportunity: 'insufficient_context',
            opportunity_reason: 'Not enough friendship context to judge today.',
            activity: 'none',
            invitation_draft: null,
        };
    }
    if (facts.walkMinutes !== null && facts.walkMinutes > 45) {
        return {
            opportunity: 'later',
            opportunity_reason: 'Quite a long walk today; another day may suit better.',
            activity,
            invitation_draft: null,
        };
    }
    if (facts.recentInviteDeclined) {
        return {
            opportunity: 'later',
            opportunity_reason: 'You recently passed on an invite; no rush to ask again.',
            activity,
            invitation_draft: null,
        };
    }
    if (!facts.bothSharedAvailable) {
        return {
            opportunity: 'later',
            opportunity_reason: 'No shared availability was confirmed; check another time.',
            activity,
            invitation_draft: null,
        };
    }
    const noun = activity === 'none' ? 'catch up' : activity === 'catch_up' ? 'catch up' : `grab ${activity}`;
    return {
        opportunity: 'suggest',
        opportunity_reason: `${facts.displayName} is nearby and you both shared availability. Catching up could be convenient if you both want to.`,
        activity,
        invitation_draft: `Hey ${facts.displayName}! It's been a while. Would you like to ${noun} today? No pressure!`,
    };
}
export async function requestAdvice(db, provider, routing, ownerId, friendId, radiusM, displayName, config, now = new Date()) {
    if (!config.enabled) {
        throw new ApiError(503, 'ai unavailable');
    }
    const prefs = await getSettings(db, ownerId);
    if (!prefs.advice_consent) {
        throw new ApiError(403, 'ai advice consent required');
    }
    if (inQuietHours(prefs, now)) {
        throw new ApiError(409, 'quiet hours active');
    }
    await requireApprovedFriend(db, ownerId, friendId);
    await checkEligible(db, ownerId, friendId, radiusM);
    const closeness = await getCloseness(db, ownerId, friendId, true);
    const signals = await getSignals(db, ownerId, friendId);
    const friendPrefs = await getSettings(db, friendId);
    const bothSharedAvailable = prefs.availability_shared && friendPrefs.availability_shared;
    let walkMinutes = null;
    if (routing !== undefined) {
        try {
            const route = await getFriendRoute(db, routing, ownerId, friendId, radiusM, 0.75);
            walkMinutes = Math.round(route.duration_s / 60);
        }
        catch {
            walkMinutes = null; // OSRM absent or route unknown: omit ETA, never invent it.
        }
    }
    const declined = await recentDeclined(db, ownerId, friendId);
    const facts = {
        level: closeness.level,
        levelSource: closeness.level_source,
        trend: signals?.buckets.activity_trend ?? 'unknown',
        lastMeetupBucket: signals?.buckets.last_meetup_bucket ?? null,
        declaredActivities: signals?.buckets.declared_activities ?? [],
        bothSharedAvailable,
        walkMinutes,
        recentInviteDeclined: declined,
        radiusM,
    };
    const windowMs = config.adviceTtlMin * 60 * 1000;
    const windowStart = Math.floor(now.getTime() / windowMs);
    const key = adviceKey({ ownerId, friendId, facts, windowStart });
    const traceId = `${Date.now().toString(36)}-${friendId}`;
    const cached = await readAdvice(db, ownerId, friendId, key);
    if (cached !== null) {
        // Reauthorize before serving anything cached.
        await checkEligible(db, ownerId, friendId, radiusM);
        const recheck = await getSettings(db, ownerId);
        if (!recheck.advice_consent)
            throw new ApiError(403, 'ai advice consent required');
        await recordCacheHit(db, ownerId);
        // Cached demo rows keep the demo label; only cached live rows say cached.
        const servedSource = cached.source === 'meta_live' ? 'meta_cached' : cached.source;
        return {
            outcome: cached.outcome,
            reason: cached.reason,
            activity: cached.activity,
            invitation_draft: cached.invitation_draft === '' ? null : cached.invitation_draft,
            source: servedSource,
            model_id: cached.model_id,
            generated_at: iso(cached.generated_at),
            trace_id: cached.trace_id,
        };
    }
    await recordCacheMiss(db, ownerId);
    // Demo fallback: deterministic, explicitly labeled; still gated on all
    // consent/eligibility above and never counted as a model request.
    if (config.apiKey === '' && config.demoMode) {
        const demo = demoAdvise({
            level: facts.level,
            bothSharedAvailable: facts.bothSharedAvailable,
            walkMinutes: facts.walkMinutes,
            declaredActivities: facts.declaredActivities,
            displayName,
            recentInviteDeclined: facts.recentInviteDeclined,
        });
        await writeAdvice(db, ownerId, friendId, key, demo.opportunity, demo.opportunity_reason, demo.activity, demo.invitation_draft ?? '', 'demo_fixture', null, traceId, config.adviceTtlMin);
        return {
            outcome: demo.opportunity,
            reason: demo.opportunity_reason,
            activity: demo.activity,
            invitation_draft: demo.invitation_draft,
            source: 'demo_fixture',
            model_id: null,
            generated_at: now.toISOString(),
            trace_id: traceId,
        };
    }
    if (config.apiKey === '') {
        throw new ApiError(503, 'ai unavailable');
    }
    const spent = await modelRequestsToday(db, ownerId);
    if (spent >= config.dailyRequestBudget) {
        await recordRateLimited(db, ownerId);
        throw new ApiError(429, 'ai daily budget reached');
    }
    const pairRecent = await recentPairAdviceCount(db, ownerId, friendId, config.advicePairWindowHours);
    if (pairRecent >= 1) {
        await recordRateLimited(db, ownerId);
        throw new ApiError(429, 'ai rate limited for this friend');
    }
    const perDay = await modelRequestsToday(db, ownerId);
    if (perDay >= config.advicePerUserDay) {
        await recordRateLimited(db, ownerId);
        throw new ApiError(429, 'ai rate limited');
    }
    const input = buildAdviseInput({
        ownerId,
        friendId,
        closenessLevel: facts.level,
        closenessSource: facts.levelSource === 'user_choice'
            ? 'user_choice'
            : facts.levelSource === 'ai_estimate'
                ? 'ai_estimate'
                : 'none',
        lastMeetupBucket: facts.lastMeetupBucket,
        recentActivity: facts.trend,
        declaredActivities: facts.declaredActivities,
        bothSharedAvailable: facts.bothSharedAvailable,
        walkMinutes: facts.walkMinutes,
        recentInviteDeclined: facts.recentInviteDeclined,
    });
    const result = await provider.adviseMeetup(input);
    // Post-inference recheck before releasing anything.
    await checkEligible(db, ownerId, friendId, radiusM);
    const post = await getSettings(db, ownerId);
    if (!post.advice_consent)
        throw new ApiError(403, 'ai advice consent required');
    await writeAdvice(db, ownerId, friendId, key, result.output.opportunity, result.output.opportunity_reason, result.output.activity, result.output.invitation_draft ?? '', 'meta_live', result.modelId, traceId, config.adviceTtlMin);
    await recordModelUsage(db, ownerId, result.usage.inputTokens, result.usage.outputTokens);
    return {
        outcome: result.output.opportunity,
        reason: result.output.opportunity_reason,
        activity: result.output.activity,
        invitation_draft: result.output.invitation_draft,
        source: 'meta_live',
        model_id: result.modelId,
        generated_at: now.toISOString(),
        trace_id: traceId,
    };
}
// ---- Feedback -------------------------------------------------------------------
export async function recordFeedback(db, ownerId, friendId, kind, snoozeMinutes) {
    await requireApprovedFriend(db, ownerId, friendId);
    const minutes = kind === 'snooze' ? (snoozeMinutes ?? 1440) : null;
    const rows = await queryRows(db, `INSERT INTO ai_circle_feedback (owner_id, friend_id, kind, expires_at)
     VALUES ($1, $2, $3, CASE WHEN $4::int IS NULL THEN NULL ELSE NOW() + make_interval(mins => $4) END)
     RETURNING expires_at`, [ownerId, friendId, kind, minutes]);
    return { kind, expires_at: iso(rows[0]?.expires_at ?? null) };
}
