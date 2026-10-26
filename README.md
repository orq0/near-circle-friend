# Near-Circle

**Proposed Facebook Messenger Feature | Meta Global AI Hackathon | Phase 1**

Near-Circle is a proposed **proximity-based friend discovery feature for Facebook Messenger**. It would allow friends who explicitly opt in to discover one another within a configurable geographic radius using an interactive radar, select an eligible friend, and view a real walking route with estimated travel time and step count.

The hackathon implementation is a **standalone proof of concept** designed to demonstrate how Near-Circle could work as a future Messenger feature. Its Messenger-inspired interface, demo identities, conversations, and friend relationships are simulated. Geospatial discovery, permission-aware routing, and Meta AI integration will be implemented in their respective development phases.

> **Project status:** This is a proposal, not an officially released, endorsed, or integrated Facebook Messenger feature. Phase 1 does not access Facebook friends or messages, and it does not use the Meta Graph API. Any future integration would depend on the relevant platform APIs, permissions, and approvals.

**Project references:** [`Near-Circle_Dev_Plan.md`](./Near-Circle_Dev_Plan.md) is the authoritative technical specification; [`Near-Circle_Dev_Plan_visual.pdf`](./Near-Circle_Dev_Plan_visual.pdf) is the visual and UX reference. If they conflict technically, the Markdown specification takes precedence.

## Services

| Service | Stack | Default URL / status |
|---|---|---|
| Web (`near-circle-web`) | React + Vite + TypeScript | http://localhost:5173/ |
| API (`near-circle-api`) | Fastify + TypeScript | http://localhost:3001/health |
| Database (`near-circle-db`) | PostgreSQL 16 + PostGIS 3.4 | `localhost:5433` |
| Walking router (`near-circle-routing-walk`) | OSRM foot profile, `routing` Compose profile | Phase 1: off until graph prepared |
| Map tiles | External OSM-compatible provider | Configurable URL; not a local container |

The four local services have independent boundaries. The map tile provider is a separate external dependency by default. The routing service will use a dedicated pedestrian graph once Phase 3 is implemented.

## Prerequisites

- Windows 11, PowerShell 7 (`pwsh`), and VS Code
- Node.js 20+ and npm
- Docker Desktop for the Compose stack; the web and API can also run natively

## Quickstart

```powershell
# 1. Environment (optional overrides)
Copy-Item .env.example .env

# 2. Dependencies
npm install

# 3. Start the implemented project services
npm run startall

# 4. Open the app
# http://localhost:5173/
```

Other commands:

```powershell
npm run status     # Read-only health of every service
npm run stopall    # Stop project services only; preserve data and graphs
```

Native development fallback (no Docker required for the web and API):

```powershell
npm run dev:api    # Fastify with reload: http://localhost:3001
npm run dev:web    # Vite with HMR: http://localhost:5173
```

Checks:

```powershell
npm run typecheck
npm run build
npm run test
```

## Proposed four-screen Messenger experience

This sequence illustrates the proposed feature's user journey. **In Phase 1, the interface is a simulated preview; the geospatial and routing functions are not yet live.**

1. **Inbox** — Messenger-inspired mock conversations (Coleen / Online, Alex / Last seen recently, Sam / Chat available), an **Open Near-Circle** button, and a visibility toggle.
2. **Radar** — The user appears at the center, with tappable friend dots around them. Phase 1 provides the preview layout; live PostGIS-based positioning arrives in Phase 2.
3. **Friend selected** — A friend information panel displays identity, simulated visibility/consent state, and **View walking route**. Real authorization enforcement will be implemented in later phases.
4. **Route + steps** — A screen reserved for pedestrian directions, ETA, and estimated step count. Real OSRM pedestrian routing and step calculations arrive in Phase 3; the Phase 1 screen clearly identifies placeholder data.

### Intended feature behavior

When implemented, Nearby discovery should return only eligible, opted-in friends within the chosen radius. Selecting a friend must trigger a fresh permission check before revealing an authorized walking route. Neither simulated locations nor demo friend records should be represented as data retrieved from Facebook.

## Project structure

```text
apps/web/          # React + Vite + TS prototype UI (mock data in src/mockData.ts)
apps/api/          # Fastify API: GET /health, GET /demo/friends
db/init/           # PostGIS extension + foundation schema
routing/           # OSRM service boundary: README + data/ for the Phase 3 graph
scripts/           # startall.ps1 / stopall.ps1 / status.ps1 (+ common.ps1)
docker-compose.yml # Four project-owned services
```

## Environment

See [`.env.example`](./.env.example). Ports, credentials, routing endpoints, and map-tile URLs are configurable. `startall` and `status` must not print secrets.

## Troubleshooting

- **Docker missing:** `startall` reports an actionable error; use `npm run dev:api` and `npm run dev:web` for native web/API development.
- **Port conflict:** Configure `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, or `ROUTING_WALK_PORT` in `.env`.
- **Router shows `not-ready`:** Expected in Phase 1. The service sits behind the `routing` Compose profile and starts only after the Phase 3 graph bootstrap prepares `routing/data/near-circle.osrm`. Core `up` never pulls the OSRM image. See [`routing/README.md`](./routing/README.md).
- **npm `EPERM` on cache (locked-down profiles):** Run `$env:npm_config_cache = "$PWD\.npm-cache"; npm install`.
- **Tile outage:** Map tiles are provided externally. `status` may report their availability as `unknown`, and the app must not misrepresent unavailable route functionality as working.

## Development phases

| Phase | Scope | Current status |
|---|---|---|
| **1 — Foundation** | Mock Messenger UI, API skeleton, PostGIS infrastructure, OSRM service boundary, unified launcher | In progress / verify against tests |
| **2 — Proximity discovery** | Real PostGIS radius queries, friend eligibility, and radar positioning | Planned |
| **3 — Walking routes** | Dedicated pedestrian OSRM graph, street-map overlay, ETA, and step estimation | Planned |
| **4 — API validation** | Strict schemas, permission enforcement, location freshness, security and lifecycle tests | Planned |
| **5 — Meta AI** | Real Meta Model API-powered meetup assistance | Planned |
| **6 — Submission** | Optional approved Facebook Login integration, demo evidence, public repository, and provenance | Planned |

## Hackathon demonstration and future integration

The objective is to **demonstrate a feature concept for the Facebook ecosystem**, not to launch a competing messaging service. The prototype intentionally uses simulated Facebook-like identities and relationships so the proposed experience can be evaluated without requiring live Facebook account or friend-list access.

The project must clearly distinguish **working backend functionality** from **simulated UI/social data**, attribute OpenStreetMap data appropriately, and document which work was created during the hackathon. Integration into an actual Facebook or Messenger product would require Meta's participation and any applicable technical and platform approvals.
