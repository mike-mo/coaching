param(
  [string]$BrowserPath = (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $BrowserPath -PathType Leaf)) {
  throw 'A Chromium browser is required. Set BrowserPath to your Edge or Chrome executable.'
}

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'assets\share-card.svg'
$output = Join-Path $root 'assets\share-card.png'
$profile = Join-Path ([System.IO.Path]::GetTempPath()) ('coaching-share-card-' + [guid]::NewGuid().ToString('N'))
$sourceUrl = ([uri]$source).AbsoluteUri
New-Item -ItemType Directory -Path $profile | Out-Null
try {
  $arguments = @(
    '--headless=new', '--disable-gpu', '--disable-extensions', '--disable-background-networking',
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1200,630',
    ('--user-data-dir="' + $profile + '"'), ('--screenshot="' + $output + '"'), $sourceUrl
  )
  $process = Start-Process -FilePath $BrowserPath -ArgumentList $arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw 'The browser could not render the share card.' }
  if (-not (Test-Path -LiteralPath $output -PathType Leaf)) { throw 'The browser did not write the PNG.' }
  $png = [System.IO.File]::ReadAllBytes($output)
  if ($png.Length -lt 24 -or $png[0] -ne 137 -or $png[1] -ne 80 -or $png[2] -ne 78 -or $png[3] -ne 71) {
    throw 'The rendered file is not a PNG.'
  }
  $width = ([int]$png[16] -shl 24) -bor ([int]$png[17] -shl 16) -bor ([int]$png[18] -shl 8) -bor [int]$png[19]
  $height = ([int]$png[20] -shl 24) -bor ([int]$png[21] -shl 16) -bor ([int]$png[22] -shl 8) -bor [int]$png[23]
  if ($width -ne 1200 -or $height -ne 630) { throw "Expected 1200x630, got ${width}x${height}." }
  Write-Output "Rendered assets\share-card.png (${width}x${height})."
} finally {
  Remove-Item -LiteralPath $profile -Recurse -Force
}
