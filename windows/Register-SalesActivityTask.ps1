param(
  [string]$TaskName = "Dealership Tool - BDC Activity Report Sales",
  [string]$RunFileName = "Run BDC Activity Report Sales.bat",
  [string]$InvokeScriptName = "Invoke-SalesActivityTask.ps1",
  [string]$StartTime = "10:00",
  [int]$RepeatIntervalMinutes = 60,
  [string]$Duration = "11:00"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$invokePath = Join-Path $PSScriptRoot $InvokeScriptName

if (-not (Test-Path $invokePath)) {
  throw "Invoke script not found: $invokePath"
}

$commandParts = @(
  "powershell.exe",
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  ('""{0}""' -f $invokePath)
)
if ($InvokeScriptName -eq "Invoke-SalesActivityTask.ps1") {
  $runPath = Join-Path $repoRoot $RunFileName
  if (-not (Test-Path $runPath)) {
    throw "Run file not found: $runPath"
  }
  $commandParts += "-RunFileName"
  $commandParts += ('""{0}""' -f $RunFileName)
}
$command = $commandParts -join " "

schtasks.exe /Create /F /TN $TaskName /SC DAILY /ST $StartTime /RI $RepeatIntervalMinutes /DU $Duration /TR $command | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "schtasks.exe failed while registering $TaskName"
}

Write-Output "Registered scheduled task: $TaskName"
