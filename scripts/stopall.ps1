# Near-Circle: gracefully stop ONLY this project's services.
# Preserves database volumes and routing artifacts (plain `down`, never `-v`).
# Usage: npm run stopall   (from the repository root)
. "$PSScriptRoot/common.ps1"

$repoRoot = Get-RepoRoot
$composeFile = Join-Path $repoRoot 'docker-compose.yml'

Write-Host ''
Write-Host 'Near-Circle stopall' -ForegroundColor Cyan

if (-not (Test-DockerAvailable)) {
    Write-Host 'Docker is not available, so no Compose services can be running. Nothing to stop.' -ForegroundColor Yellow
    exit 0
}
if (-not (Test-ComposeAvailable)) {
    Write-Host 'ERROR: "docker compose" is unavailable. Nothing was stopped.' -ForegroundColor Red
    exit 1
}

# Scoped to this Compose project only; unrelated containers are never touched.
# Plain `down` also removes profile-started containers, and without `-v` all
# volumes and graph artifacts are preserved.
& docker compose -f $composeFile down
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERROR: docker compose down failed. See output above.' -ForegroundColor Red
    exit 1
}

Write-Host 'Stopped Near-Circle services. Database volume and routing artifacts preserved.' -ForegroundColor Green
Write-Host 'Verify any time with: npm run status' -ForegroundColor DarkGray
Write-Host ''
exit 0
