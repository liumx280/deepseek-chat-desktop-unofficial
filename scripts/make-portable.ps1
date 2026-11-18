# Assemble a portable build directory from the official Electron zip + repo/dist.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\make-portable.ps1 -ElectronDir C:\path\to\electron
param(
  [Parameter(Mandatory = $true)][string]$ElectronDir,
  [string]$OutDir
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
if (-not $OutDir) { $OutDir = Join-Path $root 'release\DeepSeek Chat' }

$dist = Join-Path $root 'repo\dist\index.html'
if (-not (Test-Path $dist)) { throw "repo\dist missing. Run scripts/build-web.sh first." }

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir | Out-Null

Write-Host "==> copying electron runtime"
Copy-Item (Join-Path $ElectronDir '*') $OutDir -Recurse -Force

$exe = Join-Path $OutDir 'electron.exe'
if (-not (Test-Path $exe)) { throw "electron.exe not found in $ElectronDir" }
Rename-Item $exe 'DeepSeek Chat.exe'
Remove-Item (Join-Path $OutDir 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue

Write-Host "==> copying app"
$app = Join-Path $OutDir 'resources\app'
New-Item -ItemType Directory -Path $app -Force | Out-Null
Copy-Item (Join-Path $root 'desktop\main.js') $app
Copy-Item (Join-Path $root 'desktop\package.json') $app
Copy-Item (Join-Path $root 'desktop\build') (Join-Path $app 'build') -Recurse -Force
Copy-Item (Join-Path $root 'repo\dist') (Join-Path $app 'web') -Recurse -Force
Copy-Item (Join-Path $root 'desktop\build\icon.ico') (Join-Path $OutDir 'DeepSeek Chat.ico')

Write-Host "==> done: $OutDir"
