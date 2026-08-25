# ✦ Starlight Agent Pet & Fleet Observatory

> **Unified Real-Time Coding Agent Telemetry & Interactive Desktop Companion**  
> *Sovereign Telemetry Substrate for Claude Code, Codex CLI, Antigravity, Hermes Agent, Kilo, and Grok.*

---

## 🌌 Overview

**Starlight Agent Pet** is a next-generation local-first telemetry engine and interactive desktop companion designed for AI-native engineers running multi-agent CLI swarms.

It absorbs the best token calculation algorithms from **`ccusage`** and **`tokscale`**, the interactive desktop pet mechanics from **`Clyde`** and **`AgentPet`**, and the dynamic island / live WebSocket stream patterns from **`Claude Buddy`**, elevating them into a unified, glassmorphic **Observatory HUD** tailored for Frank's Starlight & Arcanea ecosystem.

```
       /\_/\    ✦ STELLARIS [Level 7]
      ( o.o )   Gate 7: Crown (Luminor)
       > ^ <    XP: [████████░░] 840/1000
                Mood: "Hyper-Focus / Burning code fast!"
```

---

## ✨ Key Capabilities

1. **Multi-Harness Auto-Discovery & Live Tailing**
   - **Claude Code**: Tail `~/.claude/projects/**/*.jsonl`, active tasks from `~/.claude/todos/`, context bridge files (`claude-ctx-*.json`), prompt cache reads & 1h/5m creation discounts.
   - **Antigravity (Gemini)**: Tail `~/.gemini/antigravity/brain/**/transcript.jsonl` with step indexing and subagent swarms.
   - **Codex CLI / Codex App**: Auto-detect active workspace roots and global state from `~/.codex/`.
   - **Hermes Agent**: Live queue and log monitor from `AppData/Local/hermes` and `~/.hermes/`.
   - **Kilo / Grok / ACOS**: Cross-harness auto-router session detection and worktree monitoring.

2. **Interactive Floating Pet & Dynamic Island**
   - **Multiple Pet Archetypes**:
     - 🦊 **Stellaris The Celestial Cosmic Fox**: Pulsing cosmic tail, reactive eyes that track cursor, and star dust trails.
     - 💎 **Arcanea Luminor**: Floating crystalline geometric golem with rotating elemental shards (Fire, Water, Wind, Earth, Void, Light).
     - 🤖 **Cyber-Pulsar 2077**: Retro cyber-bot with digital visor LED matrix and particle jet thrusters.
   - **8 Reactive States**: `IDLE`, `THINKING`, `CODING`, `SWARMING`, `APPROVAL_REQUIRED`, `LOW_CONTEXT_ALERT`, `VICTORY`, `SLEEPING`.
   - **Real-Time Particle Trail**: Speed and particle frequency scale dynamically with live fleet token velocity (`tok/s`).
   - **Poke Interactions**: Click or double-click the pet to trigger backflips, emotes, and cheerful particles.

3. **Click-to-Open Glassmorphic Telemetry Observatory HUD**
   - **Single-Click Instant Modal**: Click the floating pet to expand the full HUD dashboard.
   - **Live Fleet Session Cards**: Real-time cards for every active CLI process, active tool names, git branches, and durations.
   - **Context Window Health Bar**: Circular/linear gauge of context saturation (% of 200k / 1M / 2M window used) with early warnings before compaction.
   - **Cost & Token Intelligence**: Real-time spend vs budget, breakdowns by harness and model provider.
   - **Arcanea Ten Gates Gamification**: Earn XP and level up from *Apprentice* to *Nexus Master* based on clean code builds and token milestones.

4. **Multi-Surface Runtime**
   - **Desktop App**: Electron / Webview floating window with system tray menu.
   - **Web / Browser Mode**: Local server accessible at `http://localhost:9224`.
   - **CLI Mode**: Terminal dashboard with ASCII art and live stats.
   - **Zero-Latency Push Hooks**: Drop-in hooks for Claude Code pushing instant lifecycle events.

---

## 🚀 Quick Start

### 1. Install & Build
```bash
# Clone or navigate to the repo
cd C:/Users/frank/starlight/repos/starlight-agent-pet

# Install dependencies and compile TypeScript
pnpm install
pnpm build
```

### 2. View Terminal Status
```bash
node bin/starlight-pet.js status
```

### 3. Launch Interactive Floating Pet & Observatory HUD
```bash
node bin/starlight-pet.js hud
```
*Opens `http://localhost:9224` in your default browser with live WebSocket synchronization.*

### 4. Install Drop-in Claude Code Hooks
```powershell
# On Windows PowerShell:
.\hooks\install-hooks.ps1
```
*This installs `starlight-pet-hook.js` into `~/.claude/hooks/` to stream instant tool calls and context alerts.*

---

## 🛠️ CLI Reference

| Command | Description |
|---|---|
| `starlight-pet status` | Quick terminal dashboard with ASCII pet art and live metrics |
| `starlight-pet hud` | Launches background server and opens the full interactive HUD |
| `starlight-pet daemon` | Runs the telemetry daemon and file watcher on port `9224` |
| `starlight-pet report` | Generates a formatted Markdown report of token usage and costs |
| `starlight-pet report --json` | Outputs raw JSON telemetry for multi-machine synchronization |
| `starlight-pet hooks install` | Installs lifecycle hooks into Claude Code |

---

## 🛡️ Architecture & Data Privacy

- **Local-First & Sovereign**: 100% of telemetry parsing and file watching happens locally on your machine.
- **Zero Sensitive Data Leakage**: Session transcripts and file paths are never uploaded to any external server.
- **Estate Standard**: Follows Starlight Estate SSOT rules (`WORKSPACE_MAP.md`).

---

*Built with precision for the Starlight & Arcanea Agent Ecosystem.*
