# Starlight Telemetry Daemon Launcher
# Starts the background telemetry server on port 9224 with file watchers

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host ""
Write-Host "[+] Starting Starlight Fleet Telemetry Daemon..." -ForegroundColor Cyan
Write-Host "    Root: $ProjectRoot" -ForegroundColor Gray

# Ensure build is present
if (-not (Test-Path "$ProjectRoot\dist\index.js")) {
    Write-Host "[!] Building TypeScript engine..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    pnpm build
    Pop-Location
}

# Start node daemon in background
$entryFile = Join-Path $ProjectRoot "dist\index.js"
$proc = Start-Process -FilePath "node" -ArgumentList @($entryFile, "daemon") -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru

$pidNum = $proc.Id
Write-Host "[OK] Telemetry Daemon running in background (PID: $pidNum)" -ForegroundColor Green
Write-Host "    WebSocket / HTTP: http://127.0.0.1:9224" -ForegroundColor Gray
Write-Host "    HUD view: http://127.0.0.1:9224" -ForegroundColor Gray
