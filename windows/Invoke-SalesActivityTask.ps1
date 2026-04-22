param(
  [string]$RunFileName = "Run BDC Activity Report Sales.bat"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$runPath = Join-Path $repoRoot $RunFileName

if ((Get-Date).DayOfWeek -eq "Sunday") {
  exit 0
}

if (-not (Test-Path $runPath)) {
  throw "Run file not found: $runPath"
}

& $runPath
