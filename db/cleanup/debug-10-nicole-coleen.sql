-- Debug-10 demo-data correction: remove Nicole, clear Coleen's demo suppression.
--
-- PURPOSE
--   1. Completely remove the Nicole demo fixture (debug-9's db/seed/reconnect-demo.sql,
--      since deleted) from a database that was already seeded with it.
--   2. Clear the demo-only dismissal/snooze rows that hide Coleen from Reconnect Today.
--
-- SCOPE (narrow by construction)
--   - Nicole: ONLY the verified demo user id 'nicole' (demo_flag IS TRUE) plus rows
--     that reference that id in demo-owned tables. Genuine users with display name
--     'Nicole' have different ids and are untouched; if id 'nicole' is absent or is
--     not demo-flagged, every Nicole statement below deletes zero rows.
--   - Coleen: ONLY dismiss/snooze rows for the demo pair (owner 'you', friend
--     'coleen'), applied only when both ids are verified demo users. No other
--     user's suppression is touched; the suppression system itself is unchanged.
--   - Explicitly NOT touched: ai_circle_usage counters, 'declined' feedback (does
--     not suppress candidacy), preferences, overrides, jobs, advice, signals, or
--     profiles belonging to any other user, and all schema/volume state.
--
-- SAFETY
--   - Single transaction; plain WHERE-scoped DELETEs only. No TRUNCATE, DROP,
--     ALTER, UPDATE, or volume operation anywhere in this file.
--   - Idempotent: re-running deletes zero rows and changes nothing.
--   - Fresh clones that never seeded Nicole: every statement matches zero rows.
--
-- USAGE (host, from the repo root; never auto-run by seed or entrypoint scripts)
--   Get-Content db/cleanup/debug-10-nicole-coleen.sql | docker exec -i near-circle-db `
--     psql -U near_circle -d near_circle -v ON_ERROR_STOP=1
--   Or equivalently: psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f db/cleanup/debug-10-nicole-coleen.sql
--
-- VERIFY AFTERWARDS (expect 0, 0, then Coleen's intact rows)
--   SELECT COUNT(*) FROM users WHERE id = 'nicole';
--   SELECT COUNT(*) FROM ai_circle_feedback
--    WHERE owner_id = 'you' AND friend_id = 'coleen' AND kind IN ('dismiss', 'snooze');
--   SELECT u.id, u.demo_flag,
--          (SELECT COUNT(*) FROM relationships WHERE user_id = 'you' AND friend_id = 'coleen' AND status = 'approved') AS approved,
--          (SELECT enabled FROM visibility WHERE user_id = 'coleen') AS discoverable_opt_in,
--          (SELECT expires_at > NOW() FROM locations WHERE user_id = 'coleen') AS location_fresh,
--          (SELECT level FROM ai_circle_friendship_profiles WHERE owner_id = 'you' AND friend_id = 'coleen' AND status = 'active') AS closeness_level
--     FROM users u WHERE u.id = 'coleen';

BEGIN;

-- Nicole: demo-owned dependent records first (FK-safe regardless of CASCADEs).
DELETE FROM ai_circle_feedback
 WHERE (owner_id = 'nicole' OR friend_id = 'nicole')
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM ai_circle_meetup_advice
 WHERE (owner_id = 'nicole' OR friend_id = 'nicole')
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM ai_circle_reassessment_jobs
 WHERE (owner_id = 'nicole' OR friend_id = 'nicole')
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM ai_circle_closeness_overrides
 WHERE (owner_id = 'nicole' OR friend_id = 'nicole')
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM ai_circle_friendship_profiles
 WHERE (owner_id = 'nicole' OR friend_id = 'nicole')
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM ai_circle_signals
 WHERE (owner_id = 'nicole' OR friend_id = 'nicole')
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM ai_circle_preferences
 WHERE owner_id = 'nicole'
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM relationships
 WHERE (user_id = 'nicole' OR friend_id = 'nicole')
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM locations
 WHERE user_id = 'nicole'
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM visibility
 WHERE user_id = 'nicole'
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM stride_settings
 WHERE user_id = 'nicole'
   AND EXISTS (SELECT 1 FROM users WHERE id = 'nicole' AND demo_flag IS TRUE);
DELETE FROM users WHERE id = 'nicole' AND demo_flag IS TRUE;

-- Coleen: demo-pair suppression only; never a genuine user's preference.
DELETE FROM ai_circle_feedback
 WHERE owner_id = 'you' AND friend_id = 'coleen' AND kind IN ('dismiss', 'snooze')
   AND EXISTS (SELECT 1 FROM users WHERE id = 'you' AND demo_flag IS TRUE)
   AND EXISTS (SELECT 1 FROM users WHERE id = 'coleen' AND demo_flag IS TRUE);

COMMIT;
