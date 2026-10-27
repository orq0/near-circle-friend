-- Near-Circle Phase 2 demo dataset: Metro Manila, Philippines.
-- ALL IDENTITIES AND COORDINATES ARE SIMULATED for the hackathon demo.
-- Center: demo user 'you' near Rizal Park, Manila (14.5810, 120.9750).
--
-- Idempotent: safe to re-run. It never deletes rows and only touches the demo
-- ids below. The demo user's position and the stale fixture are preserved via
-- ON CONFLICT DO NOTHING; other demo locations get refreshed timestamps so the
-- demo stays fresh no matter when it runs.
--
-- Expected discovery by radius (approved + enabled + fresh + in range):
--   500 m  -> coleen
--   1000 m -> coleen, alex
--   2000 m -> coleen, alex, sam
--   5000 m -> coleen, alex, sam, nicole, rhea (nicole via reconnect-demo.sql)
-- marco is disabled, liza is stale, jose is beyond 5 km, nina is not a
-- friend, and paolo's friendship is still pending: none of them may appear.

BEGIN;

INSERT INTO users (id, display_name, demo_flag) VALUES
  ('you', 'You', TRUE),
  ('coleen', 'Coleen', TRUE),
  ('alex', 'Alex', TRUE),
  ('sam', 'Sam', TRUE),
  ('rhea', 'Rhea', TRUE),
  ('marco', 'Marco', TRUE),
  ('liza', 'Liza', TRUE),
  ('jose', 'Jose', TRUE),
  ('nina', 'Nina', TRUE),
  ('paolo', 'Paolo', TRUE)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, demo_flag = TRUE;

INSERT INTO relationships (user_id, friend_id, status) VALUES
  ('you', 'coleen', 'approved'), ('coleen', 'you', 'approved'),
  ('you', 'alex', 'approved'), ('alex', 'you', 'approved'),
  ('you', 'sam', 'approved'), ('sam', 'you', 'approved'),
  ('you', 'rhea', 'approved'), ('rhea', 'you', 'approved'),
  ('you', 'marco', 'approved'), ('marco', 'you', 'approved'),
  ('you', 'liza', 'approved'), ('liza', 'you', 'approved'),
  ('you', 'jose', 'approved'), ('jose', 'you', 'approved'),
  ('you', 'paolo', 'pending')
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- The demo user's own toggle is preserved across re-seeds.
INSERT INTO visibility (user_id, enabled, radius_m) VALUES ('you', TRUE, 1000)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO visibility (user_id, enabled, radius_m) VALUES
  ('coleen', TRUE, 1000),
  ('alex', TRUE, 1000),
  ('sam', TRUE, 1000),
  ('rhea', TRUE, 1000),
  ('marco', FALSE, 1000),
  ('liza', TRUE, 1000),
  ('jose', TRUE, 1000),
  ('nina', TRUE, 1000),
  ('paolo', TRUE, 1000)
ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Demo user's position is preserved across re-seeds.
INSERT INTO locations (user_id, geography_point, updated_at, expires_at) VALUES
  ('you', ST_SetSRID(ST_MakePoint(120.9750, 14.5810), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days')
ON CONFLICT (user_id) DO NOTHING;

-- Stale fixture: expired one hour ago, never refreshed.
INSERT INTO locations (user_id, geography_point, updated_at, expires_at) VALUES
  ('liza', ST_SetSRID(ST_MakePoint(120.9723746, 14.5835573), 4326)::geography,
   NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour')
ON CONFLICT (user_id) DO NOTHING;

-- Points are static demo fixtures; only freshness is renewed on re-seed.
INSERT INTO locations (user_id, geography_point, updated_at, expires_at) VALUES
  ('coleen', ST_SetSRID(ST_MakePoint(120.9768376, 14.5827902), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days'),
  ('alex', ST_SetSRID(ST_MakePoint(120.9762089, 14.5743222), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days'),
  ('sam', ST_SetSRID(ST_MakePoint(120.9610766, 14.5810000), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days'),
  ('rhea', ST_SetSRID(ST_MakePoint(120.9801580, 14.6094938), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days'),
  ('marco', ST_SetSRID(ST_MakePoint(120.9710619, 14.5771640), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days'),
  ('jose', ST_SetSRID(ST_MakePoint(121.0381191, 14.5810000), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days'),
  ('nina', ST_SetSRID(ST_MakePoint(120.9743651, 14.5793007), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days'),
  ('paolo', ST_SetSRID(ST_MakePoint(120.9721865, 14.5825823), 4326)::geography,
   NOW(), NOW() + INTERVAL '30 days')
ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW(), expires_at = NOW() + INTERVAL '30 days';

COMMIT;
