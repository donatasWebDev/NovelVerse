# NovelVerse — smoke-check local dev services (PowerShell)
$BackendUrl = if ($env:BACKEND_URL) { $env:BACKEND_URL } else { "http://localhost:5000" }
$FrontendUrl = if ($env:FRONTEND_URL) { $env:FRONTEND_URL } else { "http://localhost:5173" }
$MaxRetries = if ($env:HEALTH_RETRIES) { [int]$env:HEALTH_RETRIES } else { 10 }
$RetryDelaySec = if ($env:HEALTH_RETRY_DELAY) { [int]$env:HEALTH_RETRY_DELAY } else { 3 }

$pass = 0
$fail = 0

function Wait-ForBackend {
    Write-Host "  Waiting for backend (up to $($MaxRetries * $RetryDelaySec)s)..."
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "$BackendUrl/health" -UseBasicParsing -TimeoutSec 5
            if ($r.Content -match "status") { return $true }
        } catch { }
        Start-Sleep -Seconds $RetryDelaySec
    }
    return $false
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Expect = ""
    )

    Write-Host ("  {0,-22}" -f $Name) -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
        if ($Expect -and $response.Content -notmatch [regex]::Escape($Expect)) {
            Write-Host "FAIL (unexpected response)"
            $script:fail++
            return
        }
        Write-Host "OK"
        $script:pass++
    } catch {
        Write-Host "FAIL (unreachable)"
        $script:fail++
    }
}

Write-Host "=== NovelVerse Health Check ==="
Write-Host "  Backend:  $BackendUrl"
Write-Host "  Frontend: $FrontendUrl"
Write-Host ""

if (-not (Wait-ForBackend)) {
    Write-Host "  Backend never became ready"
    exit 1
}

Test-Endpoint -Name "Backend /health" -Url "$BackendUrl/health" -Expect "status"
Test-Endpoint -Name "Frontend (Vite)" -Url $FrontendUrl
Write-Host ("  {0,-22}" -f "Backend API /user") -NoNewline
try {
    Invoke-WebRequest -Uri "$BackendUrl/api/user/" -UseBasicParsing -TimeoutSec 30 | Out-Null
    Write-Host "OK"
    $pass++
} catch {
    if ($_.Exception.Response.StatusCode.value__ -in 401, 403) {
        Write-Host "OK"
        $pass++
    } else {
        Write-Host "FAIL (unreachable)"
        $fail++
    }
}

Write-Host ""
Write-Host "Result: $pass passed, $fail failed"

if ($fail -gt 0) { exit 1 }