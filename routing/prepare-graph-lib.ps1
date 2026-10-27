# Shared logic for routing/prepare-graph.ps1. Pure functions with no Docker
# dependency so they are unit-testable (see routing/tests/).
# Dot-source this file; it performs no actions on load.

# Ownership marker for containers this bootstrap creates. Cleanup removes a
# container only when its inspect output carries this label.
$SmokeLabelKey = 'near-circle.managed-by'
$SmokeLabelValue = 'prepare-graph'

# Validates the OSM PBF opening per the file-format specification: a 4-byte
# big-endian BlobHeader length (1..65536), followed by a first header whose
# blob type is OSMHeader (the first blob in the file MUST be OSMHeader).
# Returns an object with Valid ([bool]) and Reason ([string]).
function Test-PbfHeader {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]@{ Valid = $false; Reason = 'file not found' }
  }
  $stream = $null
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    if ($stream.Length -lt 12) {
      return [pscustomobject]@{ Valid = $false; Reason = 'file smaller than a minimal OSMHeader blob' }
    }
    $lengthBytes = New-Object byte[] 4
    $lengthRead = $stream.Read($lengthBytes, 0, 4)
    if ($lengthRead -ne 4) {
      return [pscustomobject]@{ Valid = $false; Reason = 'could not read BlobHeader length' }
    }
    [long]$headerLength = ([long]$lengthBytes[0] * 16777216) + ([long]$lengthBytes[1] * 65536) + ([long]$lengthBytes[2] * 256) + [long]$lengthBytes[3]
    if ($headerLength -lt 1 -or $headerLength -gt 65536) {
      return [pscustomobject]@{ Valid = $false; Reason = "BlobHeader length $headerLength outside 1..65536" }
    }
    if ($stream.Length -lt (4 + $headerLength)) {
      return [pscustomobject]@{ Valid = $false; Reason = 'file truncated inside the first BlobHeader' }
    }
    $header = New-Object byte[] $headerLength
    $headerRead = $stream.Read($header, 0, [int]$headerLength)
    if ($headerRead -ne $headerLength) {
      return [pscustomobject]@{ Valid = $false; Reason = 'file truncated inside the first BlobHeader' }
    }
    $text = [System.Text.Encoding]::ASCII.GetString($header)
    if ($text -notmatch 'OSMHeader') {
      return [pscustomobject]@{ Valid = $false; Reason = 'first blob is not OSMHeader' }
    }
    return [pscustomobject]@{ Valid = $true; Reason = "BlobHeader length $headerLength, OSMHeader present" }
  } catch {
    return [pscustomobject]@{ Valid = $false; Reason = $_.Exception.Message }
  } finally {
    if ($null -ne $stream) { $stream.Close() }
  }
}

# OSRM v5.27 stopped writing the bare intermediate `.osrm` file in
# osrm-extract ("CHANGED: Do not generate intermediate .osrm file"), so the
# graph path (e.g. /data/near-circle.osrm) is a basename prefix, not a regular
# file. Readiness for `osrm-routed --algorithm mld` is the joint presence of
# the MLD sentinel files written by the last two pipeline stages: partition
# (.osrm.partition, .osrm.cells) and customize (.osrm.mldgr,
# .osrm.cell_metrics). Their joint presence transitively proves osrm-extract
# succeeded, because each stage consumes the previous stage's outputs.
# Returns an object with Ready ([bool]), BasePath ([string]), and Missing
# ([string[]] of absent sentinel file names).
function Test-RoutingGraph {
  param([Parameter(Mandatory = $true)][string]$DataDir)

  $basePath = Join-Path $DataDir 'near-circle.osrm'
  $sentinels = @(
    'near-circle.osrm.partition',
    'near-circle.osrm.cells',
    'near-circle.osrm.mldgr',
    'near-circle.osrm.cell_metrics'
  )
  $missing = @()
  foreach ($name in $sentinels) {
    if (-not (Test-Path -LiteralPath (Join-Path $DataDir $name))) {
      $missing += $name
    }
  }
  return [pscustomobject]@{
    Ready    = ($missing.Count -eq 0)
    BasePath = $basePath
    Missing  = $missing
  }
}

# True when `docker inspect` JSON describes a container this bootstrap owns.
# Accepts the raw inspect output (a JSON array) or a single object. Anything
# unparseable, foreign, or unlabeled returns $false: the caller must refuse
# to remove such a container.
function Test-ContainerOwned {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$InspectJson)

  if ([string]::IsNullOrWhiteSpace($InspectJson)) { return $false }
  try {
    $data = $InspectJson | ConvertFrom-Json
  } catch {
    return $false
  }
  $first = @($data)[0]
  if ($null -eq $first -or $null -eq $first.Config -or $null -eq $first.Config.Labels) {
    return $false
  }
  return $first.Config.Labels.$SmokeLabelKey -eq $SmokeLabelValue
}
