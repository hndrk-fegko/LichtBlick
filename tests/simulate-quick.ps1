<#
.SYNOPSIS
    Spieler-Simulation fuer LichtBlick

.DESCRIPTION
    Startet die Spieler-Simulation mit konfigurierbaren Parametern.

.PARAMETER ServerUrl
    Server-URL (Standard: http://localhost:3000)

.PARAMETER Players
    Anzahl Spieler (Standard: 10)

.PARAMETER DelayMin
    Minimale Antwort-Verzoegerung in ms (Standard: 500)

.PARAMETER DelayMax
    Maximale Antwort-Verzoegerung in ms (Standard: 3000)

.PARAMETER CorrectChance
    Wahrscheinlichkeit fuer richtige Antwort 0-1 (Standard: 0.3 = 30%)

.PARAMETER Info
    Zeigt nur die aktuellen Parameter ohne Simulation zu starten

.EXAMPLE
    .\simulate-quick.ps1
    .\simulate-quick.ps1 -ServerUrl "http://localhost:3001" -Players 5
    .\simulate-quick.ps1 -Info
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$ServerUrl = "http://localhost:3000",
    
    [Parameter(Mandatory=$false)]
    [int]$Players = 10,
    
    [Parameter(Mandatory=$false)]
    [int]$DelayMin = 500,
    
    [Parameter(Mandatory=$false)]
    [int]$DelayMax = 3000,
    
    [Parameter(Mandatory=$false)]
    [ValidateRange(0, 1)]
    [double]$CorrectChance = 0.3,
    
    [Parameter(Mandatory=$false)]
    [switch]$Info
)

Write-Host ""
Write-Host "LichtBlick Spieler-Simulator" -ForegroundColor Cyan
Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan

# Zeige Parameter
Write-Host "Server:             $ServerUrl" -ForegroundColor White
Write-Host "Anzahl Spieler:     $Players" -ForegroundColor White
Write-Host "Antwort-Delay:      $DelayMin-${DelayMax}ms" -ForegroundColor White
Write-Host "Richtig-Chance:     $([int]($CorrectChance * 100))%" -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Nur Info anzeigen?
if ($Info) {
    Write-Host "Parameter-Info (Simulation wird NICHT gestartet)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Verwendung:" -ForegroundColor Cyan
    Write-Host "  .\simulate-quick.ps1" -ForegroundColor Gray
    Write-Host "  .\simulate-quick.ps1 -ServerUrl 'http://localhost:3001'" -ForegroundColor Gray
    Write-Host "  .\simulate-quick.ps1 -Players 5 -DelayMin 1000 -DelayMax 5000" -ForegroundColor Gray
    Write-Host "  .\simulate-quick.ps1 -CorrectChance 0.5" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Alle Parameter:" -ForegroundColor Cyan
    Write-Host "  -ServerUrl       Server-URL (Standard: http://localhost:3000)" -ForegroundColor Gray
    Write-Host "  -Players         Anzahl Spieler (Standard: 10)" -ForegroundColor Gray
    Write-Host "  -DelayMin        Min. Verzoegerung ms (Standard: 500)" -ForegroundColor Gray
    Write-Host "  -DelayMax        Max. Verzoegerung ms (Standard: 3000)" -ForegroundColor Gray
    Write-Host "  -CorrectChance   Richtig-Wahrscheinlichkeit 0-1 (Standard: 0.3)" -ForegroundColor Gray
    Write-Host "  -Info            Zeigt nur diese Info an" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# Setze Umgebungsvariablen
$env:SERVER_URL = $ServerUrl
$env:NUM_PLAYERS = $Players
$env:ANSWER_DELAY_MIN = $DelayMin
$env:ANSWER_DELAY_MAX = $DelayMax
$env:CORRECT_ANSWER_CHANCE = $CorrectChance

# Starte Simulation
Write-Host "Starte Simulation..." -ForegroundColor Green
Write-Host ""
node simulate-players.js
