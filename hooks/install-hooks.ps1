# Starlight Fleet Hook Installer for Windows
$ClaudeHooksDir = "$HOME\.claude\hooks"
if (!(Test-Path $ClaudeHooksDir)) {
    New-Item -ItemType Directory -Path $ClaudeHooksDir -Force | Out-Null
}

$ScriptSource = Join-Path $PSScriptRoot "starlight-pet-hook.js"
$ScriptDest = Join-Path $ClaudeHooksDir "starlight-pet-hook.js"

Copy-Item -Path $ScriptSource -Destination $ScriptDest -Force
Write-Host "[✓] Starlight Fleet Hook installed to $ScriptDest" -ForegroundColor Green
Write-Host "[+] All Claude Code sessions will now automatically stream telemetry to Starlight Agent Pet." -ForegroundColor Cyan
