-- Near-Circle AI Circle Intelligence, part 1: additive schema.
-- All tables are new; no existing table is altered, so Phase 1-3 behavior
-- is unchanged and rollback is a plain DROP of these tables.
-- Applied by `npm run db:seed` and by first-boot docker-entrypoint-initdb.d
-- (alphabetical order after 02-schema.sql, before db/seed files).

-- Owner-scoped AI consent and preferences. New consents default OFF (US-01).
CREATE TABLE IF NOT EXISTS ai_circle_preferences (
  owner_id         TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  analysis_consent BOOLEAN NOT NULL DEFAULT FALSE,
  advice_consent   BOOLEAN NOT NULL DEFAULT FALSE,
  availability_shared BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_start_min  INTEGER NULL CHECK (quiet_start_min IS NULL OR (quiet_start_min >= 0 AND quiet_start_min < 1440)),
  quiet_end_min    INTEGER NULL CHECK (quiet_end_min IS NULL OR (quiet_end_min >= 0 AND quiet_end_min < 1440)),
  policy_version   TEXT NOT NULL DEFAULT '1.0',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Minimal authorized aggregate signal buckets per (owner, friend).
-- Coarse buckets only; no message bodies, post text, identifiers or GPS.
CREATE TABLE IF NOT EXISTS ai_circle_signals (
  owner_id             TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id            TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  known_for_bucket     TEXT NULL,
  last_meetup_bucket   TEXT NULL,
  contact_frequency    TEXT NULL,
  activity_trend       TEXT NOT NULL DEFAULT 'unknown',
  reciprocity_bucket   TEXT NULL,
  confirmed_meetups    INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_meetups >= 0),
  declared_closeness   TEXT NULL,
  declared_activities  TEXT[] NOT NULL DEFAULT '{}',
  sustained_windows    INTEGER NOT NULL DEFAULT 0 CHECK (sustained_windows >= 0),
  source               TEXT NOT NULL DEFAULT 'synthetic_demo'
    CHECK (source IN ('synthetic_demo', 'user_provided')),
  signals_version      INTEGER NOT NULL DEFAULT 1,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, friend_id)
);

-- Persistent owner-private closeness profile. Reads never invoke the model.
-- source meta_live = persisted from real inference; demo_fixture = seed label.
CREATE TABLE IF NOT EXISTS ai_circle_friendship_profiles (
  owner_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  level            INTEGER NULL CHECK (level IS NULL OR (level BETWEEN 1 AND 5)),
  evidence_quality TEXT NULL CHECK (evidence_quality IS NULL OR evidence_quality IN ('limited', 'moderate', 'strong')),
  rationale        TEXT NOT NULL DEFAULT '',
  activity_trend   TEXT NOT NULL DEFAULT 'unknown'
    CHECK (activity_trend IN ('stable', 'increasing', 'decreasing', 'unknown')),
  source           TEXT NOT NULL CHECK (source IN ('meta_live', 'demo_fixture')),
  model_id         TEXT NULL,
  signals_version  INTEGER NOT NULL DEFAULT 1,
  fingerprint      TEXT NOT NULL DEFAULT '',
  baseline         JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_version   TEXT NOT NULL DEFAULT '1.0',
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  assessed_at      TIMESTAMPTZ NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, friend_id)
);

-- In-process durable reassessment job state. One active job per (owner,friend).
CREATE TABLE IF NOT EXISTS ai_circle_reassessment_jobs (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'unavailable', 'cancelled')),
  reason       TEXT NOT NULL DEFAULT '',
  fingerprint  TEXT NOT NULL DEFAULT '',
  attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  trace_id     TEXT NOT NULL DEFAULT '',
  error        TEXT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ NULL,
  finished_at  TIMESTAMPTZ NULL
);

-- Deduplication: at most one live (pending/running) job per pair.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_jobs_live_pair
  ON ai_circle_reassessment_jobs (owner_id, friend_id)
  WHERE status IN ('pending', 'running');

-- Manual tier override; always displayed first and never auto-replaced.
CREATE TABLE IF NOT EXISTS ai_circle_closeness_overrides (
  owner_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  level      INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, friend_id)
);

-- Short-lived meetup-advice cache. Keyed per context; dropped on revocation.
CREATE TABLE IF NOT EXISTS ai_circle_meetup_advice (
  owner_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  advice_key       TEXT NOT NULL,
  outcome          TEXT NOT NULL CHECK (outcome IN ('suggest', 'later', 'insufficient_context')),
  reason           TEXT NOT NULL DEFAULT '',
  activity         TEXT NOT NULL DEFAULT 'none' CHECK (activity IN ('coffee', 'walk', 'lunch', 'catch_up', 'none')),
  invitation_draft TEXT NOT NULL DEFAULT '',
  source           TEXT NOT NULL CHECK (source IN ('meta_live', 'meta_cached', 'demo_fixture', 'unavailable')),
  model_id         TEXT NULL,
  policy_version   TEXT NOT NULL DEFAULT '1.0',
  trace_id         TEXT NOT NULL DEFAULT '',
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, friend_id, advice_key)
);

CREATE INDEX IF NOT EXISTS ix_ai_advice_expiry
  ON ai_circle_meetup_advice (expires_at);

-- Dismiss/snooze/decline feedback. Snoozes suppress candidates until expiry.
CREATE TABLE IF NOT EXISTS ai_circle_feedback (
  id         BIGSERIAL PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('dismiss', 'snooze', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ix_ai_feedback_pair
  ON ai_circle_feedback (owner_id, friend_id, kind, expires_at);

-- Privacy-safe inference usage counters (no payloads, no prompts).
CREATE TABLE IF NOT EXISTS ai_circle_usage (
  owner_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day             DATE NOT NULL,
  model_requests  INTEGER NOT NULL DEFAULT 0 CHECK (model_requests >= 0),
  cache_hits      INTEGER NOT NULL DEFAULT 0 CHECK (cache_hits >= 0),
  cache_misses    INTEGER NOT NULL DEFAULT 0 CHECK (cache_misses >= 0),
  input_tokens    INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens   INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  rate_limited    INTEGER NOT NULL DEFAULT 0 CHECK (rate_limited >= 0),
  PRIMARY KEY (owner_id, day)
);
