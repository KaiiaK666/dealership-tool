param(
  [string]$ShortcutName = "Dealership Tool.lnk"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath $ShortcutName
$launchPath = Join-Path $repoRoot "Launch Dealership Tool Desktop.vbs"
$iconPath = Join-Path $repoRoot "frontend\public\dbt-hub-icon.ico"
$pngPath = Join-Path $repoRoot "frontend\public\dbt-hub-icon.png"

if (-not (Test-Path $launchPath)) {
  throw "Launch file not found: $launchPath"
}

if (-not (Test-Path $iconPath)) {
  if (-not (Test-Path $pngPath)) {
    throw "PNG icon not found: $pngPath"
  }

  $pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
  $stream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter($stream)
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]1)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([Byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$pngBytes.Length)
  $writer.Write([UInt32]22)
  $writer.Write($pngBytes)
  [System.IO.File]::WriteAllBytes($iconPath, $stream.ToArray())
  $writer.Close()
  $stream.Close()
}

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launchPath
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Save()

Write-Output "Created shortcut at $shortcutPath"
