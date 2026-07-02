# NovelVerse — stop dev services started by dev-start.ps1
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PidDir = Join-Path $Root ".dev-pids"

function Stop-DevService {
    param([string]$Name)

    $pidFile = Join-Path $PidDir "$Name.pid"
    if (-not (Test-Path $pidFile)) {
        Write-Host "[$Name] not running"
        return
    }

    $pid = [int](Get-Content $pidFile)
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "[$Name] stopping pid $pid"
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $pidFile -Force
}

Write-Host "=== Stopping NovelVerse dev services ==="
Stop-DevService "frontend"
Stop-DevService "backend"
Stop-DevService "gpu"
Write-Host "Done."