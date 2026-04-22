$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$dataRoot = Join-Path $repoRoot "data\launcher"
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$backendOutLog = Join-Path $dataRoot "backend.out.log"
$backendErrLog = Join-Path $dataRoot "backend.err.log"
$frontendOutLog = Join-Path $dataRoot "frontend.out.log"
$frontendErrLog = Join-Path $dataRoot "frontend.err.log"

New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null

function Test-PortListening {
  param([int]$Port)

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne(350)
    if (-not $connected) {
      $client.Close()
      return $false
    }
    $client.EndConnect($async)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Wait-Port {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 25
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortListening -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Start-BackendIfNeeded {
  if (Test-PortListening -Port 8108) {
    return
  }

  $pythonCmd = (Get-Command python -ErrorAction Stop).Source
  $pythonwCmd = Join-Path (Split-Path $pythonCmd) "pythonw.exe"
  if (-not (Test-Path $pythonwCmd)) {
    $pythonwCmd = $pythonCmd
  }

  Start-Process -FilePath $pythonwCmd `
    -ArgumentList @("-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8108") `
    -WorkingDirectory $backendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendOutLog `
    -RedirectStandardError $backendErrLog | Out-Null
}

function Start-FrontendIfNeeded {
  if (Test-PortListening -Port 4183) {
    return
  }

  $nodeCmd = (Get-Command node -ErrorAction Stop).Source
  $viteCli = Join-Path $frontendDir "node_modules\vite\bin\vite.js"
  if (-not (Test-Path $viteCli)) {
    throw "Vite CLI not found at $viteCli"
  }

  Start-Process -FilePath $nodeCmd `
    -ArgumentList @($viteCli, "--host", "0.0.0.0", "--port", "4183") `
    -WorkingDirectory $frontendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $frontendOutLog `
    -RedirectStandardError $frontendErrLog | Out-Null
}

function Get-AppBrowser {
  $candidates = @(
    @{ Path = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"; Name = "chrome" },
    @{ Path = "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"; Name = "chrome" },
    @{ Path = "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"; Name = "edge" },
    @{ Path = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"; Name = "edge" }
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate.Path) {
      return $candidate.Path
    }
  }
  return $null
}

Start-BackendIfNeeded
Start-FrontendIfNeeded

Wait-Port -Port 8108 | Out-Null
Wait-Port -Port 4183 | Out-Null

$appUrl = "http://localhost:4183"
$browserPath = Get-AppBrowser

if ($browserPath) {
  Start-Process -FilePath $browserPath -ArgumentList @("--app=$appUrl") | Out-Null
  exit 0
}

Start-Process $appUrl | Out-Null
