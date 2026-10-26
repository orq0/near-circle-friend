# Near-Circle Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Near-Circle Phase 1 foundation: mock Messenger UI with 4-screen structure, Fastify backend, PostGIS + OSRM service boundaries, and unified PowerShell launcher.

**Architecture:** npm workspaces monorepo (`apps/web`, `apps/api`) plus Docker Compose stack (`web`, `api`, `db`, `routing-walk` services). Web and API run natively for dev and in containers via Compose. Lifecycle scripts poll real readiness, never fixed sleeps.

**Tech Stack:** React 19, Vite 7, TypeScript strict, Fastify 5, Vitest, PostgreSQL 16 + PostGIS 3.4, OSRM backend (scaffolded), PowerShell 7 scripts.

## Global Constraints

- Windows 11 + PowerShell 7 + Docker Desktop target; scripts must run via `pwsh -NoProfile -ExecutionPolicy Bypass -File`.
- No fixed-delay readiness: poll TCP/HTTP/pg_isready with timeouts.
- No secrets printed in logs; `.env` gitignored, `.env.example` committed.
- Markdown spec wins over PDF on conflict; PDF page 2 defines the 4-screen journey.
- No real proximity, routing, or AI in Phase 1; placeholders must not pose as working backends.
- `stopall` preserves volumes and graph artifacts; never touches unrelated containers (Compose project scoping).
- Strict TypeScript everywhere; committed automated tests for web and API.
- npm cache override required in sandbox: `$env:npm_config_cache = "<root>/.npm-cache"`.

---

## File Map

```text
package.json                    # workspaces + startall/stopall/status + build/test
.env.example                    # all ports/URLs/credentials (placeholders only)
.gitignore                      # node_modules, dist, .env, .npm-cache, routing/data/*
docker-compose.yml              # 4 services, project name near-circle
README.md                       # setup, URLs, structure, troubleshooting
scripts/common.ps1              # shared helpers (env, compose, polling)
scripts/startall.ps1            # up + readiness + URL summary
scripts/stopall.ps1             # project-only down, preserve data
scripts/status.ps1              # container + endpoint + graph + tile checks
apps/api/package.json           # fastify, tsx, vitest, typescript
apps/api/tsconfig.json          # strict, NodeNext, outDir dist
apps/api/Dockerfile             # node:22-alpine, dev server
apps/api/src/app.ts             # buildApp(): Fastify factory (exported for tests)
apps/api/src/index.ts           # listen on API_PORT, /health + /demo/friends logs
apps/api/src/routes/health.ts   # GET /health -> {status,service,version}
apps/api/src/routes/demo.ts     # GET /demo/friends -> labeled mock friends
apps/api/src/demoData.ts        # shared seed (ids coleen/alex/sam)
apps/api/test/health.test.ts    # inject tests for /health
apps/api/test/demo.test.ts      # inject tests for /demo/friends
apps/web/package.json           # react, vite, vitest, jsdom, testing-library
apps/web/vite.config.ts         # react plugin, /api proxy, vitest jsdom env
apps/web/tsconfig.json          # strict, bundler resolution, vitest types
apps/web/index.html             # root div, viewport, title
apps/web/Dockerfile             # node:22-alpine, vite dev host 0.0.0.0
apps/web/src/main.tsx           # React root render
apps/web/src/App.tsx            # screen state machine (inbox/radar/friend/route)
apps/web/src/types.ts           # Friend, Screen, Visibility types
apps/web/src/mockData.ts        # YOU + Coleen/Alex/Sam + conversation previews
apps/web/src/api.ts             # fetchApiHealth() with timeout, never throws
apps/web/src/App.css            # Messenger-inspired responsive styles
apps/web/src/components/PrototypeBanner.tsx  # unofficial-prototype label
apps/web/src/components/VisibilityToggle.tsx # controlled toggle switch
apps/web/src/components/ConversationItem.tsx # avatar, name, status, preview
apps/web/src/components/InboxScreen.tsx      # screen 01
apps/web/src/components/RadarScreen.tsx      # screen 02 (static preview dots)
apps/web/src/components/FriendScreen.tsx     # screen 03 (info + route action)
apps/web/src/components/RouteScreen.tsx      # screen 04 (honest Phase-3 stub)
apps/web/src/components/ApiStatus.tsx        # API connected/unreachable pill
apps/web/src/App.test.tsx         # inbox renders, open radar, toggle flips
db/init/01-extensions.sql       # CREATE EXTENSION postgis
db/init/02-schema.sql           # users/relationships/locations/visibility/stride_settings
routing/README.md               # Phase-3 bootstrap docs + direct API test
routing/data/.gitkeep           # graph artifacts live here (gitignored otherwise)
docs/superpowers/plans/2026-10-27-near-circle-phase-1.md  # this plan
```

### Task 1: Root foundation (package.json, env, compose, gitignore)

**Files:**
- Create: `package.json`, `.env.example`, `docker-compose.yml`, `.gitignore` (replace empty), `README.md`

**Interfaces:**
- Produces: npm scripts `startall|stopall|status|build|test|dev:api|dev:web`; env vars `WEB_PORT, API_PORT, POSTGRES_PORT, ROUTING_WALK_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, ROUTING_PROVIDER, ROUTING_WALK_URL, MAP_TILE_URL, MAP_TILE_ATTRIBUTION, DEFAULT_STRIDE_M, VITE_API_URL`.

- [ ] **Step 1: Write root package.json**

```json
{
  "name": "near-circle",
  "version": "0.1.0",
  "private": true,
  "description": "Near-Circle: opt-in friend proximity radar + walking routes (Meta Global AI Hackathon)",
  "workspaces": ["apps/web", "apps/api"],
  "scripts": {
    "startall": "pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/startall.ps1",
    "stopall": "pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/stopall.ps1",
    "status": "pwsh -NoProfile -ExecutionPolicy Bypass -File ./scripts/status.ps1",
    "dev:api": "npm --workspace apps/api run dev",
    "dev:web": "npm --workspace apps/web run dev",
    "build": "npm --workspace apps/api run build && npm --workspace apps/web run build",
    "test": "npm --workspace apps/api run test && npm --workspace apps/web run test",
    "typecheck": "npm --workspace apps/api run typecheck && npm --workspace apps/web run typecheck"
  },
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 2: Write .env.example** (ports 5173/3001/5433/5001; postgres dev placeholders; routing + tile URLs; stride 0.75)
- [ ] **Step 3: Write docker-compose.yml** (`name: near-circle`; web/api/db/routing-walk; named volumes `near-circle-db-data`; bind `./routing/data:/data`; `restart: "no"` on routing-walk; db healthcheck `pg_isready`; all ports env-driven with defaults)
- [ ] **Step 4: Write .gitignore and README.md skeleton** (README finalized in Task 7)

### Task 2: Lifecycle scripts (common/startall/stopall/status)

**Files:**
- Create: `scripts/common.ps1`, `scripts/startall.ps1`, `scripts/stopall.ps1`, `scripts/status.ps1`

**Interfaces:**
- Consumes: `.env` (optional) + defaults; `docker compose`.
- Produces: exit 0/1; human summary tables; readiness booleans.

- [ ] **Step 1: Write common.ps1** with `Read-NearCircleEnv` (parse KEY=VALUE, ignore comments), `Get-ComposeCommand` (returns `docker compose` or `$null`), `Wait-HttpOk(url, timeoutSec)`, `Test-TcpPort(host, port)`, `Write-NcStatus(name, state, detail)` with color map.
- [ ] **Step 2: Write startall.ps1**: prereq check (docker+compose, actionable error + native-dev hint) -> `compose up -d` -> poll db (`compose exec -T db pg_isready -U user`, 60s) -> poll API `/health` (60s) -> poll web `/` (60s) -> routing: if `routing/data/near-circle.osrm` missing report `not-ready (graph not prepared, Phase 3)` else poll test route -> print URLs + summary. Exit 0 when db+api+web healthy.
- [ ] **Step 3: Write stopall.ps1**: `compose down` (no `-v`), project-only by Compose file scoping; refuse to touch anything else; handle docker-missing gracefully.
- [ ] **Step 4: Write status.ps1**: per service container state via `compose ps --format json` (or `not-started`); endpoint checks (db TCP, API /health, web /) independent of Docker; routing graph-file check; tile provider URL display + best-effort HEAD with 5s timeout (`unknown` on failure). Read-only.

### Task 3: Fastify backend + tests

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/Dockerfile`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/routes/demo.ts`, `apps/api/src/demoData.ts`, `apps/api/test/health.test.ts`, `apps/api/test/demo.test.ts`

**Interfaces:**
- Consumes: `API_PORT` (default 3001).
- Produces: `GET /health -> {status:"ok",service:"near-circle-api",version:"0.1.0",phase:"1"}`; `GET /demo/friends -> {demo:true,notice:string,friends:[{id,display_name,status,conversation_preview}]}`.

- [ ] **Step 1: Write package.json** (fastify ^5, tsx, typescript, vitest; scripts dev/build/start/test/typecheck)
- [ ] **Step 2: Write tsconfig.json** (strict, noUnusedLocals, NodeNext, outDir dist, rootDir src)
- [ ] **Step 3: Write src/routes/health.ts, src/routes/demo.ts, src/demoData.ts, src/app.ts, src/index.ts**
- [ ] **Step 4: Write tests** (inject `/health` 200 + shape; inject `/demo/friends` 3 friends + demo flag)
- [ ] **Step 5: Write Dockerfile** (node:22-alpine, install, expose 3001, `npm run dev -- --host` equivalent via tsx watch on 0.0.0.0)

### Task 4: Database foundation

**Files:**
- Create: `db/init/01-extensions.sql`, `db/init/02-schema.sql`

**Interfaces:**
- Produces: PostGIS extension + 5 tables per dev-plan sketch; no app dependency in Phase 1.

- [ ] **Step 1: Write 01-extensions.sql** (`CREATE EXTENSION IF NOT EXISTS postgis;`)
- [ ] **Step 2: Write 02-schema.sql** (users, relationships, locations with `geography(Point,4326)`, visibility, stride_settings; all `IF NOT EXISTS`)

### Task 5: Routing scaffold

**Files:**
- Create: `routing/README.md`, `routing/data/.gitkeep`

**Interfaces:**
- Produces: documented Phase-3 bootstrap contract; `routing/data/near-circle.osrm` presence = readiness signal.

- [ ] **Step 1: Write routing/README.md** (why scaffolded, bootstrap steps: download OSM extract -> osrm-extract -p foot.lua -> partition -> customize -> routed; direct API test command; readiness contract)
- [ ] **Step 2: Write routing/data/.gitkeep**

### Task 6: Web UI (mock Messenger + 4 screens + toggle + tests)

**Files:** (see File Map under `apps/web/src`)

**Interfaces:**
- Consumes: `mockData.ts` friends; `VITE_API_URL` or `/api` proxy for health pill.
- Produces: `App` screen machine `inbox -> radar -> friend -> route`, visibility boolean in localStorage `nc-visibility`.

- [ ] **Step 1: Write package.json, vite.config.ts (`/api` proxy to localhost:3001, test jsdom), tsconfig.json, index.html, Dockerfile**
- [ ] **Step 2: Write types.ts, mockData.ts (Coleen/Online, Alex/Last seen recently, Sam/Chat available), api.ts (fetchApiHealth with AbortController timeout, returns boolean)**
- [ ] **Step 3: Write components** (PrototypeBanner, VisibilityToggle, ConversationItem, InboxScreen, RadarScreen with static labeled preview dots, FriendScreen with consent note, RouteScreen with honest Phase-3 stub, ApiStatus pill)
- [ ] **Step 4: Write App.tsx (screen state + selected friend + visibility state) and App.css (responsive, max-width 520px shell, Messenger blue #0084ff accents)**
- [ ] **Step 5: Write App.test.tsx** (renders 3 friends; Open Near-Circle -> radar YOU; toggle flips label; friend dot -> friend screen; no real coords asserted)

### Task 7: README + verification

**Files:**
- Modify: `README.md` (final)

- [ ] **Step 1: Finalize README** (prereqs, install, startall/status/stopall, native dev fallback, URLs table, structure, Phase-1 scope + honesty notes, troubleshooting incl. Docker-missing and slow-registry cache override)
- [ ] **Step 2: Install** `npm install --no-audit --no-fund` with `npm_config_cache` override; Expected: lockfile + workspaces linked.
- [ ] **Step 3: Build+test** `npm run typecheck && npm run build && npm run test`; Expected: all green.
- [ ] **Step 4: Live check** start API + web natively, `npm run status` shows endpoints reachable, docker services `not-started`; stop natives.
- [ ] **Step 5: Acceptance checklist + final report** per prompt-1.txt section 10.

## Self-Review

1. **Spec coverage:** prompt-1 sections 2-7 each map to Tasks 1-6; section 8 order followed; section 9 checklist verified in Task 7 step 5. PDF page 2 journey drives Task 6 screens; MD API contract drives Task 3 routes; MD 04B drives Task 2.
2. **Placeholder scan:** fixed values everywhere (ports, versions, file paths, endpoint shapes); no TBD/TODO.
3. **Type consistency:** friend ids `coleen|alex|sam` shared by api demoData and web mockData; env var names identical across .env.example, compose, and scripts.
