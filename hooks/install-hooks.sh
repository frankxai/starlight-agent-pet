#!/usr/bin/env bash
CLAUDE_HOOKS_DIR="$HOME/.claude/hooks"
mkdir -p "$CLAUDE_HOOKS_DIR"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cp "$DIR/starlight-pet-hook.js" "$CLAUDE_HOOKS_DIR/starlight-pet-hook.js"
chmod +x "$CLAUDE_HOOKS_DIR/starlight-pet-hook.js"

echo -e "\033[32m[✓] Starlight Fleet Hook installed to $CLAUDE_HOOKS_DIR/starlight-pet-hook.js\033[0m"
echo -e "\033[36m[+] All Claude Code sessions will now automatically stream telemetry to Starlight Agent Pet.\033[0m"
