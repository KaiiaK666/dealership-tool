$ErrorActionPreference = "Stop"

$invokePath = Join-Path $PSScriptRoot "Invoke-SalesActivityTask.ps1"

if (-not (Test-Path $invokePath)) {
  throw "Invoke script not found: $invokePath"
}

& $invokePath -RunFileName "Run BDC Activity Report Sales Manager.bat"
