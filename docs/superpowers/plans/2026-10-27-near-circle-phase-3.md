# Near-Circle Phase 3 Implementation Plan

> Implement task-by-task. No escalation, no push, local commits only.

**Goal:** Real pedestrian routing (Metro Manila OSRM foot graph) behind the existing `routing` profile, served through the Fastify API and rendered on an interactive OSM map.

**Architecture:** `WalkingRoutingProvider` adapter (OSRM implementation) keeps the browser off the router. Graph artifact stays `routing/data/near-circle.osrm` so the Phase 1 profile gating works unchanged. Host port moves 5001 -> 5002 (5001 occupied by an unknown third-party OSRM; verified by probe).

**Tech Stack:** Existing + `leaflet`/`@types/leaflet` (web only); `ghcr.io/project-osrm/osrm-backend:v5.27.1` + BBBike Manila PBF for the graph (manual bootstrap; Docker unavailable in sandbox).

## Global Constraints

- Never touch Navegar/mapa/Tara graphs or the 5001 instance (conflict probes only).
- Never claim routing works until a real Manila route calculates (bootstrap runs on user machine).
- Vitest/vite binaries blocked in sandbox: verify via tsc + node runner on compiled tests (established Phase 2 harness, rebuilt as scratch).
- `prompt-3.txt` (when present) stays untracked; commit named files only.

## API Contracts

- `GET /friends/:id/route?radius_m=&stride_m=` -> `{demo, route:{to, geometry: LineString[lon,lat], route_distance_m, straight_line_m, duration_s, estimated_steps, stride_m}}`.
- Status: 400 validation; 403 requester off / target unavailable / revoked / outside radius; 404 unknown/non-friend or provider NoRoute; 409 requester unlocated; 503 provider unreachable; 504 provider timeout; 502 malformed provider response.
- Provider: `route()` builds `/route/v1/driving/...?overview=full&geometries=geojson`, validates `code==='Ok'` + LineString, maps failures. URL profile name is legacy; graph profile governs (documented).
- Steps: `Math.round(distance_m / stride_m)`, stride default from `DEFAULT_STRIDE_M` (0.75).

## File Map

- `apps/api/src/routing/{types,osrmProvider,steps}.ts`, `services/proximity.ts` (+getFriendRoute), `routes/route.ts`, `app.ts` (+routing opt), `package.json` (no new deps).
- `apps/web`: `radar.ts` (+formatDuration), `api.ts` (+fetchRoute), `components/RouteMap.tsx` (Leaflet, circleMarkers, OSM tiles + attribution), `components/RouteScreen.tsx` (states/stats/straight-vs-route), `App.tsx` wiring, `App.css`, `main.tsx` (leaflet CSS), tests.
- `routing/prepare-graph.ps1` (pull, assert foot.lua in image, download BBBike Manila PBF, extract/partition/customize, smoke test with foot-speed sanity ratio), `routing/README.md` rewrite, `docker-compose.yml` + `.env.example` port 5002, `scripts/{startall,status}.ps1` Manila probe coords, main README Phase 3 section.

## Verification (no escalation)

1. tsc, API build, node-runner: all unit + integration + web suites.
2. Provider/route/steps covered by fake-fetch/fake-db tests; live Manila route left to user bootstrap (exact commands provided).
3. Port evidence, ps1 parse checks, seed/DB untouched (no new seed needed).
4. Commit named files locally; report routing as implemented-but-unverified-live.
