-- Near-Circle database bootstrap, part 2: foundation schema (Phase 1).
-- Tables follow the data-model sketch in Near-Circle_Dev_Plan.md section 06.
-- Real reads/writes arrive with Phase 2 (radar + consented proximity);
-- Phase 1 only proves the project-owned PostgreSQL/PostGIS infrastructure.

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  demo_flag    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS relationships (
  user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'blocked')),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS locations (
  user_id         TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  geography_point GEOGRAPHY(Point, 4326) NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_point ON locations USING GIST (geography_point);

CREATE TABLE IF NOT EXISTS visibility (
  user_id         TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  radius_m        INTEGER NOT NULL DEFAULT 1000 CHECK (radius_m > 0),
  allowed_friends TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS stride_settings (
  user_id  TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  stride_m DOUBLE PRECISION NOT NULL DEFAULT 0.75 CHECK (stride_m > 0)
);
