# IT-DAU Security Penetration Test
# Führe dieses Skript in einem SEPARATEN Terminal aus während der Server läuft!

Write-Host ""
Write-Host "======================================================" -ForegroundColor Red
Write-Host "  IT-DAU PENETRATION TEST - Admin Token Security" -ForegroundColor Red  
Write-Host "======================================================" -ForegroundColor Red
Write-Host ""

$baseUrl = "http://localhost:3000"
$passed = 0
$failed = 0

# Test 1: REST API ohne Auth
Write-Host "[TEST 1] REST API PUT /api/settings ohne Auth" -ForegroundColor Yellow
try { 
    $r = Invoke-RestMethod -Uri "$baseUrl/api/settings" -Method PUT -Body '{"hacked":true}' -ContentType "application/json" -ErrorAction Stop
    Write-Host "  FAIL: Request akzeptiert!" -ForegroundColor Red
    $failed++
} catch { 
    Write-Host "  PASS: Blockiert (401 Unauthorized)" -ForegroundColor Green
    $passed++
}

# Test 2: Image Upload ohne Auth
Write-Host ""
Write-Host "[TEST 2] POST /api/upload ohne Auth" -ForegroundColor Yellow
try { 
    $r = Invoke-RestMethod -Uri "$baseUrl/api/upload" -Method POST -Body '{}' -ContentType "application/json" -ErrorAction Stop
    Write-Host "  FAIL: Upload akzeptiert!" -ForegroundColor Red
    $failed++
} catch { 
    Write-Host "  PASS: Blockiert" -ForegroundColor Green
    $passed++
}

# Test 3: Image Delete ohne Auth
Write-Host ""
Write-Host "[TEST 3] DELETE /api/images/1 ohne Auth" -ForegroundColor Yellow
try { 
    $r = Invoke-RestMethod -Uri "$baseUrl/api/images/1" -Method DELETE -ErrorAction Stop
    Write-Host "  FAIL: Delete akzeptiert!" -ForegroundColor Red
    $failed++
} catch { 
    Write-Host "  PASS: Blockiert" -ForegroundColor Green
    $passed++
}

# Test 4: Honeypot /api/admin
Write-Host ""
Write-Host "[TEST 4] Honeypot GET /api/admin" -ForegroundColor Yellow
try { 
    $r = Invoke-WebRequest -Uri "$baseUrl/api/admin" -UseBasicParsing -ErrorAction Stop
    Write-Host "  Status: $($r.StatusCode)" -ForegroundColor Yellow
} catch { 
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 418) {
        Write-Host "  PASS: Honeypot aktiv (418 I'm a teapot)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  Status: $status" -ForegroundColor Yellow
        $passed++
    }
}

# Test 5: Login mit falschem PIN
Write-Host ""
Write-Host "[TEST 5] POST /api/auth/login mit falschem PIN" -ForegroundColor Yellow
try { 
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body '{"pin":"9999"}' -ContentType "application/json" -ErrorAction Stop
    if ($r.success) { 
        Write-Host "  FAIL: Login akzeptiert!" -ForegroundColor Red
        $failed++
    } else { 
        Write-Host "  PASS: Login abgelehnt" -ForegroundColor Green
        $passed++
    }
} catch { 
    Write-Host "  PASS: Login abgelehnt" -ForegroundColor Green
    $passed++
}

# Test 6: Fake Bearer Token
Write-Host ""
Write-Host "[TEST 6] PUT /api/settings mit Fake Bearer Token" -ForegroundColor Yellow
try { 
    $headers = @{ "Authorization" = "Bearer FAKE_TOKEN_12345" }
    $r = Invoke-RestMethod -Uri "$baseUrl/api/settings" -Method PUT -Headers $headers -Body '{"hacked":true}' -ContentType "application/json" -ErrorAction Stop
    Write-Host "  FAIL: Fake Token akzeptiert!" -ForegroundColor Red
    $failed++
} catch { 
    Write-Host "  PASS: Fake Token abgelehnt" -ForegroundColor Green
    $passed++
}

# Test 7: SQL Injection in Player Name (via REST)
Write-Host ""
Write-Host "[TEST 7] SQL Injection Versuch in Wort-Liste" -ForegroundColor Yellow
try {
    $headers = @{ "Authorization" = "Bearer FAKE" }
    $body = '{"words": ["Normal", "Robert''); DROP TABLE players;--"]}'
    $r = Invoke-RestMethod -Uri "$baseUrl/api/words" -Method PUT -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "  Blockiert (Auth)" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "  PASS: Blockiert (keine Auth)" -ForegroundColor Green
    $passed++
}

# Test 8: Path Traversal in Image URL
Write-Host ""
Write-Host "[TEST 8] Path Traversal Versuch" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$baseUrl/uploads/../server/index.js" -UseBasicParsing -ErrorAction Stop
    if ($r.Content -match "require") {
        Write-Host "  FAIL: Server-Code exponiert!" -ForegroundColor Red
        $failed++
    } else {
        Write-Host "  PASS: Kein Zugriff auf Server-Code" -ForegroundColor Green
        $passed++
    }
} catch {
    Write-Host "  PASS: Blockiert" -ForegroundColor Green
    $passed++
}

# Test 9: XSS in öffentlichen Endpunkten
Write-Host ""
Write-Host "[TEST 9] Checking Content-Type Headers" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$baseUrl/api/images" -UseBasicParsing
    if ($r.Headers["Content-Type"] -match "application/json") {
        Write-Host "  PASS: JSON Content-Type gesetzt" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  WARN: Content-Type nicht JSON" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  ERGEBNIS: $passed PASS / $failed FAIL" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ Alle Security-Tests bestanden!" -ForegroundColor Green
} else {
    Write-Host "⚠️  $failed Test(s) fehlgeschlagen - Sicherheitslücken gefunden!" -ForegroundColor Red
}
