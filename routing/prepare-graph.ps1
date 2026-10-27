<#
.SYNOPSIS
  Prepare the Near-Circle pedestrian routing graph (Phase 3, one-time bootstrap).

.DESCRIPTION
  Downloads the Metro Manila OpenStreetMap extract, verifies the OSRM image
  ships a foot profile, then runs the MLD pipeline
  (osrm-extract -p foot.lua, osrm-partition, osrm-customize).

  Output: routing/data/near-circle.osrm plus sidecar files. Only after these
  artifacts exist does `npm run startall` enable the `routing` Compose profile.

  The script creates and removes exactly one container of its own
  (near-circle-routing-smoke) for the validation probe. Removal is
  ownership-scoped: a pre-existing container with that name is removed only
  when its labels prove this bootstrap created it; otherwise the script
  refuses to continue. It never touches unrelated containers, volumes, or
  the third-party service on port 5001.

.PARAMETER DataDir
  Graph working directory. Defaults to routing/data/ next to this script.

.PARAMETER PbfUrl
  Metro Manila OSM extract URL. Default is the BBBike Manila PBF.

.PARAMETER Image
  OSRM container image. Default ghcr.io/project-osrm/osrm-backend:v5.27.1.

.PARAMETER SmokePort
  Host port for the temporary validation container. Default 5002. Fails fast
  with an actionable message when the port is already in use.

.PARAMETER Force
  Re-download the PBF even when a plausible file already exists.
#>
param(
  [string]$DataDir = (Join-Path $PSScriptRoot 'data'),
  [string]$PbfUrl = 'https://download.bbbike.org/osm/bbbike/Manila/Manila.osm.pbf',
  [string]$Image = 'ghcr.io/project-osrm/osrm-backend:v5.27.1',
  [int]$SmokePort = 5002,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'prepare-graph-lib.ps1')

function Test-PortOpen([int]$Port) {
  $client = $null
  try {
    $client = New-Object Net.Sockets.TcpClient
    $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    return ($iar.AsyncWaitHandle.WaitOne(1000) -and $client.Connected)
  } catch {
    return $false
  } finally {
    if ($null -ne $client) { $client.Close() }
  }
}

Write-Host ''
Write-Host 'Near-Circle pedestrian graph bootstrap' -ForegroundColor Cyan

if ($null -eq (Get-Command 'docker' -ErrorAction SilentlyContinue)) {
  Write-Host 'ERROR: Docker is not installed or not on PATH.' -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force $DataDir | Out-Null
$dataPath = (Resolve-Path $DataDir).Path
$pbfPath = Join-Path $dataPath 'near-circle.osm.pbf'

# ---- 1. Pull the image and inspect its profiles ----
Write-Host 'Pulling OSRM image...' -ForegroundColor Cyan
& docker pull $Image
if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR: docker pull failed.' -ForegroundColor Red; exit 1 }

Write-Host 'Inspecting profiles shipped in the image...' -ForegroundColor Cyan
$optListing = & docker run --rm $Image ls /opt 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR: cannot list /opt in the image.' -ForegroundColor Red; exit 1 }
$footCount = @($optListing -match 'foot\.lua').Count
if ($footCount -eq 0) {
  Write-Host 'ERROR: no foot.lua profile in the image. Found:' -ForegroundColor Red
  Write-Host ($optListing -join "`n")
  exit 1
}
Write-Host 'Found foot.lua pedestrian profile.' -ForegroundColor Green

# ---- 2. Metro Manila extract: validate before reuse, download only when needed ----
$needDownload = $false
if ($Force.IsPresent) {
  Write-Host 'Force requested: re-downloading the PBF.' -ForegroundColor DarkGray
  $needDownload = $true
} elseif (-not (Test-Path $pbfPath)) {
  $needDownload = $true
} else {
  $existing = Test-PbfHeader -Path $pbfPath
  if ($existing.Valid) {
    $existingMB = [math]::Round((Get-Item $pbfPath).Length / 1MB, 1)
    Write-Host "Reusing existing near-circle.osm.pbf ($existingMB MB; $($existing.Reason))." -ForegroundColor DarkGray
  } else {
    Write-Host "Existing PBF invalid ($($existing.Reason)); re-downloading." -ForegroundColor Yellow
    $needDownload = $true
  }
}
if ($needDownload) {
  Write-Host "Downloading Metro Manila extract..." -ForegroundColor Cyan
  Write-Host "  $PbfUrl" -ForegroundColor DarkGray
  try {
    Invoke-WebRequest -Uri $PbfUrl -OutFile $pbfPath -UseBasicParsing
  } catch {
    Write-Host "ERROR: download failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Check the URL or pass -PbfUrl with a working Metro Manila extract.' -ForegroundColor Yellow
    exit 1
  }
}
if (-not (Test-Path $pbfPath) -or (Get-Item $pbfPath).Length -lt 1MB) {
  Write-Host 'ERROR: PBF is missing or smaller than 1 MB; refusing to continue.' -ForegroundColor Red
  exit 1
}
$verified = Test-PbfHeader -Path $pbfPath
if (-not $verified.Valid) {
  Write-Host "ERROR: PBF failed validation ($($verified.Reason)). It may be an error page." -ForegroundColor Red
  exit 1
}
$pbfMB = [math]::Round((Get-Item $pbfPath).Length / 1MB, 1)
Write-Host "PBF ready: $pbfMB MB ($($verified.Reason))." -ForegroundColor Green

# ---- 3. MLD pipeline: extract (foot) -> partition -> customize ----
foreach ($step in @(
  @('osrm-extract', '-p', '/opt/foot.lua', '/data/near-circle.osm.pbf'),
  @('osrm-partition', '/data/near-circle.osrm'),
  @('osrm-customize', '/data/near-circle.osrm')
)) {
  Write-Host "Running $($step -join ' ')..." -ForegroundColor Cyan
  & docker run --rm "-v${dataPath}:/data" $Image @step
  if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: $($step[0]) failed." -ForegroundColor Red; exit 1 }
}

$osrm = Join-Path $dataPath 'near-circle.osrm'
if (-not (Test-Path $osrm)) {
  Write-Host 'ERROR: expected artifact near-circle.osrm is missing.' -ForegroundColor Red
  exit 1
}
$totalMB = [math]::Round(((Get-ChildItem $dataPath -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "Graph artifacts ready in ${dataPath} ($totalMB MB total)." -ForegroundColor Green

# ---- 4. Smoke test with an ephemeral routed container ----
if (Test-PortOpen $SmokePort) {
  Write-Host "ERROR: port $SmokePort is already in use. Free it or pass -SmokePort." -ForegroundColor Red
  exit 1
}
$smokeName = 'near-circle-routing-smoke'
$runId = [guid]::NewGuid().ToString()

# A stale name is reclaimed only when its labels prove this bootstrap owns it.
$existingId = (& docker ps -a --filter "name=^/${smokeName}$" --format '{{.ID}}' 2>$null | Select-Object -First 1)
if (-not [string]::IsNullOrWhiteSpace($existingId)) {
  $existingId = $existingId.Trim()
  $existingJson = & docker inspect $existingId 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Stale smoke container vanished; continuing.' -ForegroundColor DarkGray
  } elseif (Test-ContainerOwned -InspectJson ($existingJson -join "`n")) {
    Write-Host 'Removing stale smoke container from a previous run.' -ForegroundColor DarkGray
    & docker rm -f $existingId 2>&1 | Out-Null
  } else {
    Write-Host "ERROR: a container named $smokeName already exists and is not managed by this script." -ForegroundColor Red
    Write-Host 'Remove or rename it, then retry. Nothing was deleted.' -ForegroundColor Yellow
    exit 1
  }
}
Write-Host 'Starting ephemeral validation router...' -ForegroundColor Cyan
$smokeId = ''
$started = & docker run -d --name $smokeName --label "${SmokeLabelKey}=${SmokeLabelValue}" --label "near-circle.run-id=$runId" -p "127.0.0.1:${SmokePort}:5000" "-v${dataPath}:/data:ro" $Image osrm-routed --algorithm mld /data/near-circle.osrm 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR: smoke router failed to start.' -ForegroundColor Red; exit 1 }
$firstLine = $started | Select-Object -First 1
$smokeId = if ($null -eq $firstLine) { '' } else { "$firstLine".Trim() }
if ([string]::IsNullOrWhiteSpace($smokeId)) { Write-Host 'ERROR: smoke router failed to start.' -ForegroundColor Red; exit 1 }

try {
  # Demo pair: Rizal Park center -> Coleen fixture. Must route on footpaths.
  $probe = "http://127.0.0.1:${SmokePort}/route/v1/driving/120.9750,14.5810;120.9768,14.5828?overview=false"
  $deadline = (Get-Date).AddSeconds(90)
  $route = $null
  while ((Get-Date) -lt $deadline) {
    try {
      $route = Invoke-RestMethod -Uri $probe -TimeoutSec 5
      if ($null -ne $route -and $route.code -eq 'Ok') { break }
      $route = $null
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  $routeCount = 0
  if ($null -ne $route -and $null -ne $route.routes) { $routeCount = @($route.routes).Count }
  if ($null -eq $route -or $routeCount -eq 0) {
    Write-Host 'ERROR: smoke route never returned Ok (90s).' -ForegroundColor Red
    Write-Host 'The graph may lack connectivity for the probe pair; inspect osrm-extract warnings.' -ForegroundColor Yellow
    exit 1
  }
  $distance = [double]$route.routes[0].distance
  $duration = [double]$route.routes[0].duration
  $speed = if ($duration -gt 0) { $distance / $duration } else { 0 }
  Write-Host ("Smoke route: {0:N1} m in {1:N0} s ({2:N2} m/s)." -f $distance, $duration, $speed) -ForegroundColor DarkGray
  if ($speed -lt 0.3 -or $speed -gt 3.0) {
    Write-Host 'ERROR: route speed is implausible for walking; the graph may use a car profile.' -ForegroundColor Red
    exit 1
  }
  Write-Host 'Smoke test passed: pedestrian router answers with walking-plausible results.' -ForegroundColor Green
} finally {
  # Ownership-scoped cleanup: remove only the container this run started,
  # re-verified by inspect immediately before removal.
  if (-not [string]::IsNullOrWhiteSpace($smokeId)) {
    $smokeJson = & docker inspect $smokeId 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-ContainerOwned -InspectJson ($smokeJson -join "`n"))) {
      & docker rm -f $smokeId 2>&1 | Out-Null
    }
  }
}

Write-Host ''
Write-Host 'Bootstrap complete. Next steps:' -ForegroundColor Green
Write-Host '  npm run startall   # the routing profile now enables automatically'
Write-Host '  npm run status     # expect near-circle-routing-walk: healthy'
Write-Host ''
exit 0
