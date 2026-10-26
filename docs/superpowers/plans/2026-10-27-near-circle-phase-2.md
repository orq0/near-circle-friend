# Near-Circle Phase 2 Implementation Plan

> **For agentic workers:** implement task-by-task, verifying each against a live stack when reachable.

**Goal:** Interactive proximity radar powered by real PostGIS queries over a Metro Manila demo dataset, in the existing architecture.

**Architecture:** Fastify + `pg` (parameterized) serves proximity from PostGIS; React radar renders bearing/distance results; demo-user context is the constant `you` (explicitly local, no fake auth). Seed is idempotent SQL run by `npm run db:seed`.

**Tech Stack:** Existing (React 19, Vite, Fastify 5, TS strict, Vitest) + `pg`/`@types/pg` only.

## Global Constraints

- No escalation, no push, no stash/reset, no destructive Docker, no OSRM datasets, no Phase 3.
- Live user stack on 3001/5173/5433/5001 is protected: verify read-only; own API on spare port 3101.
- `prompt-2.txt` stays untracked; commit only named Phase 2 files.
- Vitest/vite cannot run in this sandbox (esbuild restriction): verify via `tsc`, compiled `dist` + `node:test` probes, and live `pg` queries; report vitest suites as authored-not-run-here.

## Seed Design (SRID 4326, all SIMULATED)

Center `you` at Rizal Park (14.5810, 120.9750). Fresh rows: `expires_at = NOW() + 30 days`.

| id | dist | bearing | state |
|---|---|---|---|
| coleen (14.5827902, 120.9768376) | ~280 m | ~45° | enabled, fresh |
| alex (14.5743222, 120.9762089) | ~750 m | ~170° | enabled, fresh |
| sam (14.5810000, 120.9610766) | ~1500 m | ~270° | enabled, fresh |
| rhea (14.6094938, 120.9801580) | ~3200 m | ~10° | enabled, fresh |
| marco (14.5771640, 120.9710619) | ~600 m | ~225° | DISABLED |
| liza (14.5835573, 120.9723746) | ~400 m | ~315° | enabled, STALE (`expires_at < NOW()`) |
| jose (14.5810000, 121.0381191) | ~6800 m | ~90° | enabled, fresh, beyond 5 km |
| nina (14.5793007, 120.9743651) | ~200 m | ~200° | enabled, NON-FRIEND |
| paolo (14.5825823, 120.9721865) | ~350 m | ~300° | enabled, PENDING |

Expected discovery: 500 m → coleen; 1000 m → +alex; 2000 m → +sam; 5000 m → +rhea.
Idempotence: `ON CONFLICT DO NOTHING` for `you`/liza rows (preserve position/staleness); refresh timestamps for other demo locations; `DO UPDATE` display fields only.

## API Contracts

- `GET /friends/nearby?radius_m=1000` → `{center, radius_m, count, friends:[{id,display_name,distance_m,bearing_deg}]}`; 400 bad radius; 403 requester disabled; 409 requester location missing/stale; 503 DB down.
- `GET /near-circle/visibility` → `{enabled, radius_m}`.
- `PUT /near-circle/visibility {enabled, radius_m?}` → updated object (canonical).
- `POST /near-circle/toggle {enabled}` → same via shared service (prompt alias).
- `PUT /location {lat, lon}` → `{lat, lon, updated_at, expires_at}`; bounds-validated.
- `GET /friends` → approved friends with `{near_circle_enabled, location_state}`.
- `GET /friends/:id` → profile + `distance_m`/`bearing_deg` (null when not discoverable); 404 for unknown/non-friends.
- Demo context: `DEMO_USER_ID = 'you'`; `DATABASE_URL` or `POSTGRES_*` with compose-matching defaults.

## File Map

- `apps/api/package.json` (+pg), `src/db.ts`, `src/geo.ts` (haversine/bearing/validators), `src/services/proximity.ts` (SQL + eligibility), `src/routes/nearby.ts`, `src/routes/visibility.ts`, `src/routes/location.ts`, `src/routes/friends.ts`, `src/scripts/seed.ts`, `test/*.test.ts` (+`test/integration/*.test.ts` gated), `vitest` `test:integration` script.
- `db/seed/phase2-demo.sql`; `docker-compose.yml` (+DATABASE_URL); `.env.example` (+DATABASE_URL); root `db:seed` script.
- `apps/web/src/radar.ts` (polar→xy, formatDistance), `api.ts` (nearby/visibility/friends client), `components/` (ConversationPanel, RadiusSelector, live RadarScreen, extended FriendScreen, two-pane InboxScreen), `App.tsx` (fetch wiring), `App.css`, `App.test.tsx` (fetch-mocked), `mockData.ts` (+threads).
- `README.md` (Phase 2: endpoints, seed, demo script).

## Verification (no escalation)

1. `npm install`, `npm run typecheck`, API `tsc` build → `dist`.
2. `node dist/scripts/seed.js` twice → counts stable (idempotence).
3. `node:test` probes on compiled `dist` (+`tsc`-compiled `radar.js`): geo math, endpoint inject incl. real-DB integration, validation/403/404/503 paths.
4. Own API on 3101 → HTTP `/friends/nearby` across radii; kill after.
5. `npm run status` (read-only); never touch user's processes/containers.
6. Commit named files locally; report vitest suites as not-run-here with user commands.
