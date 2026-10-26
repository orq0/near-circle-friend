# Near-Circle

**Meta Global AI Hackathon — Standalone Development Plan**  
**October 2026**

A Messenger-style prototype that turns opt-in friend proximity into an interactive radar — then a road route, walking ETA, and estimated step count.

**Concept:** Mock Messenger UI → Real Geospatial Engine → Meta AI Demo

---

## 01 / System Architecture

```text
                  NEAR-CIRCLE WEB APPLICATION
  React / Vite | Messenger-style demo | Radar | Leaflet / MapLibre
                                   |
                                   v
                             NEAR-CIRCLE API
     Fastify / TypeScript | Session | Consent | Visibility | Routing
                                   |
              +--------------------+------------------+
              |                    |                  |
              v                    v                  v
      POSTGRES + POSTGIS    WALKING ROUTING ADAPTER    META MODEL API
      Friends / locations    OSRM foot-profile     Meetup suggestions
      radius / bearing       road distance / ETA
                                   |
                                   v
                       ISOLATED WALKING OSRM GRAPH
                       Dedicated pedestrian OSRM
                       graph + isolated service

          MAP TILES (separate from routing): OSM-compatible
          tile provider -> browser map renderer + attribution
```

**Design choice:** Implement Near-Circle as a new, standalone application with its own source repository, web frontend, API, PostgreSQL/PostGIS database, and pedestrian routing service. The Messenger-style interface and friend relationships are simulated for judging; spatial queries, permissions, and selected walking routes are implemented for real. Every required service must be reproducible from the Near-Circle repository and deployment instructions.

**Map tiles are separate from routing:** The OSRM Route API returns route geometry and distance, but it is **not** the normal street-basemap tile provider. Render basemap tiles through a configurable provider, and overlay authorized route geometry and demo markers in the client.

### Explicit service topology

```text
Near-Circle (standalone repository and deployment)
|
+-- Frontend service: React / Vite
|   +-- Messenger-style UI, radar, and map renderer
|
+-- Backend service: Fastify / TypeScript
|   +-- Consent, authentication, geospatial API, and routing adapter
|
+-- Database service: PostgreSQL + PostGIS
|   +-- Friend relationships, permitted locations, and spatial queries
|
+-- Geospatial infrastructure
    +-- Walking routing service: OSRM (independent HTTP API)
    |   +-- Dedicated pedestrian graph prepared with a foot profile
    |
    +-- OSM-compatible map tile provider (configurable external service)
        +-- Street basemap loaded by the browser; no local tile server required for MVP
```

**Deployment boundary:** The frontend, API, database, and walking router are **four separately managed local services/containers** under the project's Docker Compose configuration. The tile provider is a **fifth logical dependency**, but initially an external HTTP service, not a fifth local container. All four local services may share one development PC while remaining independently deployable later.

**Routing independence:** The OSRM walking server exposes its own documented, versioned HTTP routing interface and has its own graph artifacts, configuration, health check, and lifecycle. It must be operable and testable without launching the Near-Circle frontend or API. The application talks to OSRM through a configurable `WalkingRoutingProvider` adapter, never through a direct frontend-to-OSRM dependency.

## 02 / What the MVP Delivers

- **Opt-in radar discovery:** User at center; enabled and eligible nearby friends appear as clickable red dots.
- **Route on selection:** Choose a dot and show a walking route, distance, time, and estimated steps.
- **Street-map context:** Show the selected pedestrian route over an OSM-compatible basemap, with attribution, without exposing unrelated friends' exact coordinates.
- **Judges can verify the logic:** PostGIS geospatial queries and OSRM route data power the experience; fake social records are labeled.

## 03 / Demo Experience

### Four-screen user journey

A clearly labeled Messenger-inspired concept interface, **not an official Facebook or Messenger feature**.

| Screen | What the judge sees | Action |
|---|---|---|
| **01 / Messenger-style inbox** | Mock conversations with Coleen (Online), Alex (Last seen recently), and Sam (Chat available); an **Open Near-Circle** button | Click **Open Near-Circle** |
| **02 / Radar** | The current user at center (`YOU`) and eligible friends represented as red dots | Tap a red friend dot |
| **03 / Friend selected** | Coleen; Near-Circle enabled; nearby in the chosen discovery radius. Precise routing destination is available only with the applicable consent | Choose **View walking route** |
| **04 / Route + step estimate** | Illustrated values: **900 m**, **~12 min walk**, **~1,200 steps** | Review walking directions |

*Illustrative screen values only; actual route results come from the walking router.*

**Radar behavior:** The current user stays in the center. Only opted-in, permitted friends within the configured search radius appear as red dots. Dots are positioned from relative coordinates, not random screen placements.

## 04 / Real Engine, Mock Social Layer

### What is real and what is simulated

The demo should validate the actual spatial and routing work without depending on Facebook platform approval.

| Implement for real | Simulate for the demo |
|---|---|
| **PostGIS:** Indexed `ST_DWithin` radius queries | **Messenger shell:** Unofficial UI, clearly labeled |
| **Consent enforcement:** Visibility and discovery filtering | **Friend accounts:** Seed users and sample conversations |
| **OSRM walking route:** Dedicated pedestrian graph; authorized road geometry, distance, duration | **Friend graph:** App-defined sample connections |
| **Map visualization:** Leaflet/MapLibre with configurable OSM-compatible tiles and visible attribution | **Locations:** Clearly labeled simulated GPS positions |
| **Step estimate:** Distance divided by configurable stride | **Map camera:** Preset demo viewport, if desired |
| **Meta Model API:** One real AI-assisted meetup feature | **Chat/notifications:** Demonstration actions, no real sending |

### Core location and route logic

1. **SEARCH** — `ST_DWithin` on geography points.
2. **FILTER** — Opt-in, friends, freshness, visibility.
3. **RADAR** — Bearing + distance → red-dot position.
4. **ROUTE** — Walking profile returns street path.
5. **STEPS** — `round(distance_m / stride_m)`.

> **Walking-route requirement:** A car-profile OSRM graph is **not** a pedestrian router. Prepare a new graph using OSRM's pedestrian `foot.lua` profile and suitably licensed OpenStreetMap data, or choose another walking-capable routing engine. OSRM's routing profile is determined when preparing its graph, not by changing the `/route/v1/` URL. Validate routes on known pedestrian paths before presenting walking ETAs.

### 04A / Standalone mapping and walking-routing integration

**Goal:** Build a project-owned mapping and pedestrian-routing integration. Keep map visualization, proximity discovery, and route calculation independently configurable and testable.

| Component | Responsibility | Boundary |
|---|---|---|
| `near-circle-web` | Messenger-style prototype, radar, street map and selected route | Browser gets only visibility-authorized results |
| `near-circle-api` | Auth/demo identity, consent, nearby friends, routing authorization and AI requests | Sole backend gateway; never trust client-submitted friend coordinates |
| `near-circle-db` | Own PostgreSQL/PostGIS schema, sample friend graph and scoped location data | Project-owned database and credentials |
| `near-circle-routing-walk` | Independent OSRM instance with an extracted pedestrian (`foot.lua`) graph | New pedestrian graph artifact managed exclusively by this project |
| Configurable tile service | Supplies street-map imagery to Leaflet or MapLibre | Tile usage/attribution rules apply; no assumption that OSRM hosts basemap tiles |
| Meta Model API | One verifiable AI-assisted meetup feature | Send minimal, consented context; keep credentials server-side |

**Recommended deployment:** Provide a project-local `docker compose` stack containing **four distinct services**: frontend, API, PostGIS database, and dedicated pedestrian OSRM router. Create and store the graph under a Near-Circle-owned data directory, with documented OSM download, extraction, partitioning/customization, and startup steps. Persist database files and OSRM graph artifacts across ordinary restarts. The published demo must start without depending on any unrelated local services. The walking router must also support **standalone start, stop, status, and direct API tests**.

**Routing flow**

1. User chooses a visible, opted-in friend from the PostGIS-powered radar.
2. API rechecks friend relationship, consent, radius, and location freshness **when the route is requested**.
3. API calls `WalkingRoutingProvider.route(from, to)` against the configured OSRM pedestrian service.
4. Adapter validates OSRM responses, confirms walking profile/graph readiness, and normalizes to `{ geometry, distance_m, duration_s }`.
5. API computes `estimated_steps = round(distance_m / stride_m)` (default stride `0.75 m`) and returns route + estimate to the authorized requester.
6. Web client overlays geometry on basemap tiles and labels the time/steps as estimates. Failed routes display an honest unavailable state, not a straight-line route labeled walking.

**API-facing adapter (illustrative TypeScript)**

```ts
interface WalkingRoutingProvider {
  route(args: {
    from: { lat: number; lon: number };
    to: { lat: number; lon: number };
  }): Promise<{
    geometry: GeoJSON.LineString;
    distance_m: number;
    duration_s: number;
  }>;
}
```

**Illustrative environment variables** (no secrets in the client):

```dotenv
ROUTING_PROVIDER=osrm
ROUTING_WALK_URL=http://near-circle-routing-walk:5000
MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
MAP_TILE_ATTRIBUTION=© OpenStreetMap contributors
DEFAULT_STRIDE_M=0.75
```

The URL above resolves inside the **Near-Circle Docker network**. It does not require publishing the routing port to the host. If host access is needed for development, select a configurable, nonconflicting host port.

**Map usage:** For a small interactive demo, standard OpenStreetMap raster tiles may be suitable if the official tile policy is respected: visible attribution, normal browser caching and identification, and **no bulk/offline prefetch**. For reliable offline or high-volume use, choose a provider that explicitly supports it or self-host tiles. OSM data attribution is required even when routing is self-hosted.

**Privacy and test gates**

- Disabled/unapproved friends must never appear in the radar or route API, including with manually forged requests.
- Revoke consent between radar discovery and route selection: the second request must be denied.
- Validate stale locations, out-of-bounds coordinates, OSRM timeout and no-route cases.
- Ensure walking routes actually use a foot graph; compare known pedestrian-only paths where OSM coverage supports them.
- Keep seed identities/coordinates conspicuously labeled as simulation; no Facebook friend/location data is fetched.
- Do not send exact friend coordinates to the Meta Model API unless truly necessary, consented, and justified.

**Hackathon provenance:** Develop and version Near-Circle in its own repository. Identify work completed **during** the hackathon, document third-party dependencies and licensed data sources, and disclose any pre-event work if applicable. Publish the required code and provide OpenStreetMap attribution.

### 04B / Unified local development launcher and service management

**Goal:** One command launches the complete local stack, while each service remains independently operable. The implementation must work from **PowerShell 7 on Windows 11 with Docker Desktop**, using scripts committed to the Near-Circle repository.

**Required project-root commands**

| Command | Required behavior |
|---|---|
| `npm run startall` | Start all four local services (frontend, API, PostgreSQL/PostGIS, walking OSRM); wait for readiness, then print working application/API URLs and service status. |
| `npm run stopall` | Gracefully stop the project services only; do **not** delete database volumes, graph files, or other persistent state. |
| `npm run status` | Display container state and health for each of the four local services and run non-destructive endpoint/readiness checks; distinguish unhealthy, unreachable, and not-started services. |

**Implementation requirements**

1. Define scripts in the root `package.json`, backed by documented project-owned scripts (PowerShell 7 scripts are acceptable) that delegate container lifecycle operations to the checked-in Docker Compose file. Scripts must be repeatable and safe to rerun.
2. Check required tooling (Docker Desktop/engine, Docker Compose, Node.js/npm where needed), configuration, the PostGIS database, and prepared pedestrian routing graph. Report precise, actionable errors if a prerequisite is missing; do not silently start against a car graph.
3. On startup, honor service dependencies and **actual readiness**, not fixed sleep timers. Confirm the database accepts connections, API health endpoint responds, routing API/foot graph can serve a known walking test route, and web frontend is reachable. Display a clear success/failure summary.
4. The OSM-compatible **tile provider is externally hosted by default**. Do not pretend that `startall` starts that provider. Show its configured URL and, where practical, verify that the map can retrieve tiles. If an optional self-hosted tile service is added later, document and manage it separately or explicitly extend the launcher.
5. Keep ports, routes, credentials, and tile/routing URLs configurable via project-local environment variables; avoid host port conflicts and bind internal-only services to the project Docker network by default. Never print secrets in launch logs.
6. First-time OSM download/graph extraction/preparation is a **separate, explicit bootstrap task**, with clear progress and documentation. `startall` reuses an already prepared, persisted pedestrian graph and **must not** redownload data or preprocess routing on every launch.
7. Preserve **independent service control** via documented `docker compose up/down` commands or dedicated helper scripts. In particular, developers can start, inspect, and test OSRM alone as a standalone routing API. The unified launcher is a convenience wrapper, not a monolithic application server.
8. Supply an `.env.example`, README setup steps, non-destructive troubleshooting diagnostics, and logs access. An unavailable Meta Model API key should be reported and disable only the AI enhancement, **not** prevent core radar/routing demonstration.

**Acceptance tests**

- Fresh-clone setup + documented bootstrap followed by `npm run startall` brings up the four healthy local services on Windows 11 / PowerShell 7 / Docker Desktop.
- Running `npm run startall` twice does not recreate data or fail because services are already running.
- `npm run status` correctly identifies a deliberately stopped or unhealthy container.
- `npm run stopall` stops only Near-Circle services and preserves seeded data and pedestrian routing files; restarting restores them.
- OSRM can be started on its own, accepts direct HTTP routing requests, and returns a verified pedestrian path while the API/frontend are stopped.
- The map loads from the configured external tile provider when online; tile outage is handled without misrepresenting routes as working.

## 05 / Implementation Roadmap

### Demo-first development phases

Deliver a functioning experience early, then connect the real geospatial engine and Meta capabilities.

### Phase 1 — Mock messaging shell + sample data

**Build:** React/Vite inbox, 3–5 seeded friends, activation toggle, clear prototype labeling. Scaffold the four-service Docker Compose setup and root `startall` / `stopall` / `status` scripts so the demo has a single launch workflow from the beginning.

**Acceptance:** Working entry point and fake conversations; initial unified launcher and status reporting operate for the services built so far, with clear messages for components not yet implemented.

### Phase 2 — Radar + consented proximity

**Build:** PostGIS locations and eligibility; radar rings, red dots, radius selector, friend click.

**Acceptance:** Opted-in friend appears; hidden friend does not.

### Phase 3 — Road routing + walking steps

**Build:** New walking-routing provider interface, dedicated OSRM `foot.lua` graph/container, configurable OSM-compatible basemap display, pedestrian route geometry/distance/ETA, and stride estimator. Include reproducible map-data preparation, isolated OSRM API validation, and launcher integration with graph readiness checks.

**Acceptance:** Selectable dot yields a real **walking** route over a street map with distance, estimated ETA and steps; a no-route response fails safely.

### Phase 4 — Near-Circle API + validation

**Build:** Fastify endpoints, strict schemas, access controls, location freshness, route authorization, service health endpoints, and automated launcher/lifecycle checks.

**Acceptance:** Automated API and permission tests.

### Phase 5 — Meta AI enhancement

**Build:** Call Meta Model API for opted-in meetup suggestions or a concise route-based summary.

**Acceptance:** Judges see a genuine model-backed feature.

### Phase 6 — Optional Facebook Login + submission

**Build:** Integrate approved login if available; keep simulation fallback, publish code and demo evidence.

**Acceptance:** Reliable submission with documented new work.

**Priority order:** Showcase 1 user → radar → one friend → route → steps. Facebook production approval must not block the demo.

## 06 / Application & API

### Proposed demo API contract

All friend identities and coordinates may be seeded, but the backend must enforce opt-in and visibility for every result.

| Route | Action / Response |
|---|---|
| `GET /demo/friends` | Return clearly labeled mock friends; no Meta Graph API claim. |
| `PUT /near-circle/visibility` | Enable/disable discovery and set friend visibility. |
| `PUT /location` | Update simulated or permissioned user location. |
| `GET /friends/nearby?radius_m=...` | Eligible nearby opted-in users; distance and bearing. |
| `GET /friends/:id/route` | Consent-rechecked route using pedestrian OSRM; normalized GeoJSON walking geometry, `distance_m`, `duration_s`. |
| `GET /friends/:id/steps` | Estimated steps based on route distance + stride setting. |
| `POST /circles/invite` | App-side invitations / mock relationships for the demo. |
| `POST /ai/meetup-suggestion` | Call Meta Model API with permissioned, minimal context. |
| `POST /auth/facebook` **(optional)** | Approved login flow; not a prerequisite for the mock demo. |

### Data model sketch

```text
users (
  id, display_name, demo_flag
)

relationships (
  user_id, friend_id, status
)

locations (
  user_id, geography_point, updated_at, expires_at
)

visibility (
  user_id, enabled, radius_m, allowed_friends
)

stride_settings (
  user_id, stride_m
)
```

## 07 / Demo & Submission

### Judge-ready presentation

Show a complete experience while explicitly separating the simulated interface from working backend capabilities.

### Live demo script

| Time | Step | What to show |
|---|---|---|
| **00:00** | Open prototype | State that this is an unofficial, Messenger-style concept UI. |
| **00:15** | Toggle discovery | Enable Near-Circle; use seeded opted-in friends and radius slider. |
| **00:35** | Launch radar | User appears at center. Eligible friends display as red dots. |
| **00:55** | Select a friend | Click one dot; show identity, consent status, and approximate proximity. |
| **01:15** | View walking route | Render walking roads, distance, ETA, and estimated steps. |
| **01:45** | Ask Meta AI | Show a genuine Meta Model API meetup suggestion or route summary. |
| **02:10** | Prove new work | Point to Git commits, README, and a real API / data flow. |

### Definition of done

- [ ] Disabled or unapproved friends never appear as dots.
- [ ] Radar dot placement reflects real geospatial distance + bearing.
- [ ] Selecting a dot produces an authorized, walking-capable road route using a dedicated foot-profile graph.
- [ ] The route overlays a real street basemap with visible OSM attribution; routing and tiles are independently configurable.
- [ ] The frontend, Fastify API, PostGIS database, and pedestrian OSRM router are four distinct, independently manageable local services.
- [ ] The tile provider is separately configurable and external by default, with no unnecessary local tile container.
- [ ] The pedestrian OSRM service has its own API, persisted foot graph, health checks, and can be exercised without the Near-Circle UI or API.
- [ ] `npm run startall` starts and health-checks all four services; `npm run status` reports their state; `npm run stopall` stops only this project's services without deleting persistent data.
- [ ] First-time pedestrian graph preparation is explicit and reproducible; regular startup reuses the existing graph.
- [ ] Near-Circle starts from its own repository and configuration, with no dependency on unrelated running local services.
- [ ] Steps are labeled estimates: `steps = route_m / stride_m` (default `0.75 m`).
- [ ] One Meta AI feature is genuinely model-backed; failures degrade safely.
- [ ] Public submission identifies hackathon-built code and pre-existing tooling.

**Compliance:** The mock is **not Facebook Messenger**. Use only authorized assets/data, provide OSM attribution where applicable, obey the chosen tile provider's usage policy, and disclose any pre-event work.

**Technical references:** [OSRM profiles](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/profiles.md), [OSRM foot profile](https://github.com/Project-OSRM/osrm-backend/blob/master/profiles/foot.lua), [OSM standard tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

---

*Near-Circle / Meta Global AI Hackathon / October 2026*
