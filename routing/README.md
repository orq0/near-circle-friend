# Near-Circle walking router — service boundary (Phase 1 scaffold)

The walking router is an **independent OSRM service** with its own HTTP API,
graph artifacts, and lifecycle. In Phase 1 it is **scaffolded, not functional**:
no pedestrian graph has been prepared, so `npm run status` reports it as
`not-ready` and `npm run startall` says so explicitly. That is intentional —
a car-profile graph (or no graph) must never be presented as walking routing.

## Contract

- Service name: `near-circle-routing-walk` (see `docker-compose.yml`).
- In-Compose URL: `http://near-circle-routing-walk:5000` (`ROUTING_WALK_URL`).
- Host URL for direct tests: `http://localhost:5001` (`ROUTING_WALK_HOST_URL`).
- Graph artifact: `routing/data/near-circle.osrm` (+ sidecar files).
- Readiness signal: the artifact exists **and** a known test route succeeds.
- The API talks to OSRM through a `WalkingRoutingProvider` adapter (Phase 3);
  the browser never calls OSRM directly.

## Phase 3 bootstrap (preview — do not run yet)

Graph preparation is an explicit, one-time bootstrap task, never part of
`startall`. The documented steps will be:

1. Download a suitably licensed OpenStreetMap extract into `routing/data/`.
2. Extract a pedestrian graph: `osrm-extract -p foot.lua near-circle.osm.pbf`.
3. Partition and customize: `osrm-partition` + `osrm-customize`.
4. Start only the router: `docker compose up -d near-circle-routing-walk`.
5. Validate on a known pedestrian-only path before claiming walking ETAs.

## Direct API test (once a graph exists)

```powershell
Invoke-RestMethod 'http://localhost:5001/route/v1/driving/13.388860,52.517037;13.385983,52.496891?overview=false' |
  ConvertTo-Json -Depth 6
```

Expected: a JSON route object with `distance`/`duration`. Any `NoRoute`
response must surface as an honest unavailable state in the UI, never as a
straight line labeled "walking".
