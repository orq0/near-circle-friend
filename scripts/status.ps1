# Near-Circle: report service health without changing anything (read-only checks).
# Usage: npm run status   (from the repository root)
. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
. (Join-Path $repoRoot 'routing/prepare-graph-lib.ps1')
$nc = Read-NearCircleEnv -RepoRoot $repoRoot
$composeFile = Join-Path $repoRoot 'docker-compose.yml'

Write-Host ''
Write-Host 'Near-Circle status' -ForegroundColor Cyan

# ---- Container state (needs Docker; endpoint checks below do not) ----
$containerState = @{}
$dockerNote = ''
if (-not (Test-ComposeAvailable)) {
    $dockerNote = 'docker unavailable'
} else {
    try {
        # Include the `routing` profile so a prepared router (Phase 3) shows up;
        # harmless while the profile is inactive.
        $raw = & docker compose -f $composeFile --profile routing ps --format json 2>$null
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            $list = @($raw | ConvertFrom-Json)
            foreach ($c in $list) {
                if ($null -ne $c.Service) { $containerState[$c.Service] = [string]$c.State }
            }
        }
    } catch {
        $dockerNote = 'compose ps failed'
    }
}

function Get-ContainerNote([string]$service) {
    if ($containerState.ContainsKey($service)) { return "container $($containerState[$service])" }
    if ($dockerNote -ne '') { return $dockerNote }
    return 'container not-started'
}

# ---- Database: TCP reachability ----
$dbNote = Get-ContainerNote 'near-circle-db'
if (Test-TcpPort -HostName 'localhost' -Port ([int]$nc['POSTGRES_PORT'])) {
    Write-NcStatus 'near-circle-db' 'reachable' ("localhost:{0}; {1}" -f $nc['POSTGRES_PORT'], $dbNote)
} else {
    $state = if ($containerState.ContainsKey('near-circle-db') -and $containerState['near-circle-db'] -eq 'running') { 'unhealthy' } else { 'stopped' }
    Write-NcStatus 'near-circle-db' $state ("localhost:{0} closed; {1}" -f $nc['POSTGRES_PORT'], $dbNote)
}

# ---- API: health endpoint ----
$apiUrl = "http://localhost:$($nc['API_PORT'])/health"
$apiNote = Get-ContainerNote 'near-circle-api'
if (Test-HttpOk -Url $apiUrl) {
    Write-NcStatus 'near-circle-api' 'healthy' ("{0}; {1}" -f $apiUrl, $apiNote)
} else {
    $state = if ($containerState.ContainsKey('near-circle-api') -and $containerState['near-circle-api'] -eq 'running') { 'unhealthy' } else { 'stopped' }
    Write-NcStatus 'near-circle-api' $state ("{0} unreachable; {1}" -f $apiUrl, $apiNote)
}

# ---- Web: frontend reachable ----
$webUrl = "http://localhost:$($nc['WEB_PORT'])/"
$webNote = Get-ContainerNote 'near-circle-web'
if (Test-HttpOk -Url $webUrl) {
    Write-NcStatus 'near-circle-web' 'healthy' ("{0}; {1}" -f $webUrl, $webNote)
} else {
    $state = if ($containerState.ContainsKey('near-circle-web') -and $containerState['near-circle-web'] -eq 'running') { 'unhealthy' } else { 'stopped' }
    Write-NcStatus 'near-circle-web' $state ("{0} unreachable; {1}" -f $webUrl, $webNote)
}

# ---- Routing: graph artifact first, then direct API test ----
$graph = Test-RoutingGraph -DataDir (Join-Path $repoRoot 'routing/data')
$rtNote = Get-ContainerNote 'near-circle-routing-walk'
if (-not $graph.Ready) {
    Write-NcStatus 'near-circle-routing-walk' 'not-ready' ("no pedestrian graph (Phase 3); {0}" -f $rtNote)
} else {
    $routeProbe = "$($nc['ROUTING_WALK_HOST_URL'])/route/v1/driving/120.9750,14.5810;120.9768,14.5828?overview=false"
    if (Test-HttpOk -Url $routeProbe -TimeoutSec 5) {
        Write-NcStatus 'near-circle-routing-walk' 'healthy' ("{0}; {1}" -f $nc['ROUTING_WALK_HOST_URL'], $rtNote)
    } else {
        Write-NcStatus 'near-circle-routing-walk' 'unhealthy' ("graph present but test route failed; {0}" -f $rtNote)
    }
}

# ---- Map tiles: external dependency, display + best-effort reachability ----
$tileSample = $nc['MAP_TILE_URL'].Replace('{z}', '0').Replace('{x}', '0').Replace('{y}', '0')
if ($tileSample -match '^https?://') {
    if (Test-HttpOk -Url $tileSample -TimeoutSec 5) {
        Write-NcStatus 'map-tiles (external)' 'reachable' $nc['MAP_TILE_URL']
    } else {
        Write-NcStatus 'map-tiles (external)' 'unknown' ("{0} (unreachable or offline)" -f $nc['MAP_TILE_URL'])
    }
} else {
    Write-NcStatus 'map-tiles (external)' 'unknown' $nc['MAP_TILE_URL']
}

Write-Host ''
exit 0
