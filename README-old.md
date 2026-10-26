# Near-Circle

**Meta Global AI Hackathon — standalone prototype (Phase 1).**
A Messenger-style concept UI that will turn opt-in friend proximity into an
interactive radar, then a real walking route, ETA, and step estimate.

> Unofficial prototype. The messaging-style interface and friend identities are
> simulated for the demo. This is not a Facebook or Messenger feature, and no
> Meta Graph API is involved.

Authoritative references: [`Near-Circle_Dev_Plan.md`](./Near-Circle_Dev_Plan.md)
(technical spec) and [`Near-Circle_Dev_Plan_visual.pdf`](./Near-Circle_Dev_Plan_visual.pdf)
(visual / UX reference). On conflict, the Markdown wins.

## Services

| Service | Stack | Default URL |
|---|---|---|
| Web (`near-circle-web`) | React + Vite + TypeScript | http://localhost:5173/ |
| API (`near-circle-api`) | Fastify + TypeScript | http://localhost:3001/health |
| Database (`near-circle-db`) | PostgreSQL 16 + PostGIS 3.4 | localhost:5433 |
| Walking router (`near-circle-routing-walk`) | OSRM, foot profile | Phase 1: scaffolded, not ready |
| Map tiles | External OSM-compatible provider | Configured URL, never a local container |

## Prerequisites

- Windows 11, PowerShell 7 (`pwsh`), VS Code
- Node.js 20+ and npm
- Docker Desktop (for the Compose stack; web + API also run natively)

## Quickstart

```powershell
# 1. Environment (optional overrides)
Copy-Item .env.example .env

# 2. Dependencies
npm install

# 3. Start everything (waits for real readiness, prints URLs + health)
npm run startall

# 4. Open the app
# http://localhost:5173/
```

Other commands:

```powershell
npm run status    # read-only health of every service
npm run stopall   # stop project services only; preserves data + graphs
```

Native development fallback (no Docker needed):

```powershell
npm run dev:api    # Fastify with reload on http://localhost:3001
npm run dev:web    # Vite with HMR on http://localhost:5173
```

Checks:

```powershell
npm run typecheck
npm run build
npm run test
```

## Four-screen journey (Phase 1)

1. **Inbox** — mock conversations (Coleen/Online, Alex/Last seen recently,
   Sam/Chat available), **Open Near-Circle** button, visibility toggle.
2. **Radar** — centered YOU + tappable friend dots. Preview layout; live
   PostGIS positioning arrives in Phase 2.
3. **Friend selected** — identity, consent status, **View walking route**.
4. **Route + steps** — screen structure only. Real pedestrian routing, ETA,
   and step math arrive in Phase 3; the stub says so honestly.

## Project structure

```text
apps/web/        # React + Vite + TS prototype UI (mock data in src/mockData.ts)
apps/api/        # Fastify API: GET /health, GET /demo/friends
db/init/         # PostGIS extension + foundation schema
routing/         # OSRM service boundary: README + data/ for the Phase 3 graph
scripts/         # startall.ps1 / stopall.ps1 / status.ps1 (+ common.ps1)
docker-compose.yml  # the four project-owned services
```

## Environment

See [`.env.example`](./.env.example). All ports, credentials, and routing/tile
URLs are configurable. `startall`/`status` never print secrets.

## Troubleshooting

- **Docker missing**: `startall` errors with an actionable message; use
  `npm run dev:api` + `npm run dev:web` for native development.
- **Port conflict**: set `WEB_PORT`/`API_PORT`/`POSTGRES_PORT`/`ROUTING_WALK_PORT`
  in `.env`.
- **Router shows `not-ready`**: expected in Phase 1 — no pedestrian graph has
  been prepared yet. See [`routing/README.md`](./routing/README.md).
- **npm EPERM on cache (locked-down profiles)**:
  `$env:npm_config_cache = "$PWD\.npm-cache"; npm install`.
- **Tile outage**: the map dependency is external; `status` reports it as
  `unknown` and the demo must not present routes as working.

## Phase boundary

Phase 1 delivers the foundation: mock UI, API skeleton, PostGIS
infrastructure, OSRM service boundary, unified launcher. Real proximity
discovery (Phase 2), walking routes + steps (Phase 3), API validation
(Phase 4), and Meta AI (Phase 5) are explicitly out of scope.
