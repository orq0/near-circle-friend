import { isConnectionError } from '../db.js';
import { ApiError } from '../errors.js';
import { estimateSteps } from '../routing/steps.js';
// Phase 2 demo context: a single explicitly local demo user. No fake auth.
export const DEMO_USER_ID = 'you';
export const DEFAULT_RADIUS_M = 1000;
// Matches the freshness window used by db/seed/phase2-demo.sql.
export const LOCATION_FRESH_DAYS = 30;
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
async function requesterState(db, userId) {
    const rows = await queryRows(db, `SELECT (v.enabled = TRUE) AS enabled,
            v.radius_m AS radius_m,
            (l.geography_point IS NOT NULL AND l.expires_at > NOW()) AS located,
            ST_Y(l.geography_point::geometry)::float8 AS lat,
            ST_X(l.geography_point::geometry)::float8 AS lon
       FROM (SELECT 1) AS dummy
       LEFT JOIN visibility v ON v.user_id = $1
       LEFT JOIN locations l ON l.user_id = $1`, [userId]);
    const row = rows[0];
    if (row === undefined)
        throw new ApiError(503, 'database unavailable');
    return {
        enabled: row.enabled === true,
        radius_m: row.radius_m ?? DEFAULT_RADIUS_M,
        located: row.located,
        lat: row.lat,
        lon: row.lon,
    };
}
function requireDiscoverableRequester(state) {
    if (!state.enabled)
        throw new ApiError(403, 'near-circle is disabled for this user');
    if (!state.located || state.lat === null || state.lon === null) {
        throw new ApiError(409, 'current location unavailable or stale');
    }
    return { lat: state.lat, lon: state.lon };
}
/**
 * Eligible nearby friends: approved friendship, target opted in, target
 * location fresh, within radius, never the requester. Real PostGIS math.
 */
export async function findNearbyFriends(db, userId, radiusM) {
    const state = await requesterState(db, userId);
    const center = requireDiscoverableRequester(state);
    const friends = await queryRows(db, `SELECT u.id AS id, u.display_name AS display_name,
            ST_Distance(me.geography_point, l.geography_point)::float8 AS distance_m,
            degrees(ST_Azimuth(me.geography_point, l.geography_point))::float8 AS bearing_deg
       FROM users u
       JOIN relationships r ON r.friend_id = u.id AND r.user_id = $1 AND r.status = 'approved'
       JOIN locations l ON l.user_id = u.id AND l.expires_at > NOW()
       JOIN visibility v ON v.user_id = u.id AND v.enabled = TRUE
       JOIN locations me ON me.user_id = $1
      WHERE u.id <> $1
        AND ST_DWithin(me.geography_point, l.geography_point, $2)
      ORDER BY distance_m ASC`, [userId, radiusM]);
    return { center, friends };
}
export async function getVisibility(db, userId) {
    const rows = await queryRows(db, 'SELECT enabled, radius_m FROM visibility WHERE user_id = $1', [userId]);
    const row = rows[0];
    return { enabled: row?.enabled === true, radius_m: row?.radius_m ?? DEFAULT_RADIUS_M };
}
export async function setEnabled(db, userId, enabled) {
    const rows = await queryRows(db, `INSERT INTO visibility (user_id, enabled) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled
     RETURNING enabled, radius_m`, [userId, enabled]);
    const row = rows[0];
    if (row === undefined)
        throw new ApiError(503, 'database unavailable');
    return row;
}
export async function setVisibility(db, userId, enabled, radiusM) {
    if (radiusM === null)
        return setEnabled(db, userId, enabled);
    const rows = await queryRows(db, `INSERT INTO visibility (user_id, enabled, radius_m) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled, radius_m = EXCLUDED.radius_m
     RETURNING enabled, radius_m`, [userId, enabled, radiusM]);
    const row = rows[0];
    if (row === undefined)
        throw new ApiError(503, 'database unavailable');
    return row;
}
export async function updateLocation(db, userId, point) {
    const rows = await queryRows(db, `INSERT INTO locations (user_id, geography_point, updated_at, expires_at)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, NOW(), NOW() + make_interval(days => ${LOCATION_FRESH_DAYS}))
     ON CONFLICT (user_id) DO UPDATE
       SET geography_point = EXCLUDED.geography_point, updated_at = NOW(),
           expires_at = NOW() + make_interval(days => ${LOCATION_FRESH_DAYS})
     RETURNING ST_Y(geography_point::geometry)::float8 AS lat,
               ST_X(geography_point::geometry)::float8 AS lon,
               updated_at, expires_at`, [userId, point.lon, point.lat]);
    const row = rows[0];
    if (row === undefined)
        throw new ApiError(503, 'database unavailable');
    return {
        lat: row.lat,
        lon: row.lon,
        updated_at: row.updated_at.toISOString(),
        expires_at: row.expires_at.toISOString(),
    };
}
export async function listFriends(db, userId) {
    return queryRows(db, `SELECT u.id AS id, u.display_name AS display_name,
            COALESCE(v.enabled, FALSE) AS near_circle_enabled,
            CASE WHEN l.user_id IS NULL THEN 'none'
                 WHEN l.expires_at > NOW() THEN 'fresh'
                 ELSE 'stale' END AS location_state
       FROM relationships r
       JOIN users u ON u.id = r.friend_id
       LEFT JOIN visibility v ON v.user_id = u.id
       LEFT JOIN locations l ON l.user_id = u.id
      WHERE r.user_id = $1 AND r.status = 'approved' AND u.id <> $1
      ORDER BY u.display_name ASC`, [userId]);
}
export async function getFriendDetail(db, userId, friendId, radiusM) {
    const state = await requesterState(db, userId);
    requireDiscoverableRequester(state);
    const rows = await queryRows(db, `SELECT u.id AS id, u.display_name AS display_name,
            COALESCE(v.enabled, FALSE) AS near_circle_enabled,
            (l.user_id IS NOT NULL AND l.expires_at > NOW()) AS fresh,
            ST_Distance(me.geography_point, l.geography_point)::float8 AS distance_m,
            degrees(ST_Azimuth(me.geography_point, l.geography_point))::float8 AS bearing_deg
       FROM users u
       JOIN relationships r ON r.friend_id = u.id AND r.user_id = $1 AND r.status = 'approved'
       LEFT JOIN visibility v ON v.user_id = u.id
       LEFT JOIN locations l ON l.user_id = u.id
       JOIN locations me ON me.user_id = $1
      WHERE u.id = $2 AND u.id <> $1`, [userId, friendId]);
    const row = rows[0];
    if (row === undefined)
        throw new ApiError(404, 'friend not found');
    const discoverable = row.near_circle_enabled &&
        row.fresh &&
        row.distance_m !== null &&
        row.distance_m <= radiusM;
    return {
        id: row.id,
        display_name: row.display_name,
        near_circle_enabled: row.near_circle_enabled,
        discoverable,
        distance_m: discoverable ? row.distance_m : null,
        bearing_deg: discoverable && row.bearing_deg !== null ? row.bearing_deg : null,
    };
}
/**
 * Consent-rechecked pedestrian route. Relationship, consent, radius, and
 * freshness are all re-verified at request time; only then is the walking
 * router consulted. Never fabricates geometry on provider failure.
 */
export async function getFriendRoute(db, provider, userId, friendId, radiusM, strideM) {
    const state = await requesterState(db, userId);
    const center = requireDiscoverableRequester(state);
    const rows = await queryRows(db, `SELECT u.id AS id, u.display_name AS display_name,
            COALESCE(v.enabled, FALSE) AS near_circle_enabled,
            (l.user_id IS NOT NULL AND l.expires_at > NOW()) AS fresh,
            ST_Y(l.geography_point::geometry)::float8 AS lat,
            ST_X(l.geography_point::geometry)::float8 AS lon,
            ST_Distance(me.geography_point, l.geography_point)::float8 AS straight_line_m
       FROM users u
       JOIN relationships r ON r.friend_id = u.id AND r.user_id = $1 AND r.status = 'approved'
       LEFT JOIN visibility v ON v.user_id = u.id
       LEFT JOIN locations l ON l.user_id = u.id
       JOIN locations me ON me.user_id = $1
      WHERE u.id = $2 AND u.id <> $1`, [userId, friendId]);
    const row = rows[0];
    if (row === undefined)
        throw new ApiError(404, 'friend not found');
    if (!row.near_circle_enabled || !row.fresh || row.lat === null || row.lon === null) {
        throw new ApiError(403, 'friend unavailable for routing');
    }
    if (row.straight_line_m === null) {
        throw new ApiError(409, 'current location unavailable or stale');
    }
    if (row.straight_line_m > radiusM) {
        throw new ApiError(403, 'friend is outside the discovery radius');
    }
    const target = { lat: row.lat, lon: row.lon };
    const route = await provider.route(center, target);
    return {
        to: { id: row.id, display_name: row.display_name },
        center,
        target,
        geometry: route.geometry,
        route_distance_m: route.distance_m,
        straight_line_m: row.straight_line_m,
        duration_s: route.duration_s,
        estimated_steps: estimateSteps(route.distance_m, strideM),
        stride_m: strideM,
    };
}
