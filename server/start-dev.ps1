# LichtBlick Dev Server mit Auto-Restart
# Startet den Server neu bei jedem Exit

Write-Host "🎮 LichtBlick Dev Server (Auto-Restart)" -ForegroundColor Cyan
Write-Host "Drücke Ctrl+C zum Beenden" -ForegroundColor Gray
Write-Host ""

while ($true) {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') 🚀 Server startet..." -ForegroundColor Green
    
    # Server starten und auf Ende warten
    node index.js
    $exitCode = $LASTEXITCODE
    
    Write-Host "$(Get-Date -Format 'HH:mm:ss') Server beendet mit Code: $exitCode" -ForegroundColor Yellow
    
    # Kurze Pause vor Neustart
    Start-Sleep -Seconds 1
    
    Write-Host "$(Get-Date -Format 'HH:mm:ss') 🔄 Neustart..." -ForegroundColor Cyan
    Write-Host ""
}
