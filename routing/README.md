# Near-Circle walking router — service boundary (Phase 3)

The walking router is an **independent OSRM service** with its own HTTP API,
graph artifacts, and lifecycle. The browser never calls it directly: the
Fastify API queries it through a `WalkingRoutingProvider` adapter and serves
validated route geometry to the UI.

## Contract

- Service name: `near-circle-routing-walk` (see `docker-compose.yml`).
- Image: `ghcr.io/project-osrm/osrm-backend:v5.27.1` (the Docker Hub path does
  not exist for this version).
- In-Compose URL: `http://near-circle-routing-walk:5000` (`ROUTING_WALK_URL`).
- Host URL: `http://localhost:5002` (`ROUTING_WALK_HOST_URL`). Port 5001 is
  deliberately avoided: it is commonly occupied by unrelated OSRM instances.
- Graph artifacts: `routing/data/near-circle.osrm` plus sidecars (gitignored).
- Readiness signal: the artifacts exist **and** a known Manila test route
  succeeds with walking-plausible speed.
- Profile gating: the service sits behind the `routing` Compose profile.
  Plain `up` skips it; `startall` enables the profile automatically once the
  graph artifacts exist.

## Data source and license

- Extract: Metro Manila PBF from BBBike (`https://download.bbbike.org/osm/bbbike/Manila/Manila.osm.pbf`).
- Origin: © OpenStreetMap contributors, available under the ODbL.
- Attribution is rendered on every map (`© OpenStreetMap contributors`).
- Fallback if BBBike is unreachable: Geofabrik Philippines extract clipped to
  Metro Manila with osmium-tool, then run the same pipeline below.

## One-time bootstrap

Requires Docker with ~2 GB free for working files (PBF plus graph sidecars;
check with `Get-ChildItem routing/data | Measure-Object Length -Sum`).

```powershell
# From the repository root:
pwsh -NoProfile -ExecutionPolicy Bypass -File ./routing/prepare-graph.ps1
```

The script:

1. Pulls the OSRM image and asserts it ships `/opt/foot.lua`.
2. Downloads the Manila PBF into `routing/data/` (skipped when a plausible
   file already exists; `-Force` re-downloads) and sanity-checks it.
3. Runs `osrm-extract -p /opt/foot.lua`, `osrm-partition`, `osrm-customize`
   (MLD pipeline matching `osrm-routed --algorithm mld`).
4. Smoke-tests with an ephemeral container on port 5002 (fails fast when the
   port is busy) over the demo pair Rizal Park → Coleen, and rejects
   car-plausible speeds so a wrong-profile graph cannot pass silently.
5. Removes its smoke container; only project containers are ever touched.

Then:

```powershell
npm run startall   # routing profile now enables automatically
npm run status     # expect near-circle-routing-walk: healthy
```

## Direct API test (once a graph exists)

```powershell
Invoke-RestMethod 'http://localhost:5002/route/v1/driving/120.9750,14.5810;120.9768,14.5828?overview=false'
```

Expected: a JSON route object with `code: Ok`, `distance`, and `duration`.
The `driving` path segment is OSRM's legacy service name; the effective
profile comes from the prepared foot graph, not the URL.

Any `NoRoute` response surfaces as an honest unavailable state in the UI,
never as a straight line labeled "walking".
