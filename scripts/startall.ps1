# Near-Circle unified launcher: start implemented services and wait for real readiness.
# Usage: npm run startall   (from the repository root)
. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
$nc = Read-NearCircleEnv -RepoRoot $repoRoot
$composeFile = Join-Path $repoRoot 'docker-compose.yml'

Write-Host ''
Write-Host 'Near-Circle startall' -ForegroundColor Cyan
Write-Host ("Root: {0}" -f $repoRoot) -ForegroundColor DarkGray

if (-not (Test-DockerAvailable)) {
    Write-Host ''
    Write-Host 'ERROR: Docker is not installed or not on PATH.' -ForegroundColor Red
    Write-Host 'Install Docker Desktop, then re-run: npm run startall' -ForegroundColor Yellow
    Write-Host 'Native development fallback (no containers):' -ForegroundColor Yellow
    Write-Host ("  npm run dev:api    # Fastify API on http://localhost:{0}" -f $nc['API_PORT'])
    Write-Host ("  npm run dev:web    # Vite web on http://localhost:{0}" -f $nc['WEB_PORT'])
    exit 1
}
if (-not (Test-ComposeAvailable)) {
    Write-Host ''
    Write-Host 'ERROR: "docker compose" is unavailable. Update Docker Desktop.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Starting Near-Circle services (docker compose up -d)...' -ForegroundColor Cyan
& docker compose -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERROR: docker compose up failed. See output above.' -ForegroundColor Red
    exit 1
}

# ---- Readiness: database accepts connections ----
Write-Host ''
Write-Host 'Waiting for readiness (polling, no fixed delays)...' -ForegroundColor Cyan
$dbOk = $false
$dbDeadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $dbDeadline) {
    & docker compose -f $composeFile exec -T near-circle-db pg_isready -U $nc['POSTGRES_USER'] -d $nc['POSTGRES_DB'] 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $dbOk = $true; break }
    Start-Sleep -Seconds 2
}
if ($dbOk) {
    Write-NcStatus 'near-circle-db' 'healthy' ("postgres on localhost:{0}" -f $nc['POSTGRES_PORT'])
} else {
    Write-NcStatus 'near-circle-db' 'unhealthy' 'pg_isready never succeeded (90s)'
}

# ---- Readiness: API health endpoint ----
$apiUrl = "http://localhost:$($nc['API_PORT'])/health"
if (Wait-HttpOk -Url $apiUrl -TimeoutSec 90) {
    Write-NcStatus 'near-circle-api' 'healthy' $apiUrl
    $apiOk = $true
} else {
    Write-NcStatus 'near-circle-api' 'unhealthy' ("no response at {0} (90s)" -f $apiUrl)
    $apiOk = $false
}

# ---- Readiness: web frontend reachable ----
$webUrl = "http://localhost:$($nc['WEB_PORT'])/"
if (Wait-HttpOk -Url $webUrl -TimeoutSec 120) {
    Write-NcStatus 'near-circle-web' 'healthy' $webUrl
    $webOk = $true
} else {
    Write-NcStatus 'near-circle-web' 'unhealthy' ("no response at {0} (120s)" -f $webUrl)
    $webOk = $false
}

# ---- Routing: scaffolded in Phase 1; honest not-ready until a foot graph exists ----
$graphFile = Join-Path $repoRoot 'routing/data/near-circle.osrm'
if (-not (Test-Path $graphFile)) {
    Write-NcStatus 'near-circle-routing-walk' 'not-ready' 'no pedestrian graph yet (Phase 3 bootstrap; see routing/README.md)'
} else {
    $routeProbe = "$($nc['ROUTING_WALK_HOST_URL'])/route/v1/driving/13.388860,52.517037;13.385983,52.496891?overview=false"
    if (Wait-HttpOk -Url $routeProbe -TimeoutSec 60) {
        Write-NcStatus 'near-circle-routing-walk' 'healthy' $nc['ROUTING_WALK_HOST_URL']
    } else {
        Write-NcStatus 'near-circle-routing-walk' 'unhealthy' 'graph present but test route failed (60s)'
    }
}

# ---- Summary ----
Write-Host ''
Write-Host 'Accessible URLs:' -ForegroundColor Cyan
Write-Host ("  Web app:      http://localhost:{0}/" -f $nc['WEB_PORT'])
Write-Host ("  API health:   http://localhost:{0}/health" -f $nc['API_PORT'])
Write-Host ("  API demo:     http://localhost:{0}/demo/friends" -f $nc['API_PORT'])
Write-Host ("  PostgreSQL:   localhost:{0} (db {1}, user {2}; password never printed)" -f $nc['POSTGRES_PORT'], $nc['POSTGRES_DB'], $nc['POSTGRES_USER'])
Write-Host ("  Map tiles:    {0}  (external; not started by startall)" -f $nc['MAP_TILE_URL'])
Write-Host ''

if ($dbOk -and $apiOk -and $webOk) {
    Write-Host 'startall complete: core services are healthy.' -ForegroundColor Green
    exit 0
} else {
    Write-Host 'startall incomplete: one or more core services failed readiness. Run: npm run status' -ForegroundColor Red
    exit 1
}
