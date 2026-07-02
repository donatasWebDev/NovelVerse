# NovelVerse — Windows PowerShell dev startup (backend + frontend)
param(
    [switch]$WithGpu
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PidDir = Join-Path $Root ".dev-pids"
$LogDir = Join-Path $Root ".dev-logs"

New-Item -ItemType Directory -Force -Path $PidDir, $LogDir | Out-Null

if (-not (Test-Path (Join-Path $Root "backend\.env"))) {
    Write-Error "backend/.env missing. Copy backend/.env.example and configure it."
}

function Start-DevService {
    param(
        [string]$Name,
        [string]$Dir,
        [string]$Command
    )

    $pidFile = Join-Path $PidDir "$Name.pid"
    $logFile = Join-Path $LogDir "$Name.log"

    if (Test-Path $pidFile) {
        $oldPid = Get-Content $pidFile
        if (Get-Process -Id $oldPid -ErrorAction SilentlyContinue) {
            Write-Host "[$Name] already running (pid $oldPid)"
            return
        }
    }

    Write-Host "[$Name] starting..."
    $proc = Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoProfile", "-Command", "Set-Location '$Dir'; $Command *>> '$logFile' 2>&1"
    ) -PassThru -WindowStyle Hidden

    $proc.Id | Out-File -FilePath $pidFile -Encoding ascii
    Write-Host "[$Name] pid $($proc.Id) - log: $logFile"
}

Write-Host "=== NovelVerse Dev Startup ==="

if (-not (Test-Path (Join-Path $Root "backend\node_modules"))) {
    Write-Host "[backend] installing dependencies..."
    Push-Location (Join-Path $Root "backend"); npm install; Pop-Location
}

if (-not (Test-Path (Join-Path $Root "frontend\node_modules"))) {
    Write-Host "[frontend] installing dependencies..."
    Push-Location (Join-Path $Root "frontend"); npm install; Pop-Location
}

Start-DevService -Name "backend" -Dir (Join-Path $Root "backend") -Command "npm run dev"
Start-DevService -Name "frontend" -Dir (Join-Path $Root "frontend") -Command "npm run dev"

if ($WithGpu) {
    $venvPython = Join-Path $Root "gpuServer\venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        $gpuCmd = "$venvPython server.py"
        Start-DevService -Name "gpu" -Dir (Join-Path $Root "gpuServer") -Command $gpuCmd
    } else {
        Write-Warning "[gpu] venv not found - skipping gpuServer"
    }
}

Write-Host ""
Write-Host "Waiting for services..."
Start-Sleep -Seconds 8

& (Join-Path $Root "scripts\dev-healthcheck.ps1")

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Dev environment ready ==="
    Write-Host "  Frontend:  http://localhost:5173"
    Write-Host "  Backend:   http://localhost:5000"
    Write-Host "  Health:    http://localhost:5000/health"
    Write-Host ""
    Write-Host "Stop with: .\scripts\dev-stop.ps1"
} else {
    Write-Host "Health check failed - see logs in $LogDir"
    exit 1
}