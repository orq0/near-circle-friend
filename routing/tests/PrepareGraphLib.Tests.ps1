# Regression tests for routing/prepare-graph-lib.ps1.
# Pester 3.4-compatible syntax: runs on Windows PowerShell 5.1, PS7 with
# Pester 3.4, and Pester 5. No Docker, no network, no fixtures on disk beyond
# byte arrays built per test.
#
# Run from the repository root:
#   Invoke-Pester ./routing/tests/PrepareGraphLib.Tests.ps1

. (Join-Path (Split-Path -Parent $PSScriptRoot) 'prepare-graph-lib.ps1')

function Write-PbfFixture([string]$name, [byte[]]$bytes) {
  $path = Join-Path $TestDrive $name
  [System.IO.File]::WriteAllBytes($path, $bytes)
  return $path
}

function New-PbfBytes([byte[]]$prefix, [string]$ascii) {
  return [byte[]]($prefix + [System.Text.Encoding]::ASCII.GetBytes($ascii))
}

Describe 'Test-PbfHeader' {
  It 'accepts a minimal valid OSMHeader blob' {
    $bytes = New-PbfBytes ([byte[]]@(0x00, 0x00, 0x00, 0x0B, 0x0A, 0x09)) 'OSMHeader'
    $result = Test-PbfHeader -Path (Write-PbfFixture 'valid-min.pbf' $bytes)
    $result.Valid | Should Be $true
    $result.Reason | Should Match 'OSMHeader'
  }

  It 'accepts a realistic header with extra protobuf fields' {
    $bytes = New-PbfBytes ([byte[]]@(0x00, 0x00, 0x00, 0x0E, 0x0A, 0x09)) 'OSMHeader'
    $bytes = [byte[]]($bytes + [byte[]]@(0x18, 0xA2, 0x01))
    $result = Test-PbfHeader -Path (Write-PbfFixture 'valid-real.pbf' $bytes)
    $result.Valid | Should Be $true
  }

  It 'rejects a missing file' {
    $result = Test-PbfHeader -Path (Join-Path $TestDrive 'does-not-exist.pbf')
    $result.Valid | Should Be $false
  }

  It 'rejects an empty file' {
    $result = Test-PbfHeader -Path (Write-PbfFixture 'empty.pbf' ([byte[]]@()))
    $result.Valid | Should Be $false
  }

  It 'rejects a file shorter than a minimal header' {
    $result = Test-PbfHeader -Path (Write-PbfFixture 'short.pbf' ([byte[]]@(0x00, 0x00, 0x00)))
    $result.Valid | Should Be $false
  }

  It 'rejects a zero BlobHeader length' {
    $padded = [byte[]]@(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)
    $result = Test-PbfHeader -Path (Write-PbfFixture 'zero-len.pbf' $padded)
    $result.Valid | Should Be $false
    $result.Reason | Should Match 'outside'
  }

  It 'rejects an oversize BlobHeader length' {
    $padded = [byte[]]@(0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)
    $result = Test-PbfHeader -Path (Write-PbfFixture 'huge-len.pbf' $padded)
    $result.Valid | Should Be $false
  }

  It 'rejects a truncated header' {
    $bytes = New-PbfBytes ([byte[]]@(0x00, 0x00, 0x00, 0x64, 0x0A, 0x09)) 'OSMHeadPartial'
    $result = Test-PbfHeader -Path (Write-PbfFixture 'truncated.pbf' $bytes)
    $result.Valid | Should Be $false
    $result.Reason | Should Match 'truncated'
  }

  It 'rejects a non-OSMHeader first blob' {
    $bytes = New-PbfBytes ([byte[]]@(0x00, 0x00, 0x00, 0x09, 0x0A, 0x07)) 'OSMData'
    $result = Test-PbfHeader -Path (Write-PbfFixture 'osmdata-first.pbf' $bytes)
    $result.Valid | Should Be $false
    $result.Reason | Should Match 'not OSMHeader'
  }

  It 'rejects an HTML error page saved as a download' {
    $bytes = [System.Text.Encoding]::ASCII.GetBytes('<html><head><title>404 Not Found</title>')
    $result = Test-PbfHeader -Path (Write-PbfFixture 'error-page.pbf' $bytes)
    $result.Valid | Should Be $false
  }
}

Describe 'Test-RoutingGraph' {
  $sentinels = @(
    'near-circle.osrm.partition',
    'near-circle.osrm.cells',
    'near-circle.osrm.mldgr',
    'near-circle.osrm.cell_metrics'
  )

  function New-GraphDir([string[]]$present) {
    $dir = Join-Path $TestDrive ([guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Force $dir | Out-Null
    foreach ($name in $present) {
      [System.IO.File]::WriteAllBytes((Join-Path $dir $name), [byte[]]@(0x01))
    }
    return $dir
  }

  It 'reports ready when all MLD sentinels exist, without a bare .osrm file' {
    $dir = New-GraphDir $sentinels
    $result = Test-RoutingGraph -DataDir $dir
    $result.Ready | Should Be $true
    $result.Missing.Count | Should Be 0
    $result.BasePath | Should Match 'near-circle\.osrm$'
  }

  It 'reports not-ready and names the missing sentinels' {
    $dir = New-GraphDir @('near-circle.osrm.partition', 'near-circle.osrm.cells')
    $result = Test-RoutingGraph -DataDir $dir
    $result.Ready | Should Be $false
    ($result.Missing -contains 'near-circle.osrm.mldgr') | Should Be $true
    ($result.Missing -contains 'near-circle.osrm.cell_metrics') | Should Be $true
  }

  It 'reports not-ready for an empty data directory' {
    $dir = New-GraphDir @()
    $result = Test-RoutingGraph -DataDir $dir
    $result.Ready | Should Be $false
    $result.Missing.Count | Should Be 4
  }

  It 'does not mistake the PBF for a prepared graph' {
    $dir = New-GraphDir @()
    [System.IO.File]::WriteAllBytes((Join-Path $dir 'near-circle.osm.pbf'), [byte[]]@(0x01, 0x02))
    $result = Test-RoutingGraph -DataDir $dir
    $result.Ready | Should Be $false
  }
}

Describe 'Test-ContainerOwned' {
  It 'recognizes its own smoke container' {
    $json = '[{"Id":"abc123","Config":{"Labels":{"near-circle.managed-by":"prepare-graph","near-circle.run-id":"run-1"}}}]'
    Test-ContainerOwned -InspectJson $json | Should Be $true
  }

  It 'recognizes a stale container from a previous bootstrap run' {
    $json = '[{"Id":"def456","Config":{"Labels":{"near-circle.managed-by":"prepare-graph","near-circle.run-id":"older-run"}}}]'
    Test-ContainerOwned -InspectJson $json | Should Be $true
  }

  It 'rejects a foreign container' {
    $json = '[{"Id":"789abc","Config":{"Labels":{"com.other.tool":"yes"}}}]'
    Test-ContainerOwned -InspectJson $json | Should Be $false
  }

  It 'rejects containers without labels' {
    Test-ContainerOwned -InspectJson '[{"Id":"a","Config":{}}]' | Should Be $false
    Test-ContainerOwned -InspectJson '[{"Id":"b","Config":null}]' | Should Be $false
  }

  It 'rejects malformed and empty inspect output' {
    Test-ContainerOwned -InspectJson 'not json at all' | Should Be $false
    Test-ContainerOwned -InspectJson '' | Should Be $false
    Test-ContainerOwned -InspectJson '[]' | Should Be $false
  }
}

Describe 'smoke-container name conflicts' {
  It 'treats an owned name-holder as safe to reclaim' {
    $json = '[{"Id":"stale1","Config":{"Labels":{"near-circle.managed-by":"prepare-graph"}}}]'
    Test-ContainerOwned -InspectJson $json | Should Be $true
  }

  It 'treats a foreign name-holder as must-abort' {
    $json = '[{"Id":"foreign1","Config":{"Labels":{"app":"someone-elses-router"}}}]'
    Test-ContainerOwned -InspectJson $json | Should Be $false
  }

  It 'treats vanished inspect output as absent' {
    # The script proceeds only when `docker inspect` itself failed; an empty
    # payload never authorizes removal.
    Test-ContainerOwned -InspectJson '' | Should Be $false
  }
}
