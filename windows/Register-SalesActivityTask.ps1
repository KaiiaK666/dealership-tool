param(
  [string]$TaskName = "Dealership Tool - BDC Activity Report Sales"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$invokePath = Join-Path $PSScriptRoot "Invoke-SalesActivityTask.ps1"

if (-not (Test-Path $invokePath)) {
  throw "Invoke script not found: $invokePath"
}

$command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $invokePath + '"'

schtasks.exe /Create /F /TN $TaskName /SC DAILY /ST 10:00 /RI 120 /DU 11:00 /TR $command | Out-Null

Write-Output "Registered scheduled task: $TaskName"
