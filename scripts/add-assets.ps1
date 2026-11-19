param([string]$Apk, [string]$Assets)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = (Resolve-Path $Assets).Path
$zip = [System.IO.Compression.ZipFile]::Open($Apk, 'Update')
$n = 0
Get-ChildItem $root -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
  $name = 'assets/' + $rel
  $old = $zip.GetEntry($name)
  if ($old) { $old.Delete() }
  $e = $zip.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
  $s = $e.Open()
  $fs = [System.IO.File]::OpenRead($_.FullName)
  $fs.CopyTo($s)
  $fs.Close(); $s.Close()
  $n++
}
$zip.Dispose()
Write-Output ("assets-added=" + $n)
