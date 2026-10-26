# Shared helpers for the Near-Circle lifecycle scripts (startall/stopall/status).
# PowerShell 7 compatible; written without PS7-only syntax so Windows PowerShell 5.1 works too.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    return (Split-Path -Parent $PSScriptRoot)
}

# Reads <root>/.env when present and merges it over Phase 1 defaults.
# Returns a hashtable. Callers must never print POSTGRES_PASSWORD.
function Read-NearCircleEnv {
    param([string]$RepoRoot)
    $nc = @{
        WEB_PORT             = '5173'
        API_PORT             = '3001'
        POSTGRES_PORT        = '5433'
        ROUTING_WALK_PORT    = '5001'
        POSTGRES_USER        = 'near_circle'
        POSTGRES_DB          = 'near_circle'
        ROUTING_WALK_URL     = 'http://near-circle-routing-walk:5000'
        ROUTING_WALK_HOST_URL = ''
        MAP_TILE_URL         = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        MAP_TILE_ATTRIBUTION = '© OpenStreetMap contributors'
        DEFAULT_STRIDE_M     = '0.75'
    }
    $envFile = Join-Path $RepoRoot '.env'
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            $t = $line.Trim()
            if ($t -eq '' -or $t.StartsWith('#')) { continue }
            $eq = $t.IndexOf('=')
            if ($eq -le 0) { continue }
            $k = $t.Substring(0, $eq).Trim()
            $v = $t.Substring($eq + 1).Trim().Trim('"').Trim("'")
            if ($k -ne '') { $nc[$k] = $v }
        }
    }
    if ([string]::IsNullOrWhiteSpace($nc['ROUTING_WALK_HOST_URL'])) {
        $nc['ROUTING_WALK_HOST_URL'] = "http://localhost:$($nc['ROUTING_WALK_PORT'])"
    }
    return $nc
}

function Test-DockerAvailable {
    return ($null -ne (Get-Command 'docker' -ErrorAction SilentlyContinue))
}

function Test-ComposeAvailable {
    if (-not (Test-DockerAvailable)) { return $false }
    try {
        & docker compose version 2>&1 | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Test-TcpPort {
    param([string]$HostName, [int]$Port, [int]$TimeoutMs = 1500)
    $client = $null
    try {
        $client = New-Object Net.Sockets.TcpClient
        $iar = $client.BeginConnect($HostName, $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs)
        if ($ok -and $client.Connected) { return $true }
        return $false
    } catch {
        return $false
    } finally {
        if ($null -ne $client) { $client.Close() }
    }
}

function Test-HttpOk {
    param([string]$Url, [int]$TimeoutSec = 3)
    try {
        $r = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec $TimeoutSec
        $code = [int]$r.StatusCode
        return ($code -ge 200 -and $code -lt 400)
    } catch {
        return $false
    }
}

# Polls until the URL answers 2xx/3xx or the timeout elapses. No fixed sleeps.
function Wait-HttpOk {
    param([string]$Url, [int]$TimeoutSec = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpOk -Url $Url -TimeoutSec 3) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Write-NcStatus {
    param([string]$Name, [string]$State, [string]$Detail = '')
    $color = 'Red'
    switch ($State) {
        'healthy' { $color = 'Green' }
        'running' { $color = 'Green' }
        'reachable' { $color = 'Green' }
        'not-ready' { $color = 'Yellow' }
        'unreachable' { $color = 'Yellow' }
        'unknown' { $color = 'Yellow' }
        'stopped' { $color = 'DarkGray' }
        'not-started' { $color = 'DarkGray' }
    }
    Write-Host ("{0,-26} " -f $Name) -NoNewline
    Write-Host ("{0,-12}" -f $State) -NoNewline -ForegroundColor $color
    if ($Detail -ne '') {
        Write-Host (" {0}" -f $Detail) -ForegroundColor DarkGray
    } else {
        Write-Host ''
    }
}
