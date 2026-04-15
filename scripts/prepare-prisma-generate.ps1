[CmdletBinding()]
param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

function Stop-RepoNodeProcesses {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root
  )

  $fullRoot = [System.IO.Path]::GetFullPath($Root)
  $escapedRoot = [Regex]::Escape($fullRoot)
  $allNode = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' })

  if ($allNode.Count -eq 0) {
    Write-Host 'No node.exe processes found.'
    return
  }

  $nodeById = @{}
  foreach ($proc in $allNode) {
    $nodeById[[int]$proc.ProcessId] = $proc
  }

  $selected = New-Object 'System.Collections.Generic.Dictionary[int, object]'
  $seeded = $allNode | Where-Object {
    $cmd = [string]$_.CommandLine
    $cmd -and $cmd -match $escapedRoot
  }

  foreach ($proc in $seeded) {
    $current = $proc
    while ($null -ne $current) {
      $procId = [int]$current.ProcessId
      if (-not $selected.ContainsKey($procId)) {
        $selected[$procId] = $current
      }

      $parentId = [int]$current.ParentProcessId
      if ($parentId -le 0 -or -not $nodeById.ContainsKey($parentId)) {
        break
      }

      $current = $nodeById[$parentId]
    }
  }

  if ($selected.Count -eq 0) {
    Write-Host "No repo-local node.exe processes found under $fullRoot"
    return
  }

  foreach ($proc in ($selected.Values | Sort-Object ProcessId -Descending)) {
    $procId = [int]$proc.ProcessId
    $cmd = ([string]$proc.CommandLine).Trim()
    if (-not $cmd) {
      $cmd = '<no command line>'
    }

    Write-Host ("Stopping repo node process {0}: {1}" -f $procId, $cmd)
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }

  Start-Sleep -Milliseconds 800
}

function Remove-PrismaTempFiles {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root
  )

  $clientDir = Join-Path $Root 'node_modules\.prisma\client'
  if (-not (Test-Path -LiteralPath $clientDir)) {
    return
  }

  $tmpFiles = @(Get-ChildItem -LiteralPath $clientDir -Filter 'query_engine-windows.dll.node.tmp*' -ErrorAction SilentlyContinue)
  if ($tmpFiles.Count -eq 0) {
    Write-Host 'No Prisma temp engine files found.'
    return
  }

  foreach ($file in $tmpFiles) {
    Write-Host ("Removing Prisma temp file {0}" -f $file.Name)
    Remove-Item -LiteralPath $file.FullName -Force -ErrorAction Stop
  }
}

Stop-RepoNodeProcesses -Root $RepoRoot
Remove-PrismaTempFiles -Root ([System.IO.Path]::GetFullPath($RepoRoot))
