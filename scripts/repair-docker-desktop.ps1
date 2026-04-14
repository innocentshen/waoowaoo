param(
  [switch]$Repair
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "=== $Title ==="
}

function Write-KeyValue {
  param(
    [string]$Name,
    [string]$Value
  )

  Write-Host ("{0,-24} {1}" -f $Name, $Value)
}

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-DockerInfoVersion {
  try {
    $version = & docker info --format "{{.ServerVersion}}" 2>$null
    if ($LASTEXITCODE -eq 0 -and $version) {
      return ($version | Select-Object -First 1).Trim()
    }
  } catch {
  }

  return $null
}

function Get-DiskImageSafe {
  param([string]$ImagePath)

  if (-not (Test-Path $ImagePath)) {
    return $null
  }

  try {
    return Get-DiskImage -ImagePath $ImagePath -ErrorAction Stop
  } catch {
    return $null
  }
}

function Get-DockerBackendSharingViolation {
  param([string]$LogPath)

  if (-not (Test-Path $LogPath)) {
    return $false
  }

  try {
    return [bool](Select-String -Path $LogPath -Pattern "ERROR_SHARING_VIOLATION" -SimpleMatch -Quiet)
  } catch {
    return $false
  }
}

$dockerDataVhd = Join-Path $env:LOCALAPPDATA "Docker\wsl\disk\docker_data.vhdx"
$backendLog = Join-Path $env:LOCALAPPDATA "Docker\log\host\com.docker.backend.exe.log"
$dockerDesktopExe = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
$isAdmin = Test-IsAdmin

if (-not $Repair) {
  $dockerVersion = Get-DockerInfoVersion
  $service = Get-Service com.docker.service -ErrorAction SilentlyContinue
  $diskImage = Get-DiskImageSafe -ImagePath $dockerDataVhd
  $hasSharingViolation = Get-DockerBackendSharingViolation -LogPath $backendLog
  $dockerDesktopDistro = $null

  try {
    $dockerDesktopDistro = & wsl.exe -l -v 2>$null | Select-String "docker-desktop"
  } catch {
  }

  Write-Section "Docker Desktop Diagnosis"
  Write-KeyValue "Admin session" ($(if ($isAdmin) { "yes" } else { "no" }))
  Write-KeyValue "Docker CLI" ($(if (Get-Command docker -ErrorAction SilentlyContinue) { "present" } else { "missing" }))
  Write-KeyValue "Docker engine" ($(if ($dockerVersion) { "responding ($dockerVersion)" } else { "not responding" }))
  Write-KeyValue "Docker service" ($(if ($service) { $service.Status } else { "not found" }))
  Write-KeyValue "docker_data.vhdx" ($(if (Test-Path $dockerDataVhd) { $dockerDataVhd } else { "not found" }))
  Write-KeyValue "VHD attached" ($(if ($diskImage) { [string]$diskImage.Attached } else { "unknown" }))
  if ($diskImage) {
    Write-KeyValue "Disk device" ($(if ($diskImage.DevicePath) { $diskImage.DevicePath } else { "(none)" }))
  }
  Write-KeyValue "WSL sharing error" ($(if ($hasSharingViolation) { "detected in Docker backend log" } else { "not detected" }))
  Write-KeyValue "WSL docker-desktop" ($(if ($dockerDesktopDistro) { ($dockerDesktopDistro.ToString().Trim()) } else { "not running" }))

  if (-not $dockerVersion -and $diskImage -and $diskImage.Attached -and $hasSharingViolation) {
    Write-Host ""
    Write-Host "[CAUSE] Docker Desktop cannot start because its data VHDX is still attached,"
    Write-Host "        and WSL returns ERROR_SHARING_VIOLATION when Docker tries to mount it again."
    Write-Host ""
    Write-Host "[SAFE FIX] Run this in an elevated PowerShell window to detach the stale VHDX"
    Write-Host "           without deleting your Docker volumes or project data:"
    Write-Host ""
    Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\repair-docker-desktop.ps1`" -Repair"
    Write-Host ""
    Write-Host "[LAST RESORT] If detach still fails, reboot Windows once. Do not delete"
    Write-Host "             $dockerDataVhd unless you intentionally accept Docker data loss."
  } elseif (-not $dockerVersion) {
    Write-Host ""
    Write-Host "[INFO] Docker engine is not responding. If Docker Desktop shows a WSL error,"
    Write-Host "       run this script with -Repair from an elevated PowerShell window."
  }

  exit 0
}

Write-Section "Docker Desktop Safe Repair"

if (-not $isAdmin) {
  Write-Error "This repair step needs an elevated PowerShell session. Re-run with 'Run as administrator'."
}

Write-Host "Stopping Docker Desktop processes..."
Get-Process *docker* -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Shutting down WSL..."
& wsl.exe --shutdown | Out-Null

$diskImage = Get-DiskImageSafe -ImagePath $dockerDataVhd
if ($diskImage -and $diskImage.Attached) {
  Write-Host "Detaching stale Docker Desktop VHDX..."
  if (Get-Command Dismount-VHD -ErrorAction SilentlyContinue) {
    Dismount-VHD -Path $dockerDataVhd
  } else {
    Dismount-DiskImage -ImagePath $dockerDataVhd
  }
} else {
  Write-Host "Docker Desktop VHDX is not attached."
}

if (-not (Test-Path $dockerDesktopExe)) {
  Write-Error "Docker Desktop executable was not found at $dockerDesktopExe"
}

Write-Host "Starting Docker Desktop..."
Start-Process -FilePath $dockerDesktopExe

for ($i = 1; $i -le 30; $i++) {
  Start-Sleep -Seconds 2
  $version = Get-DockerInfoVersion
  if ($version) {
    Write-Host "Docker engine is responding: $version"
    exit 0
  }
}

Write-Error "Docker engine still did not come back after repair. Reboot Windows once before trying destructive recovery."
