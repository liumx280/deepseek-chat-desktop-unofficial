# Compile the NSIS installer from a prepared portable directory.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\build-installer.ps1 -Makensis C:\path\to\makensis.exe [-Version 1.0.1]
param(
  [Parameter(Mandatory = $true)][string]$Makensis,
  [string]$Version = '1.0.0'
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$src = Join-Path $root 'release\DeepSeek Chat'
if (-not (Test-Path $src)) { throw "portable build missing. Run scripts/make-portable.ps1 first." }

$nsi = Join-Path $root 'packaging\installer.nsi'
& $Makensis "/DAPP_VERSION=$Version" $nsi
if ($LASTEXITCODE -ne 0) { throw "makensis failed with $LASTEXITCODE" }
Write-Host "==> done: see release\"
