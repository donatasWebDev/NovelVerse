# NovelVerse Phase 1 smoke test — run after dev-start.ps1
$BackendUrl = if ($env:BACKEND_URL) { $env:BACKEND_URL } else { "http://localhost:5000" }
$FrontendUrl = if ($env:FRONTEND_URL) { $env:FRONTEND_URL } else { "http://localhost:5173" }

$pass = 0
$fail = 0

function Test-Step {
    param([string]$Name, [scriptblock]$Block)
    Write-Host ("  {0,-28}" -f $Name) -NoNewline
    try {
        & $Block
        Write-Host "OK"
        $script:pass++
    } catch {
        Write-Host "FAIL - $($_.Exception.Message)"
        $script:fail++
    }
}

Write-Host "=== NovelVerse Phase 1 Smoke Test ==="
Write-Host ""

Test-Step "Health endpoint" {
    $r = Invoke-WebRequest -Uri "$BackendUrl/health" -UseBasicParsing -TimeoutSec 15
    if ($r.Content -notmatch "status") { throw "missing status field" }
}

Test-Step "Browse books (public API)" {
    $r = Invoke-WebRequest -Uri "$BackendUrl/api/lib/get/books?page=1" -UseBasicParsing -TimeoutSec 15
    $json = $r.Content | ConvertFrom-Json
    if ($null -eq $json.books) { throw "missing books array" }
}

Test-Step "Login rejects bad creds" {
    try {
        Invoke-WebRequest -Uri "$BackendUrl/api/user/login" -Method POST `
            -ContentType "application/json" `
            -Body '{"email":"smoke-test@invalid.local","password":"wrong"}' `
            -UseBasicParsing -TimeoutSec 15 | Out-Null
        throw "expected error status"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -notin 400, 404) {
            throw "unexpected status $($_.Exception.Response.StatusCode.value__)"
        }
    }
}

Test-Step "Frontend serves app" {
    $r = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
}

Test-Step "Auth route requires token" {
    try {
        Invoke-WebRequest -Uri "$BackendUrl/api/user/" -UseBasicParsing -TimeoutSec 15 | Out-Null
        throw "expected 401"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 401) {
            throw "expected 401, got $($_.Exception.Response.StatusCode.value__)"
        }
    }
}

Write-Host ""
Write-Host "Result: $pass passed, $fail failed"
Write-Host ""
Write-Host "Manual checks (need browser + valid account):"
Write-Host "  1. Open $FrontendUrl and log in"
Write-Host "  2. Browse library (pagination via ?page=1)"
Write-Host "  3. Open a book /play route (needs GPU + S3 for audio)"

if ($fail -gt 0) { exit 1 }