$ErrorActionPreference = "Stop"

$Repository = if ($env:TODOCTL_REPO) { $env:TODOCTL_REPO } else { "your-org/worktree-todo-starter" }
$Version = if ($env:TODOCTL_VERSION) { $env:TODOCTL_VERSION } else { "" }
$BinDir = if ($env:TODOCTL_BIN_DIR) { $env:TODOCTL_BIN_DIR } else { Join-Path $env:LOCALAPPDATA "Programs\todoctl" }

if ($env:PROCESSOR_ARCHITECTURE -ne "AMD64") {
  throw "todoctl currently publishes a Windows x64 release; detected $env:PROCESSOR_ARCHITECTURE"
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $release = Invoke-RestMethod -Headers @{ Accept = "application/vnd.github+json" } -Uri "https://api.github.com/repos/$Repository/releases/latest"
  $Version = $release.tag_name
}
$Version = $Version.TrimStart("v")

$triple = "x86_64-pc-windows-msvc"
$stem = "todoctl-$triple"
$archive = "$stem.zip"
$base = "https://github.com/$Repository/releases/download/v$Version"
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("todoctl-install-" + [System.Guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null

try {
  $archivePath = Join-Path $temp $archive
  $checksumsPath = Join-Path $temp "checksums.txt"
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$archive" -OutFile $archivePath
  Invoke-WebRequest -UseBasicParsing -Uri "$base/checksums.txt" -OutFile $checksumsPath

  $checksumLine = Get-Content $checksumsPath | Where-Object { $_ -match "\s$([regex]::Escape($archive))$" } | Select-Object -First 1
  if (-not $checksumLine) { throw "Checksum for $archive is missing" }
  $expected = ($checksumLine -split "\s+")[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 $archivePath).Hash.ToLowerInvariant()
  if ($expected -ne $actual) { throw "Checksum verification failed for $archive" }

  $unpack = Join-Path $temp "unpack"
  Expand-Archive -LiteralPath $archivePath -DestinationPath $unpack -Force
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  Copy-Item -Force (Join-Path $unpack "$stem\todoctl.exe") (Join-Path $BinDir "todoctl.exe")
  Write-Host "Installed todoctl $Version to $BinDir\todoctl.exe"

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (($userPath -split ";") -notcontains $BinDir) {
    Write-Host "Add $BinDir to your user PATH before running todoctl."
  }
}
finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $temp
}
