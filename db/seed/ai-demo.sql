-- Near-Circle AI Circle Intelligence demo fixtures: clearly labeled synthetic data.
-- ALL IDENTITIES AND INTERACTION AGGREGATES ARE SIMULATED for the hackathon demo.
--
-- Extends the Phase 2 dataset with the PRD §13 scenarios:
--   alex   — dormant close friend (persisted Level 4 fixture, sparse recent contact)
--   jamie  — frequent recent contact (persisted Level 4 fixture, beyond 5 km so
--            existing nearby expectations are unchanged)
--   sam    — little reliable history (persisted NULL = Not enough information)
--   taylor — discovery opt-out (approved friendship, visibility OFF; no profile)
--
-- UI-refinement extension: every other eligible, visible demo friend of 'you'
-- gets realistic synthetic signals plus a persisted demo profile, so Circle
-- Insight renders a meaningful card instead of an empty state:
--   coleen — inner circle (Level 5, long-standing, frequent reciprocal contact)
--   rhea   — regular friend (Level 3, steady occasional contact over years)
--   liza   — casual friend (Level 2, newer connection, growing recent contact)
--   jose   — acquaintance (Level 1, brief history, single confirmed meetup)
-- marco (visibility OFF), paolo (pending) and nina (nonfriend) intentionally
-- keep no AI rows; sam stays the genuine insufficient-information scenario.
--
-- Idempotent: safe to re-run. Never deletes rows. AI profile/consent rows use
-- ON CONFLICT DO NOTHING so live consents, assessments and overrides are never
-- overwritten by a re-seed.

BEGIN;

-- Jamie and Taylor are additive; the existing ten demo users are untouched.
INSERT INTO users (id, display_name, demo_flag) VALUES
  ('jamie', 'Jamie', TRUE),
  ('taylor', 'Taylor', TRUE)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, demo_flag = TRUE;

INSERT INTO relationships (user_id, friend_id, status) VALUES
  ('you', 'jamie', 'approved'), ('jamie', 'you', 'approved'),
  ('you', 'taylor', 'approved'), ('taylor', 'you', 'approved')
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- Taylor stays opted out of discovery on every re-seed (mirrors marco).
INSERT INTO visibility (user_id, enabled, radius_m) VALUES
  ('jamie', TRUE, 1000),
  ('taylor', FALSE, 1000)
ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Jamie sits beyond 5 km (Quiapo/Quiapo-east); Taylor is nearby but disabled.
INSERT INTO locations (user_id, geography_point, updated_at, expires_at) VALUES
  ('jamie', ST_SetSRID(ST_MakePoint(121.0450000, 14.5850000), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days'),
  ('taylor', ST_SetSRID(ST_MakePoint(120.9780000, 14.5840000), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days')
ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW(), expires_at = NOW() + INTERVAL '30 days';

-- Requester consent defaults OFF (US-01); never toggled by re-seed.
INSERT INTO ai_circle_preferences (owner_id, analysis_consent, advice_consent, availability_shared, policy_version)
VALUES ('you', FALSE, FALSE, FALSE, '1.0')
ON CONFLICT (owner_id) DO NOTHING;

-- Coarse synthetic signal aggregates. Buckets only — no bodies, no GPS.
INSERT INTO ai_circle_signals
  (owner_id, friend_id, known_for_bucket, last_meetup_bucket, contact_frequency,
   activity_trend, reciprocity_bucket, confirmed_meetups, declared_closeness,
   declared_activities, sustained_windows, source, signals_version)
VALUES
  ('you', 'alex', 'several_years', 'about_three_months_ago', 'occasional',
   'stable', 'balanced', 5, 'close_friend', ARRAY['coffee', 'walk'], 3, 'synthetic_demo', 1),
  ('you', 'jamie', 'several_years', 'about_one_week_ago', 'frequent',
   'increasing', 'balanced', 12, 'close_friend', ARRAY['lunch', 'walk'], 4, 'synthetic_demo', 1),
  ('you', 'sam', NULL, NULL, 'rare',
   'unknown', NULL, 0, NULL, ARRAY[]::TEXT[], 0, 'synthetic_demo', 1),
  ('you', 'taylor', NULL, NULL, NULL,
   'unknown', NULL, 0, NULL, ARRAY[]::TEXT[], 0, 'synthetic_demo', 1),
  ('you', 'coleen', 'several_years', 'about_one_month_ago', 'frequent',
   'stable', 'balanced', 18, 'inner_circle', ARRAY['coffee', 'lunch', 'walk'], 6, 'synthetic_demo', 1),
  ('you', 'rhea', 'several_years', 'about_three_months_ago', 'occasional',
   'stable', 'balanced', 6, 'regular_friend', ARRAY['lunch', 'catch_up'], 3, 'synthetic_demo', 1),
  ('you', 'liza', 'about_one_year', 'about_one_month_ago', 'occasional',
   'increasing', 'balanced', 3, 'casual_friend', ARRAY['coffee'], 2, 'synthetic_demo', 1),
  ('you', 'jose', 'recent_months', 'over_six_months_ago', 'rare',
   'decreasing', 'mostly_them', 1, 'acquaintance', ARRAY[]::TEXT[], 0, 'synthetic_demo', 1)
ON CONFLICT (owner_id, friend_id) DO NOTHING;

-- Persisted fixture profiles: baseline JSON mirrors the canonical signals above.
INSERT INTO ai_circle_friendship_profiles
  (owner_id, friend_id, level, evidence_quality, rationale, activity_trend,
   source, model_id, signals_version, fingerprint, baseline, policy_version,
   status, assessed_at)
VALUES
  ('you', 'alex', 4, 'moderate',
   'Longstanding reciprocal friendship; contact is intermittent but meetups confirm the bond.',
   'stable', 'demo_fixture', NULL, 1, 'seed-v1',
   '{"known_for_bucket":"several_years","last_meetup_bucket":"about_three_months_ago","contact_frequency":"occasional","activity_trend":"stable","reciprocity_bucket":"balanced","confirmed_meetups":5,"declared_closeness":"close_friend","declared_activities":["coffee","walk"],"sustained_windows":3}'::jsonb,
   '1.0', 'active', NOW()),
  ('you', 'jamie', 4, 'strong',
   'Close friend with frequent recent reciprocal contact.',
   'increasing', 'demo_fixture', NULL, 1, 'seed-v1',
   '{"known_for_bucket":"several_years","last_meetup_bucket":"about_one_week_ago","contact_frequency":"frequent","activity_trend":"increasing","reciprocity_bucket":"balanced","confirmed_meetups":12,"declared_closeness":"close_friend","declared_activities":["lunch","walk"],"sustained_windows":4}'::jsonb,
   '1.0', 'active', NOW()),
  ('you', 'sam', NULL, 'limited',
   'Not enough interaction history to estimate closeness.',
   'unknown', 'demo_fixture', NULL, 1, 'seed-v1',
   '{"known_for_bucket":null,"last_meetup_bucket":null,"contact_frequency":"rare","activity_trend":"unknown","reciprocity_bucket":null,"confirmed_meetups":0,"declared_closeness":null,"declared_activities":[],"sustained_windows":0}'::jsonb,
   '1.0', 'active', NOW()),
  ('you', 'coleen', 5, 'strong',
   'Long-standing inner-circle friendship with frequent reciprocal contact and many confirmed meetups.',
   'stable', 'demo_fixture', NULL, 1, 'seed-v1',
   '{"known_for_bucket":"several_years","last_meetup_bucket":"about_one_month_ago","contact_frequency":"frequent","activity_trend":"stable","reciprocity_bucket":"balanced","confirmed_meetups":18,"declared_closeness":"inner_circle","declared_activities":["coffee","lunch","walk"],"sustained_windows":6}'::jsonb,
   '1.0', 'active', NOW()),
  ('you', 'rhea', 3, 'moderate',
   'Established friendship with steady occasional contact over several years.',
   'stable', 'demo_fixture', NULL, 1, 'seed-v1',
   '{"known_for_bucket":"several_years","last_meetup_bucket":"about_three_months_ago","contact_frequency":"occasional","activity_trend":"stable","reciprocity_bucket":"balanced","confirmed_meetups":6,"declared_closeness":"regular_friend","declared_activities":["lunch","catch_up"],"sustained_windows":3}'::jsonb,
   '1.0', 'active', NOW()),
  ('you', 'liza', 2, 'moderate',
   'Newer friendship with growing recent contact.',
   'increasing', 'demo_fixture', NULL, 1, 'seed-v1',
   '{"known_for_bucket":"about_one_year","last_meetup_bucket":"about_one_month_ago","contact_frequency":"occasional","activity_trend":"increasing","reciprocity_bucket":"balanced","confirmed_meetups":3,"declared_closeness":"casual_friend","declared_activities":["coffee"],"sustained_windows":2}'::jsonb,
   '1.0', 'active', NOW()),
  ('you', 'jose', 1, 'limited',
   'Brief acquaintance with a single confirmed meetup and little recent contact.',
   'decreasing', 'demo_fixture', NULL, 1, 'seed-v1',
   '{"known_for_bucket":"recent_months","last_meetup_bucket":"over_six_months_ago","contact_frequency":"rare","activity_trend":"decreasing","reciprocity_bucket":"mostly_them","confirmed_meetups":1,"declared_closeness":"acquaintance","declared_activities":[],"sustained_windows":0}'::jsonb,
   '1.0', 'active', NOW())
ON CONFLICT (owner_id, friend_id) DO NOTHING;

COMMIT;
