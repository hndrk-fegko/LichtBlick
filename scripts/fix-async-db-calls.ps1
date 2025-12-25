# Fix DB calls to be async-compatible
# This script adds 'await' to all db.db.prepare().get|all|run() calls

$files = @(
    "../server/routes/uploads.js",
    "../server/routes/api.js"
)

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot $file
    $content = Get-Content $fullPath -Raw
    
    # Pattern 1: db.db.prepare(...).get() -> await db.db.prepare(...).get()
    $content = $content -replace '(?<!await )db\.db\.prepare\(', 'await db.db.prepare('
    
    # Pattern 2: stmt.get() -> await stmt.get()
    $content = $content -replace '(?<!await )(\$\{?\w+\}?)\.(get|all|run)\(', 'await $1.$2('
    
    # Save
    Set-Content $fullPath $content -NoNewline
    Write-Host "✅ Fixed: $file"
}

Write-Host "`n✅ All async DB calls fixed!"
