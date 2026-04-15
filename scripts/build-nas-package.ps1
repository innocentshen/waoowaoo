[CmdletBinding()]
param(
  [string]$PublicHost = '192.168.0.107',
  [string]$RepoRoot = (Get-Location).Path,
  [string]$OutputRoot = '',
  [string]$ImageName = 'waoowaoo',
  [string]$Platform = 'linux/amd64'
)

$ErrorActionPreference = 'Stop'

function Set-Or-AddEnvLine {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [AllowEmptyString()]
    [string[]]$Lines,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $pattern = '^{0}=' -f [Regex]::Escape($Key)
  $updated = $false
  for ($i = 0; $i -lt $Lines.Count; $i++) {
    if ($Lines[$i] -match $pattern) {
      $Lines[$i] = '{0}={1}' -f $Key, $Value
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $Lines += '{0}={1}' -f $Key, $Value
  }

  return ,$Lines
}

function Ensure-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

$repoFullPath = [System.IO.Path]::GetFullPath($RepoRoot)
$desktop = [Environment]::GetFolderPath('Desktop')
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$imageTag = '{0}:nas-{1}' -f $ImageName, $timestamp

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $desktop ('waoowaoo-nas-package-' + $timestamp)
}

$outputFullPath = [System.IO.Path]::GetFullPath($OutputRoot)
$imageTarPath = Join-Path $outputFullPath ('{0}-nas-{1}-amd64.tar' -f $ImageName, $timestamp)
$envPath = Join-Path $repoFullPath '.env'

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Missing .env at $envPath"
}

Ensure-Directory -Path $outputFullPath
Ensure-Directory -Path (Join-Path $outputFullPath 'app-data')
Ensure-Directory -Path (Join-Path $outputFullPath 'app-logs')

$envLines = Get-Content -LiteralPath $envPath
$envLines = Set-Or-AddEnvLine -Lines $envLines -Key 'NEXTAUTH_URL' -Value ('http://{0}:3000' -f $PublicHost)
$envLines = Set-Or-AddEnvLine -Lines $envLines -Key 'INTERNAL_APP_URL' -Value 'http://127.0.0.1:3000'
$envLines = Set-Or-AddEnvLine -Lines $envLines -Key 'BULL_BOARD_HOST' -Value '0.0.0.0'
$envLines = Set-Or-AddEnvLine -Lines $envLines -Key 'BULL_BOARD_PORT' -Value '3010'
$envLines = Set-Or-AddEnvLine -Lines $envLines -Key 'BULL_BOARD_BASE_PATH' -Value '/admin/queues'
$envLines = Set-Or-AddEnvLine -Lines $envLines -Key 'NODE_ENV' -Value 'production'

$packageEnvPath = Join-Path $outputFullPath '.env'
[System.IO.File]::WriteAllText($packageEnvPath, (($envLines -join "`r`n") + "`r`n"), [System.Text.UTF8Encoding]::new($false))

$composeContent = @"
services:
  app:
    image: $imageTag
    container_name: waoowaoo-app
    restart: unless-stopped
    env_file:
      - ./.env
    ports:
      - "3000:3000"
      - "3010:3010"
    volumes:
      - ./app-data:/app/data
      - ./app-logs:/app/logs
    command: >
      sh -c "
        npx prisma db push --skip-generate &&
        npm run start
      "
"@
[System.IO.File]::WriteAllText((Join-Path $outputFullPath 'docker-compose.yml'), $composeContent, [System.Text.UTF8Encoding]::new($false))

$readmeContent = @"
waoowaoo NAS deployment package
================================

What still needs to run
-----------------------
- Required: the app container in this package.
- Already externalized and expected to be reachable from the app container:
  - MySQL
  - Redis
  - MinIO
- Optional: a reverse proxy / FRP / domain layer for HTTPS and public access.

Important runtime notes
-----------------------
- This package already uses your current .env values as the base.
- NEXTAUTH_URL has been set to: http://$PublicHost:3000
- INTERNAL_APP_URL stays on 127.0.0.1 inside the container.
- Bull Board is exposed on: http://$PublicHost:3010/admin/queues
- This app uses cookie-based auth. Do not try to solve future domain access with wildcard CORS.
  Keep browser access same-origin through your reverse proxy / tunnel.
  When your public domain is ready, only change:
    NEXTAUTH_URL=https://your-domain.example

Files in this folder
--------------------
- $(Split-Path -Leaf $imageTarPath)
- docker-compose.yml
- .env
- app-data/   persistent app data mount
- app-logs/   persistent app logs mount

How to deploy on NAS
--------------------
1. Copy this whole folder to the NAS.
2. In that folder, import the image:
   docker load -i $(Split-Path -Leaf $imageTarPath)
3. Start the app:
   docker compose up -d
4. Open:
   http://$PublicHost:3000

If you later switch to a public domain
--------------------------------------
- Update .env:
  NEXTAUTH_URL=https://your-domain.example
- Then restart:
  docker compose up -d

Image tag inside this package
-----------------------------
$imageTag
"@
[System.IO.File]::WriteAllText((Join-Path $outputFullPath 'README.txt'), $readmeContent, [System.Text.UTF8Encoding]::new($false))

Write-Host "Building Docker image $imageTag for $Platform ..."
docker buildx build --platform $Platform --load -t $imageTag $repoFullPath
if ($LASTEXITCODE -ne 0) {
  throw "docker buildx build failed with exit code $LASTEXITCODE"
}

Write-Host "Saving image to $imageTarPath ..."
docker save -o $imageTarPath $imageTag
if ($LASTEXITCODE -ne 0) {
  throw "docker save failed with exit code $LASTEXITCODE"
}

$manifest = [ordered]@{
  imageTag = $imageTag
  platform = $Platform
  outputDir = $outputFullPath
  imageTar = $imageTarPath
  publicHost = $PublicHost
  generatedAt = (Get-Date).ToString('s')
}
$manifestPath = Join-Path $outputFullPath 'package-manifest.json'
($manifest | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host ''
Write-Host 'NAS package created successfully.'
Write-Host ("Output: {0}" -f $outputFullPath)
Write-Host ("Image:  {0}" -f $imageTag)
