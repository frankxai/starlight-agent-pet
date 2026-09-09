# Starlight Telemetry Daemon - Windows Autostart Registration
# Registers a user scheduled task to start the telemetry daemon silently on login

$TaskName = "StarlightTelemetryDaemon"
$ProjectRoot = "C:\Users\frank\starlight\repos\starlight-agent-pet"
$ScriptPath = "$ProjectRoot\scripts\start-daemon.ps1"

Write-Host "`n[+] Registering $TaskName..." -ForegroundColor Cyan

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

$Trigger = New-ScheduledTaskTrigger -AtLogOn

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Days 365) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Starlight Sovereign Agent Telemetry Daemon (Port 9224)" `
    -ErrorAction Stop

Write-Host "[✓] Scheduled task '$TaskName' registered successfully." -ForegroundColor Green
Write-Host "    Runs automatically on login. You can run it now with: Start-ScheduledTask -TaskName $TaskName" -ForegroundColor Gray
