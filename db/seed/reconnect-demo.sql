-- Near-Circle Reconnect Today demo fixture: Nicole.
-- ALL IDENTITIES AND COORDINATES ARE SIMULATED for the hackathon demo.
--
-- Nicole is the dedicated reconnect showcase: a close friend (persisted
-- Level 4 fixture) who lives nearby but has not been seen in months, so the
-- deterministic Reconnect Today candidate list has a lapsed-contact story to
-- demonstrate. She flows through the real data path — approved friendship,
-- discovery opt-in, fresh location, synthetic signals, demo profile — and is
-- subject to the same consent/visibility/suppression rules as everyone else.
-- Nothing about candidate selection changes; this file only completes the
-- fixture set (debug-9: Nicole previously did not exist anywhere).
--
-- Placement: ~2.5 km south-southwest of 'you' (Paranaque-side demo point).
-- Inside the 5 km demo radius with wide margin, outside 2 km so the
-- 500 m / 1000 m / 2000 m discovery sets are unchanged:
--   5000 m -> coleen, alex, sam, nicole, rhea
--
-- Idempotent: safe to re-run. Never deletes rows. The location timestamp is
-- refreshed like the other demo points; signals/profile rows use
-- ON CONFLICT DO NOTHING so live assessments are never overwritten.

BEGIN;

-- Nicole is additive; all existing demo users are untouched.
INSERT INTO users (id, display_name, demo_flag) VALUES
  ('nicole', 'Nicole', TRUE)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, demo_flag = TRUE;

INSERT INTO relationships (user_id, friend_id, status) VALUES
  ('you', 'nicole', 'approved'), ('nicole', 'you', 'approved')
ON CONFLICT (user_id, friend_id) DO NOTHING;

INSERT INTO visibility (user_id, enabled, radius_m) VALUES
  ('nicole', TRUE, 1000)
ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Static demo point; only freshness is renewed on re-seed.
INSERT INTO locations (user_id, geography_point, updated_at, expires_at) VALUES
  ('nicole', ST_SetSRID(ST_MakePoint(120.9690000, 14.5595000), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days')
ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW(), expires_at = NOW() + INTERVAL '30 days';

-- Coarse synthetic signal aggregates. Buckets only — no bodies, no GPS.
-- Close friend, lapsed in-person contact, gently drifting: the reconnect case.
INSERT INTO ai_circle_signals
  (owner_id, friend_id, known_for_bucket, last_meetup_bucket, contact_frequency,
   activity_trend, reciprocity_bucket, confirmed_meetups, declared_closeness,
   declared_activities, sustained_windows, source, signals_version)
VALUES
  ('you', 'nicole', 'several_years', 'over_six_months_ago', 'occasional',
   'decreasing', 'balanced', 9, 'close_friend', ARRAY['coffee', 'catch_up'], 4, 'synthetic_demo', 1)
ON CONFLICT (owner_id, friend_id) DO NOTHING;

-- Persisted fixture profile: baseline JSON mirrors the canonical signals above.
INSERT INTO ai_circle_friendship_profiles
  (owner_id, friend_id, level, evidence_quality, rationale, activity_trend,
   source, model_id, signals_version, fingerprint, baseline, policy_version,
   status, assessed_at)
VALUES
  ('you', 'nicole', 4, 'moderate',
   'Close friend you have not seen in months; steady history with recent drift.',
   'decreasing', 'demo_fixture', NULL, 1, 'seed-v1',
   '{"known_for_bucket":"several_years","last_meetup_bucket":"over_six_months_ago","contact_frequency":"occasional","activity_trend":"decreasing","reciprocity_bucket":"balanced","confirmed_meetups":9,"declared_closeness":"close_friend","declared_activities":["coffee","catch_up"],"sustained_windows":4}'::jsonb,
   '1.0', 'active', NOW())
ON CONFLICT (owner_id, friend_id) DO NOTHING;

COMMIT;
